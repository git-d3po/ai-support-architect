import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
const mode = process.argv[2];
if (mode === "create") {
  const email = `e2e-test-${Date.now()}@example.invalid`, password = randomBytes(18).toString("base64url");
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  writeFileSync("/tmp/sec/creds.json", JSON.stringify({ email, password, id: data.user!.id }), { mode: 0o600 });
  console.log("created");
} else if (mode === "inspect") {
  const { id } = JSON.parse(require("node:fs").readFileSync("/tmp/sec/creds.json", "utf8"));
  const { data } = await admin.from("assessment_snapshots").select("revision, workflow_attributes_version, scoring_version, results").eq("owner_user_id", id).order("revision");
  for (const s of data ?? []) console.log("rev", s.revision, "attrV", s.workflow_attributes_version, "model", (s.results as any).model, "eligible", (s.results as any).impact.eligible, "susp", (s.results as any).scores.suitability);
  const { count } = await admin.from("workflows").select("id", { count: "exact", head: true }).eq("owner_user_id", id);
  console.log("workflows", count);
} else {
  const { id } = JSON.parse(require("node:fs").readFileSync("/tmp/sec/creds.json", "utf8"));
  await admin.from("organizations").delete().eq("owner_user_id", id);
  await admin.auth.admin.deleteUser(id);
  console.log("cleaned");
}
process.exit(0);
