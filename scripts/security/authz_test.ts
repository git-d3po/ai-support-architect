// Two-user authorization + atomicity/concurrency verification against the real Lovable Cloud backend.
// Uses real JWTs (RLS applies). Service-role is used only to (a) provision/cleanup confirmed test users
// and (b) replicate exactly the insert saveAssessment performs, to test DB-level guarantees.
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";

const URL = process.env.SUPABASE_URL!;
const ANON = process.env.SUPABASE_PUBLISHABLE_KEY!;
const SR = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(URL, SR, opts);
const anon = createClient(URL, ANON, opts);

let pass = 0, fail = 0;
const results: string[] = [];
function check(name: string, ok: boolean, detail = "") {
  ok ? pass++ : fail++;
  const line = `${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`; results.push(line); console.log(line);
}

const pw = () => randomBytes(18).toString("base64url");
const tag = Date.now();
const users = [
  { email: `sec-test-a-${tag}@example.invalid`, password: pw() },
  { email: `sec-test-b-${tag}@example.invalid`, password: pw() },
];

async function main() {
  const pre = await admin.auth.admin.listUsers({ perPage: 200 });
  for (const u of pre.data.users.filter((x) => x.email?.startsWith("sec-test-"))) { await admin.from("organizations").delete().eq("owner_user_id", u.id); await admin.auth.admin.deleteUser(u.id); }
  await admin.from("organizations").delete().eq("name", "probe");
  console.log("setup");
  const ids: string[] = [];
  for (const u of users) {
    const { data, error } = await admin.auth.admin.createUser({ email: u.email, password: u.password, email_confirm: true });
    if (error) throw error;
    ids.push(data.user!.id);
  }
  const [aId, bId] = ids as [string, string];
  const login = async (u: (typeof users)[number]) => {
    const c = createClient(URL, ANON, opts);
    const { error } = await c.auth.signInWithPassword(u);
    if (error) throw error;
    return c;
  };
  const A = await login(users[0]!);
  const B = await login(users[1]!);
  try {
    // ---- Setup via ordinary user clients
    const { data: orgA, error: e1 } = await A.from("organizations").insert({ owner_user_id: aId, name: "Sec Org A" }).select().single();
    check("A creates own organization", !e1 && !!orgA, e1?.message);
    const { data: orgB } = await B.from("organizations").insert({ owner_user_id: bId, name: "Sec Org B" }).select().single();
    const { data: wfA, error: e2 } = await A.from("workflows").insert({
      organization_id: orgA.id, owner_user_id: aId, name: "Sec WF A", category: "product",
      monthly_volume: 100, aht_minutes: 5, action_type: "read_only",
    }).select().single();
    check("A creates own workflow", !e2 && !!wfA, e2?.message);

    const snapRow = (rev: number, owner = aId, ver = 1) => ({
      workflow_id: wfA.id, owner_user_id: owner, revision: rev, workflow_attributes_version: ver,
      workflow_attributes: {}, inputs: {}, scoring_version: "1.0.0", results: { model: "deterministic" },
    });

    // ---- Anonymous access
    for (const t of ["organizations", "workflows", "assessment_snapshots"] as const) {
      const r = await anon.from(t).select("id");
      check(`anon SELECT ${t} denied`, !!r.error || (r.data ?? []).length === 0, r.error?.code);
    }
    { const r = await anon.from("assessment_snapshots").insert(snapRow(1)); check("anon INSERT snapshot denied", r.error?.code === "42501", r.error?.code); }
    { const r = await anon.from("organizations").insert({ owner_user_id: aId, name: "x" }); check("anon INSERT organization denied", !!r.error, r.error?.code); }
    { const r = await anon.from("workflows").update({ name: "x" }).eq("id", wfA.id).select(); check("anon UPDATE workflow denied", !!r.error || (r.data ?? []).length === 0, r.error?.code); }
    { const r = await anon.from("organizations").delete().eq("id", orgA.id).select(); check("anon DELETE organization denied", !!r.error || (r.data ?? []).length === 0, r.error?.code); }

    // ---- Trusted insert (what saveAssessment does) + A's own visibility
    { const r = await admin.from("assessment_snapshots").insert(snapRow(1)).select().single(); check("server (service role) inserts revision 1", !r.error, r.error?.message); }
    { const r = await A.from("assessment_snapshots").select("id").eq("workflow_id", wfA.id); check("A reads own snapshot", (r.data ?? []).length === 1, r.error?.message); }

    // ---- Cross-user isolation (B against A)
    { const r = await B.from("organizations").select("id").eq("id", orgA.id); check("B SELECT A's organization → 0 rows", (r.data ?? []).length === 0); }
    { const r = await B.from("workflows").select("id").eq("id", wfA.id); check("B SELECT A's workflow → 0 rows", (r.data ?? []).length === 0); }
    { const r = await B.from("assessment_snapshots").select("id").eq("workflow_id", wfA.id); check("B SELECT A's snapshots → 0 rows", (r.data ?? []).length === 0); }
    { const r = await B.from("organizations").update({ name: "pwned" }).eq("id", orgA.id).select(); check("B UPDATE A's organization → 0 rows", (r.data ?? []).length === 0, r.error?.code); }
    { const r = await B.from("workflows").update({ name: "pwned" }).eq("id", wfA.id).select(); check("B UPDATE A's workflow → 0 rows", (r.data ?? []).length === 0, r.error?.code); }
    { const r = await B.from("workflows").delete().eq("id", wfA.id).select(); check("B DELETE A's workflow → 0 rows", (r.data ?? []).length === 0, r.error?.code); }
    { const r = await B.from("organizations").delete().eq("id", orgA.id).select(); check("B DELETE A's organization → 0 rows", (r.data ?? []).length === 0, r.error?.code); }
    { const r = await B.from("organizations").insert({ owner_user_id: aId, name: "forged" }); check("B INSERT organization with A as owner → denied", r.error?.code === "42501", r.error?.code); }
    { const r = await B.from("workflows").insert({ organization_id: orgA.id, owner_user_id: bId, name: "x", category: "product", monthly_volume: 1, aht_minutes: 1, action_type: "read_only" });
      check("B INSERT workflow into A's organization → denied", r.error?.code === "42501", r.error?.code); }
    { const r = await B.from("workflows").insert({ organization_id: orgA.id, owner_user_id: aId, name: "x", category: "product", monthly_volume: 1, aht_minutes: 1, action_type: "read_only" });
      check("B INSERT workflow forged as A → denied", r.error?.code === "42501", r.error?.code); }
    { const { data: wfB } = await B.from("workflows").insert({ organization_id: orgB.id, owner_user_id: bId, name: "WF B", category: "product", monthly_volume: 1, aht_minutes: 1, action_type: "read_only" }).select().single();
      const r = await B.from("workflows").update({ organization_id: orgA.id }).eq("id", wfB.id).select();
      check("B moves own workflow into A's organization → denied", !!r.error, r.error?.code); }
    { const r = await B.from("assessment_snapshots").insert(snapRow(2, bId)); check("B INSERT snapshot on A's workflow → denied", r.error?.code === "42501", r.error?.code); }

    // ---- Direct result forgery by the owner
    { const r = await A.from("assessment_snapshots").insert(snapRow(2)); check("A direct INSERT snapshot (forged result) → denied", r.error?.code === "42501", r.error?.code); }
    { const r = await A.from("assessment_snapshots").update({ results: { model: "ai_autonomous" } }).eq("workflow_id", wfA.id).select(); check("A UPDATE own snapshot results → denied", !!r.error || (r.data ?? []).length === 0, r.error?.code); }
    { const r = await A.from("assessment_snapshots").delete().eq("workflow_id", wfA.id).select(); check("A DELETE own snapshot → denied", !!r.error || (r.data ?? []).length === 0, r.error?.code); }
    { const r = await admin.from("assessment_snapshots").update({ scoring_version: "x" }).eq("workflow_id", wfA.id).select(); check("service role UPDATE snapshot → denied (immutable)", !!r.error, r.error?.message); }

    // ---- Atomicity / integrity
    const count = async () => (await admin.from("assessment_snapshots").select("id", { count: "exact", head: true }).eq("workflow_id", wfA.id)).count;
    { const before = await count(); const r = await admin.from("assessment_snapshots").insert({ ...snapRow(2), results: null as never });
      check("failed insert (NOT NULL) leaves no row", !!r.error && (await count()) === before, r.error?.code); }
    { const r = await admin.from("assessment_snapshots").insert(snapRow(5)); check("revision gap rejected", !!r.error, r.error?.code); }
    { const r = await admin.from("assessment_snapshots").insert(snapRow(2, bId)); check("owner ≠ workflow owner rejected", !!r.error, r.error?.message); }

    // ---- Concurrency: two saves on same base revision
    const [c1, c2] = await Promise.all([admin.from("assessment_snapshots").insert(snapRow(2)).select(), admin.from("assessment_snapshots").insert(snapRow(2)).select()]);
    const okCount = [c1, c2].filter((r) => !r.error).length;
    check("concurrent saves on same base: exactly one succeeds, other conflicts (23505)", okCount === 1 && [c1, c2].some((r) => r.error?.code === "23505"), `${c1.error?.code ?? "ok"} / ${c2.error?.code ?? "ok"}`);
    { const r = await A.from("assessment_snapshots").select("revision").eq("workflow_id", wfA.id).order("revision");
      const revs = (r.data ?? []).map((x) => x.revision); check("revisions unique and contiguous", JSON.stringify(revs) === "[1,2]", JSON.stringify(revs)); }

    // ---- Staleness
    { const r = await A.from("workflows").update({ attributes_version: 99 }).eq("id", wfA.id).select("attributes_version").single(); check("client cannot set attributes_version", r.data?.attributes_version === 1, String(r.data?.attributes_version)); }
    { const r = await A.from("workflows").update({ name: "renamed" }).eq("id", wfA.id).select("attributes_version").single(); check("non-attribute edit keeps version", r.data?.attributes_version === 1); }
    { const r = await A.from("workflows").update({ monthly_volume: 200 }).eq("id", wfA.id).select("attributes_version").single(); check("volume edit bumps attributes_version", r.data?.attributes_version === 2, String(r.data?.attributes_version)); }
    { const r = await admin.from("assessment_snapshots").insert(snapRow(3, aId, 1)); check("save against stale attributes version → P0409", r.error?.code === "P0409", r.error?.code); }
    { const r = await admin.from("assessment_snapshots").insert(snapRow(3, aId, 2)); check("re-assessment with current version succeeds (rev 3)", !r.error, r.error?.message); }

    // ---- Owner cascade delete
    { const r = await A.from("workflows").delete().eq("id", wfA.id).select(); const left = await count();
      check("owner delete cascades history (no orphans)", (r.data ?? []).length === 1 && left === 0, `left=${left}`); }
  } finally {
    for (const id of ids) {
      await admin.from("organizations").delete().eq("owner_user_id", id);
      await admin.auth.admin.deleteUser(id);
    }
  }
  console.log(`\nTOTAL: ${pass} passed, ${fail} failed`);
}
main().then(() => process.exit(0)).catch((e) => { console.error("ERROR", e); process.exit(1); });
