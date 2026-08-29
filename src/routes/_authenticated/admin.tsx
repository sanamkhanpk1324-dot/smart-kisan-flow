import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Shield } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { fetchCentreQueue, fetchCentres, notify } from "@/lib/queries";
import { STAGES, stageLabel, timeLabel, todayISO } from "@/lib/kq";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Centre console — KisanQueue" },
      { name: "description", content: "Procurement centre console: today's bookings, live queue and payment updates." },
      { property: "og:title", content: "Centre console — KisanQueue" },
      { property: "og:description", content: "Call the next farmer and update weighing, quality and payment stages." },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const { t, lang } = useI18n();
  const { isAdmin, loading } = useAuth();
  const qc = useQueryClient();
  const today = todayISO();
  const [centreId, setCentreId] = useState<string>("");

  const centres = useQuery({ queryKey: ["centres"], queryFn: fetchCentres });
  const centre = centres.data?.find((c) => c.id === centreId) ?? centres.data?.[0];

  const queue = useQuery({
    queryKey: ["admin-queue", centre?.id, today],
    queryFn: () => fetchCentreQueue(centre!.id, today),
    enabled: !!centre,
  });

  useEffect(() => {
    const channel = supabase
      .channel("admin-queue")
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, () => {
        qc.invalidateQueries({ queryKey: ["admin-queue"] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [qc]);

  if (loading) return null;
  if (!isAdmin) {
    return (
      <AppShell>
        <p className="surface-card p-5 text-sm">
          {lang === "hi" ? "यह पेज केवल केंद्र अधिकारियों के लिए है।" : "This page is for centre officers only."}
        </p>
      </AppShell>
    );
  }

  const rows = queue.data ?? [];
  const waiting = rows.filter((b) => ["booked", "arrived"].includes(b.stage));
  const completed = rows.filter((b) => ["completed", "payment_processing", "payment_completed"].includes(b.stage));
  const cancelled = rows.filter((b) => ["cancelled", "no_show"].includes(b.stage));
  const pendingPay = rows.filter((b) => b.stage === "payment_processing");

  async function setStage(bookingId: string, userId: string, stage: string, token: string) {
    const { error } = await supabase.from("bookings").update({ stage }).eq("id", bookingId);
    if (error) {
      toast.error(error.message);
      return;
    }
    await notify(
      userId,
      lang === "hi" ? "स्थिति अपडेट" : "Status update",
      lang === "hi" ? `टोकन ${token}: ${stageLabel(stage, "hi")}` : `Token ${token}: ${stageLabel(stage, "en")}`,
      "procurement",
    );
    qc.invalidateQueries({ queryKey: ["admin-queue"] });
  }

  async function callNext() {
    const next = waiting[0];
    if (!next || !centre) {
      toast.info(lang === "hi" ? "कतार खाली है" : "Queue is empty");
      return;
    }
    const { error } = await supabase.from("centres").update({ now_serving: next.token_code }).eq("id", centre.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await setStage(next.id, next.user_id, "arrived", next.token_code);
    qc.invalidateQueries({ queryKey: ["centres"] });
    toast.success(`${lang === "hi" ? "अब बुला रहे हैं" : "Now calling"} ${next.token_code}`);
  }

  return (
    <AppShell isAdmin>
      <h1 className="flex items-center gap-2 text-2xl font-extrabold">
        <Shield className="size-6 text-primary" /> {t("admin")}
      </h1>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <select
          value={centre?.id ?? ""}
          onChange={(e) => setCentreId(e.target.value)}
          className="h-11 rounded-md border border-input bg-background px-3 text-base"
        >
          {(centres.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <Button onClick={callNext}>{t("callNext")}</Button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label={lang === "hi" ? "आज की बुकिंग" : "Today's bookings"} value={rows.length} />
        <Stat label={lang === "hi" ? "प्रतीक्षारत किसान" : "Farmers waiting"} value={waiting.length} />
        <Stat label={t("nowServing")} value={centre?.now_serving || "—"} />
        <Stat label={lang === "hi" ? "पूर्ण खरीद" : "Completed"} value={completed.length} />
        <Stat label={lang === "hi" ? "लंबित भुगतान" : "Pending payments"} value={pendingPay.length} />
      </div>
      {cancelled.length > 0 && (
        <p className="mt-2 text-sm text-muted-foreground">
          {lang === "hi" ? "रद्द/अनुपस्थित" : "Cancelled / no-show"}: {cancelled.length}
        </p>
      )}

      <section className="surface-card mt-6 divide-y divide-border">
        {rows.map((b) => (
          <div key={b.id} className="flex flex-wrap items-center gap-3 p-4 text-sm">
            <span className="token-type text-base font-bold">{b.token_code}</span>
            <span className="text-muted-foreground">{timeLabel(b.start_time)}</span>
            <span>
              {b.crop} · {b.expected_quantity} q
            </span>
            <span className="rounded-full bg-secondary px-2.5 py-0.5 font-semibold">{stageLabel(b.stage, lang)}</span>
            <select
              value={b.stage}
              onChange={(e) => void setStage(b.id, b.user_id, e.target.value, b.token_code)}
              className="ml-auto h-9 rounded-md border border-input bg-background px-2"
            >
              {[...STAGES, "cancelled", "no_show"].map((s) => (
                <option key={s} value={s}>
                  {stageLabel(s, lang)}
                </option>
              ))}
            </select>
          </div>
        ))}
        {rows.length === 0 && (
          <p className="p-4 text-sm text-muted-foreground">
            {lang === "hi" ? "आज कोई बुकिंग नहीं है।" : "No bookings today."}
          </p>
        )}
      </section>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="surface-card p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-extrabold">{value}</p>
    </div>
  );
}
