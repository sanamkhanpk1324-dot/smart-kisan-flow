import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const mobileSchema = z.object({
  mobile: z.string().trim().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit mobile number"),
});

const verifySchema = z.object({
  mobile: z.string().trim().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit mobile number"),
  code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit OTP"),
  password: z.string().min(6, "Password must be at least 6 characters").max(72),
});

/**
 * Step 1 — farmer asks for a reset OTP for their registered mobile number.
 * A real SMS gateway is a plug-in module; in this prototype the OTP is
 * returned so the demo can display it on screen.
 */
export const requestPasswordOtp = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => mobileSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("mobile", data.mobile)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!profile) {
      return { ok: false as const, error: "No account is registered with this mobile number" };
    }

    const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { count } = await supabaseAdmin
      .from("password_resets")
      .select("id", { count: "exact", head: true })
      .eq("mobile", data.mobile)
      .gte("created_at", since);
    if ((count ?? 0) >= 5) {
      return { ok: false as const, error: "Too many OTP requests. Please try again later." };
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const { error } = await supabaseAdmin.from("password_resets").insert({
      mobile: data.mobile,
      code,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    });
    if (error) return { ok: false as const, error: error.message };

    // Prototype delivery channel: SMS/WhatsApp integration slots in here.
    return { ok: true as const, demoCode: code };
  });

/** Step 2 — verify the OTP and set a new password. */
export const resetPasswordWithOtp = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => verifySchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: row } = await supabaseAdmin
      .from("password_resets")
      .select("*")
      .eq("mobile", data.mobile)
      .eq("used", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!row) return { ok: false as const, error: "Request a new OTP first" };
    if (new Date(row.expires_at).getTime() < Date.now()) {
      return { ok: false as const, error: "This OTP has expired. Request a new one." };
    }
    if (row.attempts >= 5) return { ok: false as const, error: "Too many wrong attempts. Request a new OTP." };
    if (row.code !== data.code) {
      await supabaseAdmin
        .from("password_resets")
        .update({ attempts: row.attempts + 1 })
        .eq("id", row.id);
      return { ok: false as const, error: "Incorrect OTP" };
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("mobile", data.mobile)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!profile) return { ok: false as const, error: "No account is registered with this mobile number" };

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(profile.id, {
      password: data.password,
    });
    if (updateError) return { ok: false as const, error: updateError.message };

    await supabaseAdmin.from("password_resets").update({ used: true }).eq("id", row.id);
    return { ok: true as const };
  });
