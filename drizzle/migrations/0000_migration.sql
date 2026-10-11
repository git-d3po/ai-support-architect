-- Enums
CREATE TYPE public.workflow_category AS ENUM ('billing','accounts','product','technical','security');
CREATE TYPE public.action_type AS ENUM ('read_only','reversible_write','irreversible_write','financial_transaction');

-- Shared updated_at helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END; $$;

-- Organizations
CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  industry text NOT NULL DEFAULT '' CHECK (char_length(industry) <= 120),
  support_agent_count integer NOT NULL DEFAULT 0 CHECK (support_agent_count >= 0),
  monthly_ticket_volume integer NOT NULL DEFAULT 0 CHECK (monthly_ticket_volume >= 0),
  support_channels text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
CREATE INDEX organizations_owner_idx ON public.organizations(owner_user_id);
CREATE POLICY "org_select_own" ON public.organizations FOR SELECT TO authenticated USING (owner_user_id = auth.uid());
CREATE POLICY "org_insert_own" ON public.organizations FOR INSERT TO authenticated WITH CHECK (owner_user_id = auth.uid());
CREATE POLICY "org_update_own" ON public.organizations FOR UPDATE TO authenticated USING (owner_user_id = auth.uid()) WITH CHECK (owner_user_id = auth.uid());
CREATE POLICY "org_delete_own" ON public.organizations FOR DELETE TO authenticated USING (owner_user_id = auth.uid());
CREATE TRIGGER organizations_updated_at BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Workflows
CREATE TABLE public.workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  category public.workflow_category NOT NULL,
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 2000),
  current_process text NOT NULL DEFAULT '' CHECK (char_length(current_process) <= 4000),
  monthly_volume integer NOT NULL CHECK (monthly_volume >= 0),
  aht_minutes numeric(8,2) NOT NULL CHECK (aht_minutes > 0),
  required_systems text[] NOT NULL DEFAULT '{}',
  action_type public.action_type NOT NULL,
  handles_account_access boolean NOT NULL DEFAULT false,
  accesses_sensitive_data boolean NOT NULL DEFAULT false,
  attributes_version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workflows TO authenticated;
GRANT ALL ON public.workflows TO service_role;
ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;
CREATE INDEX workflows_org_idx ON public.workflows(organization_id);
CREATE INDEX workflows_owner_idx ON public.workflows(owner_user_id);
CREATE POLICY "wf_select_own" ON public.workflows FOR SELECT TO authenticated USING (owner_user_id = auth.uid());
CREATE POLICY "wf_insert_own" ON public.workflows FOR INSERT TO authenticated WITH CHECK (
  owner_user_id = auth.uid()
  AND EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = organization_id AND o.owner_user_id = auth.uid())
);
CREATE POLICY "wf_update_own" ON public.workflows FOR UPDATE TO authenticated USING (owner_user_id = auth.uid()) WITH CHECK (
  owner_user_id = auth.uid()
  AND EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = organization_id AND o.owner_user_id = auth.uid())
);
CREATE POLICY "wf_delete_own" ON public.workflows FOR DELETE TO authenticated USING (owner_user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.workflows_before_update()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.owner_user_id <> OLD.owner_user_id OR NEW.organization_id <> OLD.organization_id THEN
    RAISE EXCEPTION 'workflow ownership and organization are immutable';
  END IF;
  -- Clients cannot set the version directly; it only moves when attributes change.
  NEW.attributes_version := OLD.attributes_version;
  IF NEW.monthly_volume IS DISTINCT FROM OLD.monthly_volume
     OR NEW.aht_minutes IS DISTINCT FROM OLD.aht_minutes
     OR NEW.action_type IS DISTINCT FROM OLD.action_type
     OR NEW.handles_account_access IS DISTINCT FROM OLD.handles_account_access
     OR NEW.accesses_sensitive_data IS DISTINCT FROM OLD.accesses_sensitive_data THEN
    NEW.attributes_version := OLD.attributes_version + 1;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END; $$;
CREATE TRIGGER workflows_before_update BEFORE UPDATE ON public.workflows FOR EACH ROW EXECUTE FUNCTION public.workflows_before_update();

CREATE OR REPLACE FUNCTION public.workflows_before_insert()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.attributes_version := 1; RETURN NEW; END; $$;
CREATE TRIGGER workflows_before_insert BEFORE INSERT ON public.workflows FOR EACH ROW EXECUTE FUNCTION public.workflows_before_insert();

-- Immutable assessment snapshots (inputs + derived results in one row)
CREATE TABLE public.assessment_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL,
  revision integer NOT NULL CHECK (revision >= 1),
  workflow_attributes_version integer NOT NULL,
  workflow_attributes jsonb NOT NULL,
  inputs jsonb NOT NULL,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  scoring_version text NOT NULL,
  results jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT assessment_snapshots_workflow_revision_key UNIQUE (workflow_id, revision)
);
-- Browser roles may only read. Writes go exclusively through the trusted server path (service_role).
GRANT SELECT ON public.assessment_snapshots TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.assessment_snapshots TO service_role;
ALTER TABLE public.assessment_snapshots ENABLE ROW LEVEL SECURITY;
CREATE INDEX assessment_snapshots_wf_rev_idx ON public.assessment_snapshots(workflow_id, revision DESC);
CREATE INDEX assessment_snapshots_owner_idx ON public.assessment_snapshots(owner_user_id);
CREATE POLICY "snap_select_own" ON public.assessment_snapshots FOR SELECT TO authenticated USING (owner_user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.assessment_snapshots_forbid_update()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN RAISE EXCEPTION 'assessment snapshots are immutable'; END; $$;
CREATE TRIGGER assessment_snapshots_forbid_update BEFORE UPDATE ON public.assessment_snapshots FOR EACH ROW EXECUTE FUNCTION public.assessment_snapshots_forbid_update();

-- Defense in depth on insert: owner must match the workflow owner, revision must be next, attributes version must be current.
CREATE OR REPLACE FUNCTION public.assessment_snapshots_before_insert()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE wf record; max_rev integer;
BEGIN
  SELECT owner_user_id, attributes_version INTO wf FROM public.workflows WHERE id = NEW.workflow_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'workflow not found'; END IF;
  IF wf.owner_user_id <> NEW.owner_user_id THEN RAISE EXCEPTION 'snapshot owner does not match workflow owner'; END IF;
  IF wf.attributes_version <> NEW.workflow_attributes_version THEN
    RAISE EXCEPTION 'workflow attributes changed during save' USING ERRCODE = '40001';
  END IF;
  SELECT COALESCE(MAX(revision), 0) INTO max_rev FROM public.assessment_snapshots WHERE workflow_id = NEW.workflow_id;
  IF NEW.revision <> max_rev + 1 THEN
    RAISE EXCEPTION 'stale base revision' USING ERRCODE = '23505';
  END IF;
  NEW.created_at := now();
  RETURN NEW;
END; $$;
CREATE TRIGGER assessment_snapshots_before_insert BEFORE INSERT ON public.assessment_snapshots FOR EACH ROW EXECUTE FUNCTION public.assessment_snapshots_before_insert();
