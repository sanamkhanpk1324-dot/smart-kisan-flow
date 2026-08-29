import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { LogOut, UserRound } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { fetchMyBookings, fetchPayments } from "@/lib/queries";
import { stageLabel, timeLabel } from "@/lib/kq";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Farmer profile — KisanQueue" },
      { name: "description", content: "View and update your farmer details, booking history and payment history." },
      { property: "og:title", content: "Farmer profile — KisanQueue" },
      { property: "og:description", content: "Your Farmer ID, village, crop details and full procurement history." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { t, lang } = useI18n();
  const { user, profile, isAdmin, setProfile } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const uid = user?.id;
  const [busy, setBusy] = useState(false);

  const bookings = useQuery({ queryKey: ["bookings", uid], queryFn: () => fetchMyBookings(uid!), enabled: !!uid });
  const payments = useQuery({ queryKey: ["payments", uid], queryFn: () => fetchPayments(uid!), enabled: !!uid });

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!uid) return;
    const form = new FormData(e.currentTarget);
    const patch = {
      full_name: String(form.get("full_name") ?? "").trim(),
      village: String(form.get("village") ?? "").trim(),
      district: String(form.get("district") ?? "").trim(),
      crop: String(form.get("crop") ?? "").trim(),
      land_size: Number(form.get("land_size") ?? 0),
    };
    setBusy(true);
    const { error } = await supabase.from("profiles").update(patch).eq("id", uid);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setProfile(profile ? { ...profile, ...patch } : null);
    toast.success(lang === "hi" ? "प्रोफ़ाइल सहेजी गई" : "Profile saved");
  }

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", search: { mode: "login" }, replace: true });
  }

  return (
    <AppShell isAdmin={isAdmin}>
      <h1 className="flex items-center gap-2 text-2xl font-extrabold">
        <UserRound className="size-6 text-primary" /> {t("profile")}
      </h1>

      <form onSubmit={save} className="surface-card mt-4 space-y-4 p-5">
        <div className="rounded-lg bg-secondary p-3 text-sm">
          <span className="text-muted-foreground">{t("farmerId")}: </span>
          <span className="token-type font-bold">{profile?.farmer_id ?? "—"}</span>
          <span className="ml-4 text-muted-foreground">{t("mobile")}: </span>
          <span className="font-semibold">{profile?.mobile ?? "—"}</span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <FieldRow label={t("fullName")} name="full_name" defaultValue={profile?.full_name ?? ""} />
          <FieldRow label={t("village")} name="village" defaultValue={profile?.village ?? ""} />
          <FieldRow label={t("district")} name="district" defaultValue={profile?.district ?? ""} />
          <FieldRow label={t("crop")} name="crop" defaultValue={profile?.crop ?? ""} />
          <FieldRow
            label={t("landSize")}
            name="land_size"
            type="number"
            step="0.1"
            defaultValue={String(profile?.land_size ?? 0)}
          />
        </div>
        <Button type="submit" disabled={busy}>
          {t("save")}
        </Button>
      </form>

      <section className="surface-card mt-6 p-5">
        <h2 className="font-semibold">{t("history")}</h2>
        <ul className="mt-3 space-y-2">
          {(bookings.data ?? []).map((b) => {
            const pay = (payments.data ?? []).find((p) => p.booking_id === b.id);
            return (
              <li key={b.id} className="rounded-lg border border-border p-3 text-sm">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="token-type font-bold">{b.token_code}</span>
                  <span>{b.booking_date}</span>
                  <span className="text-muted-foreground">{timeLabel(b.start_time)}</span>
                  <span>
                    {b.crop} · {b.expected_quantity} q
                  </span>
                  <span className="ml-auto rounded-full bg-secondary px-2.5 py-0.5 font-semibold">
                    {stageLabel(b.stage, lang)}
                  </span>
                </div>
                {pay && (
                  <p className="mt-1 text-muted-foreground">
                    {t("paymentStatus")}: {pay.status} · ₹{pay.amount}
                  </p>
                )}
              </li>
            );
          })}
          {(bookings.data ?? []).length === 0 && <li className="text-sm text-muted-foreground">{t("noBooking")}</li>}
        </ul>
      </section>

      <Button variant="outline" className="mt-6" onClick={signOut}>
        <LogOut className="size-4" /> {t("logout")}
      </Button>
    </AppShell>
  );
}

function FieldRow({
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
