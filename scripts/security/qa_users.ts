import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const mode = process.argv[2];
if (mode === "create") {
  const tag = Date.now(); const out: any[] = [];
  for (const n of ["a", "b"]) {
    const u = { email: `qa-2a-${n}-${tag}@example.invalid`, password: randomBytes(18).toString("base64url") };
    const { data, error } = await admin.auth.admin.createUser({ ...u, email_confirm: true }); if (error) throw error;
    out.push({ ...u, id: data.user!.id });
  }
  writeFileSync("/tmp/browser/auth/creds.json", JSON.stringify(out)); console.log("created", out.length);
} else if (mode === "inspect") {
  const { data: u } = await admin.auth.admin.listUsers({ perPage: 200 });
  for (const x of u.users.filter((x) => x.email?.startsWith("qa-2a-"))) {
    const { data: s } = await admin.from("assessment_snapshots").select("revision,workflow_attributes_version,results->model,results->priority->score,created_at").eq("owner_user_id", x.id).order("revision");
    console.log(x.email.slice(0, 8), JSON.stringify(s));
  }
} else {
  const { data: u } = await admin.auth.admin.listUsers({ perPage: 200 });
  for (const x of u.users.filter((x) => x.email?.startsWith("qa-2a-"))) {
    await admin.from("organizations").delete().eq("owner_user_id", x.id); await admin.auth.admin.deleteUser(x.id);
  }
  const { data: u2 } = await admin.auth.admin.listUsers({ perPage: 200 });
  console.log("remaining qa users", u2.users.filter((x) => x.email?.startsWith("qa-2a-")).length);
}
