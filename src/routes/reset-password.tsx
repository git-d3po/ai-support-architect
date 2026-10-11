import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { validateNewPassword } from "@/lib/password-policy";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Set a new password — Support Automation Architect" },
      { name: "description", content: "Choose a new password for your Support Automation Architect account." },
      { property: "og:title", content: "Set a new password — Support Automation Architect" },
      { property: "og:description", content: "Complete password recovery for your workspace account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPasswordPage,
});

type Phase = "checking" | "ready" | "invalid" | "done";

function ResetPasswordPage() {
  const [phase, setPhase] = useState<Phase>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const query = new URLSearchParams(window.location.search);
    const linkError = hash.get("error") || query.get("error");
    const isRecovery = hash.get("type") === "recovery" || query.has("code");
    // Strip tokens from the address bar so they are not kept in history or shared screenshots.
    if (window.location.hash || window.location.search) window.history.replaceState(null, "", window.location.pathname);
    if (linkError) { setPhase("invalid"); return; }

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setPhase("ready");
    });
    const t = window.setTimeout(async () => {
      const { data } = await supabase.auth.getSession();
      setPhase((p) => (p !== "checking" ? p : data.session && isRecovery ? "ready" : "invalid"));
    }, 1200);
    return () => { sub.subscription.unsubscribe(); window.clearTimeout(t); };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const problem = validateNewPassword(password, confirm);
    if (problem) { setError(problem); return; }
    setBusy(true); setError(null);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      if (/session|expired|jwt|token/i.test(error.message)) setPhase("invalid");
      else setError(error.message.includes("weak") || error.message.includes("pwned") ? "That password is too weak or has appeared in a data breach. Choose a different one." : "Could not update your password. Please try again.");
      return;
    }
    await supabase.auth.signOut();
    setPhase("done");
  }

  return (
    <div className="mx-auto mt-10 max-w-sm">
      <div className="panel p-6">
        <h1 className="text-lg font-semibold">Set a new password</h1>
        {phase === "checking" && <p role="status" className="mt-3 text-xs text-muted-foreground">Checking your recovery link…</p>}
        {phase === "invalid" && (
          <div role="alert" className="mt-3 space-y-3 text-xs">
            <p>This recovery link is invalid, expired or has already been used. Request a new one to continue.</p>
            <Link to="/auth" className="link-subtle text-sm">Request a new reset link</Link>
          </div>
        )}
        {phase === "done" && (
          <div role="status" className="mt-3 space-y-3 text-xs">
            <p>Your password has been changed. Sign in with your new password to return to your workspace.</p>
            <button onClick={() => navigate({ to: "/auth" })} className="h-9 w-full rounded bg-primary text-sm font-medium text-primary-foreground">Go to sign in</button>
          </div>
        )}
        {phase === "ready" && (
          <form onSubmit={submit} className="mt-4 space-y-3">
            <label className="block text-sm"><span className="eyebrow mb-1 block">New password</span>
              <input type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-9 w-full rounded border bg-card px-2" aria-describedby="pw-hint" /></label>
            <p id="pw-hint" className="text-xs text-muted-foreground">At least 8 characters.</p>
            <label className="block text-sm"><span className="eyebrow mb-1 block">Confirm new password</span>
              <input type="password" required minLength={8} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="h-9 w-full rounded border bg-card px-2" /></label>
            {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
            <button disabled={busy} className="h-9 w-full rounded bg-primary text-sm font-medium text-primary-foreground disabled:opacity-60">{busy ? "Saving…" : "Save new password"}</button>
          </form>
        )}
      </div>
    </div>
  );
}
