import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_permission", { _user_id: userId, _permission: "users.manage" });
  const { data: sa } = await supabase.rpc("has_role", { _user_id: userId, _role: "super_admin" });
  const { data: ad } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data && !sa && !ad) throw new Error("Forbidden");
}

async function assertSuperAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "super_admin" });
  if (!data) throw new Error("Super admin access required");
}

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id,email,display_name,status,created_at,last_login_at")
      .order("created_at", { ascending: false })
      .limit(500);
    const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id,role");
    const { count: wl } = await supabaseAdmin.from("watchlists").select("*", { count: "exact", head: true });
    return {
      users: (profiles ?? []).map((p) => ({
        ...p,
        roles: (roles ?? []).filter((r) => r.user_id === p.id).map((r) => r.role as string),
      })),
      watchlistCount: wl ?? 0,
    };
  });

export const updateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        userId: z.string().uuid(),
        status: z.enum(["active", "banned"]).optional(),
        role: z.enum(["user", "moderator", "admin"]).optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    if (data.userId === context.userId) throw new Error("You cannot change your own account");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: target } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", data.userId);
    if (target?.some((r) => r.role === "super_admin")) throw new Error("Super admin is protected");
    if (data.role) await assertSuperAdmin(context.supabase, context.userId);
    if (data.status) {
      const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
        ban_duration: data.status === "banned" ? "876000h" : "none",
      });
      if (banError) throw banError;
      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .update({ status: data.status, banned_at: data.status === "banned" ? new Date().toISOString() : null })
        .eq("id", data.userId);
      if (profileError) throw profileError;
    }
    if (data.role) {
      const { error: insertError } = await supabaseAdmin.from("user_roles").upsert({ user_id: data.userId, role: data.role }, { onConflict: "user_id,role" });
      if (insertError) throw insertError;
      const { error: deleteError } = await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId).neq("role", data.role);
      if (deleteError) throw deleteError;
    }
    await supabaseAdmin.from("admin_activity_logs").insert({
      admin_id: context.userId,
      action: "user.update",
      target_type: "user",
      target_id: data.userId,
      details: data,
    });
    return { ok: true };
  });

const editableSiteKeys = ["theme_name", "footer_text", "copyright_text", "explore_menu_title", "support_menu_title"] as const;
const editableSeoKeys = ["title", "description", "og_title", "og_description"] as const;

export const getAdminSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [site, seo, logs] = await Promise.all([
      supabaseAdmin.from("site_settings").select("key,value"),
      supabaseAdmin.from("seo_settings").select("key,value"),
      supabaseAdmin.from("admin_activity_logs").select("id,admin_id,action,target_type,target_id,created_at").order("created_at", { ascending: false }).limit(50),
    ]);
    if (site.error || seo.error || logs.error) throw site.error ?? seo.error ?? logs.error;
    return { site: site.data ?? [], seo: seo.data ?? [], logs: logs.data ?? [] };
  });

export const saveAdminSetting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    section: z.enum(["site", "seo"]),
    key: z.string().max(80),
    value: z.string().max(2000),
  }).parse(input))
  .handler(async ({ context, data }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const allowed: readonly string[] = data.section === "site" ? editableSiteKeys : editableSeoKeys;
    if (!allowed.includes(data.key)) throw new Error("Setting cannot be changed");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const table = data.section === "site" ? "site_settings" : "seo_settings";
    const { error } = await supabaseAdmin.from(table).upsert({ key: data.key, value: data.value, updated_by: context.userId, updated_at: new Date().toISOString() });
    if (error) throw error;
    await supabaseAdmin.from("admin_activity_logs").insert({ admin_id: context.userId, action: "setting.update", target_type: table, target_id: data.key, details: { key: data.key } });
    return { ok: true };
  });
