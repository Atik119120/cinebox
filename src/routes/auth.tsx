import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Cineflex" },
      { name: "description", content: "Sign in or create your Cineflex account." },
      { property: "og:title", content: "Sign in — Cineflex" },
      { property: "og:description", content: "Sign in or create your Cineflex account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const nav = useNavigate();
  const [mode, setMode] = useState<"in" | "up" | "reset">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => data.user && nav({ to: "/account" }));
  }, [nav]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    try {
      if (mode === "in") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        nav({ to: "/account" });
      } else if (mode === "up") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + "/account", data: { name } },
        });
        if (error) throw error;
        setMsg("Check your email to confirm your account.");
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + "/reset-password",
        });
        if (error) throw error;
        setMsg("Password reset link sent to your email.");
      }
    } catch (err: any) {
      setMsg(err.message ?? "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  const input = "w-full rounded-md border border-border bg-muted px-4 py-3 outline-none focus:ring-2 focus:ring-primary";
  return (
    <div className="cine-account relative flex min-h-screen items-center justify-center px-5 py-20">
      <Button asChild variant="ghost" size="icon" className="absolute left-5 top-5" title="Back to movies" aria-label="Back to movies"><Link to="/"><ArrowLeft /></Link></Button>
      <div className="w-full max-w-md rounded-md border border-border bg-card p-6 shadow-lg sm:p-8">
        <a href="/" className="text-2xl font-black">
          CINE<span className="text-primary">BOX</span>
        </a>
        <h1 className="mt-6 text-2xl font-bold">
          {mode === "in" ? "Welcome back" : mode === "up" ? "Create account" : "Reset password"}
        </h1>
        <form onSubmit={submit} className="mt-6 space-y-3">
           {mode === "up" && <input className={input} aria-label="Name" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required />}
           <input className={input} aria-label="Email" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          {mode !== "reset" && (
             <input className={input} aria-label="Password" type="password" minLength={8} placeholder="Password (min 8)" value={password} onChange={(e) => setPassword(e.target.value)} required />
          )}
           <Button disabled={busy} className="h-11 w-full font-bold">
            {busy ? "Please wait…" : mode === "in" ? "Sign in" : mode === "up" ? "Sign up" : "Send link"}
           </Button>
        </form>
        {mode !== "reset" && (
           <Button variant="outline"
            onClick={() => lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/auth" })}
             className="mt-3 h-11 w-full font-semibold"
          >
            Continue with Google
           </Button>
        )}
        {msg && <p className="mt-4 text-sm text-muted-foreground">{msg}</p>}
        <div className="mt-6 flex justify-between text-sm text-muted-foreground">
           <Button variant="link" className="px-0 text-muted-foreground" onClick={() => setMode(mode === "in" ? "up" : "in")}>{mode === "in" ? "Create account" : "Sign in"}</Button>
           <Button variant="link" className="px-0 text-muted-foreground" onClick={() => setMode("reset")}>Forgot password?</Button>
        </div>
      </div>
    </div>
  );
}
