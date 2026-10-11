-- Default privileges granted broader access than intended. Lock down explicitly.
REVOKE ALL ON public.organizations FROM anon;
REVOKE ALL ON public.workflows FROM anon;
REVOKE ALL ON public.assessment_snapshots FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.assessment_snapshots FROM authenticated;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.organizations FROM authenticated;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.workflows FROM authenticated;
GRANT SELECT ON public.assessment_snapshots TO authenticated;
REVOKE UPDATE, TRUNCATE ON public.assessment_snapshots FROM service_role;
