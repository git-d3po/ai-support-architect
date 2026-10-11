-- 40001 (serialization_failure) is auto-retried by the Data API, causing hangs. Use a non-retryable app-specific SQLSTATE.
CREATE OR REPLACE FUNCTION public.assessment_snapshots_before_insert()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE wf record; max_rev integer;
BEGIN
  SELECT owner_user_id, attributes_version INTO wf FROM public.workflows WHERE id = NEW.workflow_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'workflow not found'; END IF;
  IF wf.owner_user_id <> NEW.owner_user_id THEN RAISE EXCEPTION 'snapshot owner does not match workflow owner'; END IF;
  IF wf.attributes_version <> NEW.workflow_attributes_version THEN
    RAISE EXCEPTION 'workflow attributes changed during save' USING ERRCODE = 'P0409';
  END IF;
  SELECT COALESCE(MAX(revision), 0) INTO max_rev FROM public.assessment_snapshots WHERE workflow_id = NEW.workflow_id;
  IF NEW.revision <> max_rev + 1 THEN
    RAISE EXCEPTION 'stale base revision' USING ERRCODE = '23505';
  END IF;
  NEW.created_at := now();
  RETURN NEW;
END; $$;
