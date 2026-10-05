import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Set new password — Cineflex" },
      { name: "description", content: "Choose a new password for your Cineflex account." },
      { property: "og:title", content: "Set new password — Cineflex" },
      { property: "og:description", content: "Choose a new password for your Cineflex account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Reset,
});

function Reset() {
  const nav = useNavigate();
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState("");
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) return setMsg(error.message);
    nav({ to: "/account" });
  }
  return (
    <div className="cine-account flex min-h-screen items-center justify-center px-5">
      <form onSubmit={save} className="w-full max-w-md space-y-4 rounded-lg border border-border bg-card p-8">
        <h1 className="text-2xl font-bold">Set new password</h1>
        <input type="password" minLength={8} required value={pw} onChange={(e) => setPw(e.target.value)} placeholder="New password" className="w-full rounded-md border border-border bg-muted px-4 py-3" />
         <Button className="h-11 w-full font-bold">Save</Button>
        {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
      </form>
    </div>
  );
}
