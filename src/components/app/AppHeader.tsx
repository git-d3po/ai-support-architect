import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";

const linkCls = "rounded px-2.5 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground";
const active = { className: "rounded px-2.5 py-1.5 text-sm bg-accent text-foreground font-medium" };

export function AppHeader() {
  const { session, ready } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }
  return (
    <header className="sticky top-0 z-20 border-b bg-card/95 backdrop-blur">
      <div className="mx-auto flex min-h-12 max-w-[1400px] flex-wrap items-center gap-x-6 gap-y-1 px-4 py-2 sm:px-6">
        <Link to="/" className="flex items-center gap-2 whitespace-nowrap text-sm font-semibold">
          <span className="grid size-6 place-items-center rounded bg-primary text-[10px] font-bold text-primary-foreground">SA</span>
          Support Automation Architect
        </Link>
        <nav className="order-3 flex w-full items-center gap-1 overflow-x-auto md:order-none md:w-auto" aria-label="Primary">
          <span className="eyebrow mr-1">Demo</span>
          <Link to="/" className={linkCls} activeOptions={{ exact: true }} activeProps={active}>Overview</Link>
          <Link to="/demo/workflows" className={linkCls} activeProps={active}>Workflows</Link>
          <span className="mx-2 h-4 w-px bg-border" />
          <Link to="/workspace" className={linkCls} activeProps={active}>My workspace</Link>
        </nav>
        <div className="ml-auto flex items-center gap-3 text-sm">
          {ready && session ? (
            <>
              <span className="hidden text-xs text-muted-foreground sm:inline">{session.user.email}</span>
              <button onClick={signOut} className="rounded border px-2.5 py-1 text-xs hover:bg-accent">Sign out</button>
            </>
          ) : ready ? (
            <Link to="/auth" className="rounded border px-2.5 py-1 text-xs hover:bg-accent">Sign in</Link>
          ) : null}
        </div>
      </div>
    </header>
  );
}
