import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Support Automation Architect" },
      { name: "description", content: "Sign in to save private workflow assessments for your support organization." },
      { property: "og:title", content: "Sign in — Support Automation Architect" },
      { property: "og:description", content: "Create a private workspace to assess and save your own support workflows." },
    ],
  }),
  component: AuthPage,
});

const RECOVERY_NOTICE = "If an email/password account exists for that address, a reset link is on its way. The link is time-limited; check spam if it doesn't arrive in a few minutes.";

function AuthPage() {
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { session } = useAuth();
  const navigate = useNavigate();
  useEffect(() => { if (session) navigate({ to: "/workspace", replace: true }); }, [session, navigate]);

  function switchMode(m: typeof mode) { setMode(m); setNotice(null); setError(null); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setNotice(null); setError(null);
    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/reset-password` });
        // Neutral message regardless of whether the account exists; only surface rate limits / network failures.
        if (error && (error.status === 429 || /rate limit/i.test(error.message))) {
          setError("Too many reset requests. Please wait a few minutes and try again.");
        } else if (error && !error.status) {
          setError("Could not send the request. Check your connection and try again.");
        } else {
          setNotice(RECOVERY_NOTICE);
        }
      } else if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/workspace` } });
        if (error) throw error;
        if (!data.session) setNotice("Check your email to confirm your account, then sign in.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign-in failed");
    } finally { setBusy(false); }
  }

  async function google() {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (r.error) toast.error("Google sign-in failed");
  }

  const title = mode === "signin" ? "Sign in to your workspace" : mode === "signup" ? "Create a workspace account" : "Reset your password";

  return (
    <div className="mx-auto mt-10 max-w-sm">
      <div className="panel p-6">
        <h1 className="text-lg font-semibold">{title}</h1>
        {mode === "forgot" ? (
          <p className="mt-1 text-xs text-muted-foreground">Enter the email you use to sign in. We'll send a link to set a new password. Accounts that only use Google sign-in should keep using "Continue with Google".</p>
        ) : (
          <>
            <p className="mt-1 text-xs text-muted-foreground">Your organization, workflows and assessments are private to your account. The Northstar demo needs no account.</p>
            <button onClick={google} className="mt-5 h-9 w-full rounded border text-sm font-medium hover:bg-accent">Continue with Google</button>
            <div className="my-4 flex items-center gap-3 text-[13px] text-muted-foreground"><span className="h-px flex-1 bg-border" />or<span className="h-px flex-1 bg-border" /></div>
          </>
        )}
        <form onSubmit={submit} className={mode === "forgot" ? "mt-4 space-y-3" : "space-y-3"} noValidate={false}>
          <label className="block text-sm"><span className="eyebrow mb-1 block">Email</span>
            <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-9 w-full rounded border bg-card px-2" /></label>
          {mode !== "forgot" && (
            <div className="text-sm">
              <div className="mb-1 flex items-baseline justify-between">
                <label htmlFor="auth-password" className="eyebrow">Password</label>
                {mode === "signin" && (
                  <button type="button" onClick={() => switchMode("forgot")} className="link-subtle py-1 text-xs">Forgot password?</button>
                )}
              </div>
              <input id="auth-password" type="password" required minLength={8} autoComplete={mode === "signin" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} className="h-9 w-full rounded border bg-card px-2" />
            </div>
          )}
          <button disabled={busy} className="h-9 w-full rounded bg-primary text-sm font-medium text-primary-foreground disabled:opacity-60">
            {mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : busy ? "Sending…" : "Send reset link"}
          </button>
        </form>
        {notice && <p role="status" className="mt-3 text-xs">{notice}</p>}
        {error && <p role="alert" className="mt-3 text-xs text-destructive">{error}</p>}
        {mode === "forgot" ? (
          <button onClick={() => switchMode("signin")} className="mt-4 text-xs text-muted-foreground underline">Back to sign in</button>
        ) : (
          <button onClick={() => switchMode(mode === "signin" ? "signup" : "signin")} className="mt-4 text-xs text-muted-foreground underline">
            {mode === "signin" ? "New here? Create an account" : "Have an account? Sign in"}
          </button>
        )}
      </div>
    </div>
  );
}
