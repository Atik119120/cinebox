import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { getAdminSettings, listUsers, saveAdminSetting, updateUser } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin — Cineflex" },
      { name: "description", content: "Manage Cineflex users and roles." },
      { property: "og:title", content: "Admin — Cineflex" },
      { property: "og:description", content: "Manage Cineflex users and roles." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Admin,
});

type U = { id: string; email: string | null; display_name: string | null; status: string; created_at: string; roles: string[] };

function Admin() {
  const list = useServerFn(listUsers);
  const update = useServerFn(updateUser);
  const getSettings = useServerFn(getAdminSettings);
  const saveSetting = useServerFn(saveAdminSetting);
  const [users, setUsers] = useState<U[]>([]);
  const [tab, setTab] = useState<"users" | "settings" | "activity">("users");
  const [settings, setSettings] = useState<{ site: {key: string;value: unknown}[]; seo: {key: string;value: unknown}[]; logs: {id:string; action:string;target_type:string|null;target_id:string|null;created_at:string}[] }>({site:[],seo:[],logs:[]});
  const [form, setForm] = useState<Record<string, string>>({});
  const [wl, setWl] = useState(0);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");

  const load = () => list().then((r) => { setUsers(r.users as U[]); setWl(r.watchlistCount); }).catch((e) => setErr(e.message));
  useEffect(() => { load(); getSettings().then((r) => setSettings(r)).catch((e) => setErr(e.message)); }, []);

  async function save(section: "site" | "seo", key: string) {
    try {
      await saveSetting({ data: { section, key, value: form[`${section}:${key}`] ?? "" } });
      setSettings(await getSettings()); setErr("");
    } catch (e) { setErr(e instanceof Error ? e.message : "Could not save"); }
  }

  async function act(data: { userId: string; status?: "active" | "banned"; role?: "user" | "moderator" | "admin" }) {
    try { await update({ data }); load(); } catch (e: any) { setErr(e.message); }
  }

  if (err === "Forbidden") return <div className="cine-account flex min-h-screen items-center justify-center">Access denied. <Link to="/account" className="ml-2 underline">Back</Link></div>;
  const shown = users.filter((u) => `${u.email} ${u.display_name}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="cine-account min-h-screen px-5 py-8 md:px-10">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-black">Admin<span className="text-primary">.</span></h1>
          <div className="flex gap-2 text-sm"><Link to="/account" className="rounded-md border border-border px-4 py-2">My account</Link><a href="/" className="rounded-md border border-border px-4 py-2">Site</a></div>
        </div>
        <div className="mt-8 flex gap-1 border-b border-border" role="tablist" aria-label="Admin sections">
          {(["users", "settings", "activity"] as const).map((section) => <Button key={section} role="tab" aria-selected={tab === section} variant="ghost" onClick={() => setTab(section)} className={`rounded-none capitalize ${tab === section ? "border-b-2 border-primary text-foreground" : "text-muted-foreground"}`}>{section}</Button>)}
        </div>
        {tab === "users" && <><div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          {[["Users", users.length], ["Active", users.filter((u) => u.status === "active").length], ["Banned", users.filter((u) => u.status === "banned").length], ["Watchlist items", wl]].map(([k, v]) => (
            <div key={k} className="rounded-lg border border-border bg-card p-4"><p className="text-sm text-muted-foreground">{k}</p><p className="text-2xl font-bold">{v}</p></div>
          ))}
        </div>
        {err && err !== "Forbidden" && <p className="mt-4 text-sm text-destructive">{err}</p>}
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search users…" className="mt-6 w-full rounded-md border border-border bg-muted px-4 py-2" />
        <div className="mt-4 overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left"><tr><th className="p-3">User</th><th className="p-3">Role</th><th className="p-3">Status</th><th className="p-3">Actions</th></tr></thead>
            <tbody>
              {shown.map((u) => {
                const sa = u.roles.includes("super_admin");
                const role = sa ? "super_admin" : ["admin", "moderator"].find((r) => u.roles.includes(r)) ?? "user";
                return (
                  <tr key={u.id} className="border-t border-border">
                    <td className="p-3"><div className="font-semibold">{u.display_name}</div><div className="text-muted-foreground">{u.email}</div></td>
                    <td className="p-3">
                      {sa ? "Super admin" : (
                         <select aria-label={`Role for ${u.email}`} value={role} onChange={(e) => act({ userId: u.id, role: e.target.value as "user" | "moderator" | "admin" })} className="rounded border border-border bg-muted px-2 py-1">
                          <option value="user">User</option><option value="moderator">Moderator</option><option value="admin">Admin</option>
                        </select>
                      )}
                    </td>
                    <td className="p-3">{u.status}</td>
                    <td className="p-3">
                      {!sa && (
                         <Button variant="outline" size="sm" onClick={() => { if (window.confirm(`${u.status === "banned" ? "Unban" : "Ban"} ${u.email}?`)) act({ userId: u.id, status: u.status === "banned" ? "active" : "banned" }); }}>
                          {u.status === "banned" ? "Unban" : "Ban"}
                         </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        </>}
        {tab === "settings" && <div className="mt-6 grid gap-10 lg:grid-cols-2">
          {(["site", "seo"] as const).map((section) => <section key={section}>
            <h2 className="mb-4 text-xl font-bold capitalize">{section === "site" ? "Site content" : "Search previews"}</h2>
            {(section === "site" ? ["theme_name", "footer_text", "copyright_text", "explore_menu_title", "support_menu_title"] : ["title", "description", "og_title", "og_description"]).map((key) => {
              const saved = settings[section].find((r) => r.key === key)?.value;
              const value = form[`${section}:${key}`] ?? (typeof saved === "string" ? saved : "");
              return <div key={key} className="mb-4"><label className="mb-1 block text-sm capitalize text-muted-foreground" htmlFor={`${section}-${key}`}>{key.replaceAll("_", " ")}</label>
                <div className="flex gap-2"><input id={`${section}-${key}`} value={value} onChange={(e) => setForm((prev) => ({...prev,[`${section}:${key}`]:e.target.value}))} className="min-w-0 flex-1 rounded-md border border-border bg-muted px-3 py-2" /><Button onClick={() => save(section,key)} disabled={value === saved}>Save</Button></div></div>;
            })}
          </section>)}
        </div>}
        {tab === "activity" && <div className="mt-6 overflow-x-auto"><h2 className="mb-4 text-xl font-bold">Recent activity</h2><table className="w-full text-left text-sm"><thead className="text-muted-foreground"><tr><th className="py-2">Date</th><th>Action</th><th>Target</th></tr></thead><tbody>{settings.logs.map((log) => <tr key={log.id} className="border-t border-border"><td className="py-3">{new Date(log.created_at).toLocaleString()}</td><td>{log.action}</td><td>{log.target_type} {log.target_id}</td></tr>)}</tbody></table></div>}
      </div>
    </div>
  );
}
