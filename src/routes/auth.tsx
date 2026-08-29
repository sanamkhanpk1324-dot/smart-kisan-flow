import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Sprout, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { mobileToEmail } from "@/hooks/useAuth";
import { claimOfficerRole } from "@/lib/officer.functions";
import { useI18n } from "@/lib/i18n";
import { LanguageToggle } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { crops } from "@/lib/kq";

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({
    mode: search["mode"] === "login" ? ("login" as const) : ("register" as const),
  }),
  head: () => ({
    meta: [
      { title: "Login or register — KisanQueue" },
      {
        name: "description",
        content: "Farmers register once with Farmer ID and mobile number, then log in to book procurement slots.",
      },
      { property: "og:title", content: "Login or register — KisanQueue" },
      { property: "og:description", content: "Secure farmer login for procurement slot booking and payment tracking." },
    ],
  }),
  component: AuthPage,
});

const registerSchema = z.object({
  full_name: z.string().trim().min(2, "Enter your full name").max(80),
  mobile: z.string().trim().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit mobile number"),
  farmer_id: z.string().trim().min(4, "Farmer ID must be at least 4 characters").max(24),
  village: z.string().trim().min(2, "Enter your village").max(60),
  district: z.string().trim().min(2, "Enter your district").max(60),
  crop: z.string().trim().min(2).max(40),
  land_size: z.coerce.number().min(0).max(1000),
  password: z.string().min(6, "Password must be at least 6 characters").max(72),
});

function AuthPage() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const { mode } = Route.useSearch();
  const [tab, setTab] = useState<"login" | "register">(mode);
  const [busy, setBusy] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const mobile = String(form.get("mobile") ?? "").trim();
    const password = String(form.get("password") ?? "");
    if (!/^[6-9]\d{9}$/.test(mobile)) {
      toast.error(lang === "hi" ? "सही मोबाइल नंबर डालें" : "Enter a valid 10-digit mobile number");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: mobileToEmail(mobile),
      password,
    });
    setBusy(false);
    if (error) {
      toast.error(lang === "hi" ? "मोबाइल या पासवर्ड ग़लत है" : "Incorrect mobile number or password");
      return;
    }
    toast.success(lang === "hi" ? "स्वागत है" : "Welcome back");
    navigate({ to: "/dashboard", replace: true });
  }

  async function handleRegister(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const raw = Object.fromEntries(form.entries());
    const parsed = registerSchema.safeParse(raw);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Please check your details");
      return;
    }
    const values = parsed.data;
    const officerCode = String(raw["officer_code"] ?? "").trim();
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email: mobileToEmail(values.mobile),
      password: values.password,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error || !data.user) {
      setBusy(false);
      toast.error(
        error?.message?.includes("already")
          ? lang === "hi"
            ? "यह मोबाइल नंबर पहले से पंजीकृत है"
            : "This mobile number is already registered"
          : (error?.message ?? "Registration failed"),
      );
      return;
    }

    const { error: profileError } = await supabase.from("profiles").insert({
      id: data.user.id,
      full_name: values.full_name,
      mobile: values.mobile,
      farmer_id: values.farmer_id,
      village: values.village,
      district: values.district,
      crop: values.crop,
      land_size: values.land_size,
      language: lang,
    });
    if (profileError) {
      setBusy(false);
      toast.error(
        profileError.message.includes("duplicate")
          ? lang === "hi"
            ? "यह किसान आईडी पहले से मौजूद है"
            : "That Farmer ID is already registered"
          : profileError.message,
      );
      return;
    }

    if (officerCode) {
      const res = await claimOfficerRole({ data: { code: officerCode } });
      if (!res.ok) toast.error(res.error);
      else toast.success(lang === "hi" ? "केंद्र अधिकारी पहुँच मिली" : "Centre officer access granted");
    }

    await supabase.from("notifications").insert({
      user_id: data.user.id,
      title: lang === "hi" ? "किसानक्यू में स्वागत है" : "Welcome to KisanQueue",
      message:
        lang === "hi"
          ? "अपना पहला खरीद स्लॉट बुक करें और डिजिटल टोकन पाएँ।"
          : "Book your first procurement slot and get a digital token.",
      category: "general",
    });

    setBusy(false);
    toast.success(lang === "hi" ? "पंजीकरण पूरा हुआ" : "Registration complete");
    navigate({ to: "/dashboard", replace: true });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-5">
        <Link to="/" className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-xl bg-field text-primary-foreground">
            <Sprout className="size-5" />
          </span>
          <span className="font-display text-lg font-extrabold">{t("appName")}</span>
        </Link>
        <div className="ml-auto">
          <LanguageToggle />
        </div>
      </header>

      <div className="mx-auto max-w-xl px-4 pb-16">
        <h1 className="text-3xl font-extrabold">{tab === "login" ? t("login") : t("register")}</h1>
        <p className="mt-1 text-muted-foreground">
          {lang === "hi"
            ? "मोबाइल नंबर और पासवर्ड से सुरक्षित लॉगिन।"
            : "Secure login with your mobile number and password."}
        </p>

        <Tabs value={tab} onValueChange={(v) => setTab(v as "login" | "register")} className="mt-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">{t("login")}</TabsTrigger>
            <TabsTrigger value="register">{t("register")}</TabsTrigger>
          </TabsList>

          <TabsContent value="login">
            <form onSubmit={handleLogin} className="surface-card mt-4 space-y-4 p-5">
              <Field label={t("mobile")} name="mobile" inputMode="numeric" placeholder="9876543210" required />
              <Field label={t("password")} name="password" type="password" required />
              <Button type="submit" size="lg" className="w-full" disabled={busy}>
                {t("login")}
              </Button>
              <button
                type="button"
                className="w-full text-sm font-semibold text-primary underline-offset-4 hover:underline"
                onClick={() => setForgotOpen((v) => !v)}
              >
                {lang === "hi" ? "पासवर्ड भूल गए?" : "Forgot password?"}
              </button>
            </form>

            {forgotOpen && <ForgotPassword onDone={() => setForgotOpen(false)} />}
          </TabsContent>

          <TabsContent value="register">
            <form onSubmit={handleRegister} className="surface-card mt-4 space-y-4 p-5">
              <Field label={t("fullName")} name="full_name" required />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t("mobile")} name="mobile" inputMode="numeric" placeholder="9876543210" required />
                <Field label={t("farmerId")} name="farmer_id" placeholder="HR-KRN-10234" required />
                <Field label={t("village")} name="village" required />
                <Field label={t("district")} name="district" required />
                <div className="space-y-1.5">
                  <Label htmlFor="crop">{t("crop")}</Label>
                  <select
                    id="crop"
                    name="crop"
                    required
                    className="h-11 w-full rounded-md border border-input bg-background px-3 text-base"
                  >
                    {crops().map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <Field label={t("landSize")} name="land_size" type="number" step="0.1" defaultValue="2" required />
              </div>
              <Field label={t("password")} name="password" type="password" required />
              <details className="rounded-lg border border-border p-3">
                <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
                  <ShieldCheck className="size-4" />
                  {lang === "hi" ? "केंद्र अधिकारी हैं? एक्सेस कोड डालें" : "Centre officer? Enter access code"}
                </summary>
                <div className="mt-3">
                  <Field label={lang === "hi" ? "केंद्र एक्सेस कोड" : "Centre access code"} name="officer_code" />
                </div>
              </details>
              <Button type="submit" size="lg" className="w-full" disabled={busy}>
                {t("register")}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function Field({
  label,
  name,
  ...rest
}: { label: string; name: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} className="h-11 text-base" {...rest} />
    </div>
  );
}
