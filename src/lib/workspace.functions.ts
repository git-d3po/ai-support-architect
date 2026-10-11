// Authenticated workspace server functions. The trusted assessment write path lives here.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assess } from "@/domain/engine";
import { assessmentInputsSchema, validateConsistency, workflowAttributesSchema } from "@/domain/validation";
import { SCORING_VERSION, type AssessmentInputs, type AssessmentResult, type ValidationError, type WorkflowAttributes } from "@/domain/types";

const WF_COLS =
  "id, organization_id, name, category, description, current_process, monthly_volume, aht_minutes, required_systems, action_type, handles_account_access, accesses_sensitive_data, attributes_version, updated_at";

export interface WorkflowDTO {
  id: string; name: string; category: "billing" | "accounts" | "product" | "technical" | "security";
  description: string; current_process: string; required_systems: string[];
  attrs: WorkflowAttributes; attributes_version: number; updated_at: string;
}
export interface SnapshotDTO {
  id: string; workflow_id: string; revision: number; workflow_attributes_version: number;
  scoring_version: string; inputs: AssessmentInputs; results: AssessmentResult; provenance: Record<string, string>; created_at: string;
}

type WfRow = {
  id: string; name: string; category: WorkflowDTO["category"]; description: string; current_process: string;
  monthly_volume: number; aht_minutes: number | string; required_systems: string[]; action_type: WorkflowAttributes["action_type"];
  handles_account_access: boolean; accesses_sensitive_data: boolean; attributes_version: number; updated_at: string;
};
function toWorkflow(r: WfRow): WorkflowDTO {
  return {
    id: r.id, name: r.name, category: r.category, description: r.description, current_process: r.current_process,
    required_systems: r.required_systems, attributes_version: r.attributes_version, updated_at: r.updated_at,
    attrs: {
      monthly_volume: r.monthly_volume, aht_minutes: Number(r.aht_minutes), action_type: r.action_type,
      handles_account_access: r.handles_account_access, accesses_sensitive_data: r.accesses_sensitive_data,
    },
  };
}

export const getWorkspace = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data: org, error: oe } = await supabase.from("organizations").select("*").order("created_at").limit(1).maybeSingle();
    if (oe) throw new Error("Could not load organization");
    if (!org) return { org: null, workflows: [], latest: {} as Record<string, SnapshotDTO> };
    const { data: wfs, error: we } = await supabase.from("workflows").select(WF_COLS).eq("organization_id", org.id).order("name");
    if (we) throw new Error("Could not load workflows");
    const ids = (wfs ?? []).map((w) => w.id);
    const latest: Record<string, SnapshotDTO> = {};
    if (ids.length) {
      const { data: snaps, error: se } = await supabase
        .from("assessment_snapshots")
        .select("id, workflow_id, revision, workflow_attributes_version, scoring_version, inputs, results, provenance, created_at")
        .in("workflow_id", ids)
        .order("revision", { ascending: false });
      if (se) throw new Error("Could not load assessments");
      for (const s of snaps ?? []) if (!latest[s.workflow_id]) latest[s.workflow_id] = s as unknown as SnapshotDTO;
    }
    return { org, workflows: (wfs ?? []).map((w) => toWorkflow(w as WfRow)), latest };
  });

const orgSchema = z.object({
  name: z.string().trim().min(1).max(120),
  industry: z.string().trim().max(120),
  support_agent_count: z.number().int().min(0).max(100000),
  monthly_ticket_volume: z.number().int().min(0).max(100_000_000),
  support_channels: z.array(z.string().trim().min(1).max(40)).max(10),
}).strict();

export const createOrganization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => orgSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("organizations").insert({ ...data, owner_user_id: context.userId }).select("id").single();
    if (error) throw new Error("Could not create organization");
    return { id: row.id };
  });

const workflowSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(120),
  category: z.enum(["billing", "accounts", "product", "technical", "security"]),
  description: z.string().max(2000),
  current_process: z.string().max(4000),
  required_systems: z.array(z.string().trim().min(1).max(60)).max(20),
  attrs: workflowAttributesSchema,
}).strict();

export const upsertWorkflow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => workflowSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const row = {
      name: data.name, category: data.category, description: data.description, current_process: data.current_process,
      required_systems: data.required_systems, ...data.attrs,
    };
    if (data.id) {
      const { data: upd, error } = await supabase.from("workflows").update(row).eq("id", data.id).select("id");
      if (error || !upd?.length) throw new Error("Workflow not found");
      return { id: data.id };
    }
    const { data: org } = await supabase.from("organizations").select("id").order("created_at").limit(1).maybeSingle();
    if (!org) throw new Error("Create an organization first");
    const { data: ins, error } = await supabase
      .from("workflows").insert({ ...row, organization_id: org.id, owner_user_id: userId }).select("id").single();
    if (error) throw new Error("Could not create workflow");
    return { id: ins.id };
  });

export const deleteWorkflow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).strict().parse(d))
  .handler(async ({ data, context }) => {
    const { data: del, error } = await context.supabase.from("workflows").delete().eq("id", data.id).select("id");
    if (error || !del?.length) throw new Error("Workflow not found");
    return { ok: true };
  });

export const getWorkflowDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).strict().parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: wf, error } = await supabase.from("workflows").select(WF_COLS).eq("id", data.id).maybeSingle();
    if (error || !wf) return { workflow: null, latest: null, revisionCount: 0 };
    const { data: snaps } = await supabase
      .from("assessment_snapshots")
      .select("id, workflow_id, revision, workflow_attributes_version, scoring_version, inputs, results, provenance, created_at")
      .eq("workflow_id", data.id).order("revision", { ascending: false }).limit(1);
    const { count } = await supabase.from("assessment_snapshots").select("id", { count: "exact", head: true }).eq("workflow_id", data.id);
    return { workflow: toWorkflow(wf as WfRow), latest: (snaps?.[0] as unknown as SnapshotDTO) ?? null, revisionCount: count ?? 0 };
  });

const saveSchema = z.object({
  workflowId: z.string().uuid(),
  baseRevision: z.number().int().min(0),
  inputs: assessmentInputsSchema,
  provenance: z.enum(["observed", "estimate"]),
}).strict();

export type SaveAssessmentResult =
  | { ok: true; snapshot: SnapshotDTO }
  | { ok: false; kind: "not_found" | "invalid" | "conflict"; message: string; errors?: ValidationError[] };

/**
 * Trusted write path. Identity comes only from the validated JWT; ownership is checked with the
 * user-scoped (RLS) client; results are recomputed here; the single insert uses the server-only
 * service role because browser roles have no INSERT grant on assessment_snapshots.
 */
export const saveAssessment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => saveSchema.parse(d))
  .handler(async ({ data, context }): Promise<SaveAssessmentResult> => {
    const { supabase, userId } = context;
    const { data: wf, error } = await supabase.from("workflows").select(WF_COLS + ", owner_user_id").eq("id", data.workflowId).maybeSingle();
    if (error || !wf) return { ok: false, kind: "not_found", message: "Workflow not found." };
    const w = toWorkflow(wf as unknown as WfRow);
    if ((wf as unknown as { owner_user_id: string }).owner_user_id !== userId) return { ok: false, kind: "not_found", message: "Workflow not found." };

    const inputs = data.inputs as AssessmentInputs;
    const errors = validateConsistency(w.attrs, inputs);
    if (errors.length) return { ok: false, kind: "invalid", message: "Inputs contradict workflow attributes.", errors };

    const results = assess(w.attrs, inputs);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: snap, error: ie } = await supabaseAdmin
      .from("assessment_snapshots")
      .insert({
        workflow_id: w.id,
        owner_user_id: userId,
        revision: data.baseRevision + 1,
        workflow_attributes_version: w.attributes_version,
        workflow_attributes: w.attrs as never,
        inputs: inputs as never,
        provenance: { all: data.provenance } as never,
        scoring_version: SCORING_VERSION,
        results: results as never,
      })
      .select("id, workflow_id, revision, workflow_attributes_version, scoring_version, inputs, results, provenance, created_at")
      .single();
    if (ie) {
      if (ie.code === "23505" || ie.code === "40001")
        return { ok: false, kind: "conflict", message: "This assessment or workflow changed elsewhere. Reload and try again." };
      console.error("saveAssessment insert failed", ie.code);
      throw new Error("Could not save assessment");
    }
    return { ok: true, snapshot: snap as unknown as SnapshotDTO };
  });
