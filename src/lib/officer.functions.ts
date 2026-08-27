import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const schema = z.object({ code: z.string().trim().min(4).max(64) });

/**
 * Grants the centre-officer (admin) role when the caller supplies the correct
 * access code. The code lives in a server-side secret, never in client code.
 */
export const claimOfficerRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => schema.parse(data))
  .handler(async ({ data, context }) => {
    const expected = process.env["OFFICER_ACCESS_CODE"];
    if (!expected || data.code !== expected) {
      return { ok: false as const, error: "Invalid centre access code" };
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: context.userId, role: "admin" }, { onConflict: "user_id,role" });
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });
