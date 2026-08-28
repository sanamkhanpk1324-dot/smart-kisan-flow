import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { activeBooking, fetchCentreQueue, fetchCentres, fetchMyBookings, notify } from "@/lib/queries";
import { formatMinutes, predictWait, stageLabel, timeLabel, todayISO } from "@/lib/kq";

export const Route = createFileRoute("/_authenticated/queue")({
  head: () => ({
    meta: [
      { title: "Live queue & digital token — KisanQueue" },
      { name: "description", content: "See your token, who is being served now, farmers ahead and estimated wait." },
      { property: "og:title", content: "Live queue & digital token — KisanQueue" },
      { property: "og:description", content: "Real-time queue tracking with a QR check-in token." },
    ],
  }),
  component: QueuePage,
});

function QueuePage() {
  const { t, lang } = useI18n();
  const { user, profile, isAdmin } = useAuth();
  const qc = useQueryClient();
  const uid = user?.id;

  const centres = useQuery({ queryKey: ["centres"], queryFn: fetchCentres });
  const bookings = useQuery({ queryKey: ["bookings", uid], queryFn: () => fetchMyBookings(uid!), enabled: !!uid });
  const booking = activeBooking(bookings.data ?? []);
  const centre = centres.data?.find((c) => c.id === booking?.centre_id);
  const queue = useQuery({
    queryKey: ["queue", booking?.centre_id, booking?.booking_date],
    queryFn: () => fetchCentreQueue(booking!.centre_id, booking!.booking_date),
    enabled: !!booking,
  });

  useEffect(() => {
    const channel = supabase
      .channel("live-queue")
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, () => {
        qc.invalidateQueries({ queryKey: ["queue"] });
        qc.invalidateQueries({ queryKey: ["bookings", uid] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "centres" }, () =>
        qc.invalidateQueries({ queryKey: ["centres"] }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [qc, uid]);

  if (!booking) {
    return (
      <AppShell isAdmin={isAdmin}>
        <div className="surface-card p-8 text-center">
          <p className="text-lg font-semibold">{t("noBooking")}</p>
          <Button asChild className="mt-4">
            <Link to="/book">{t("bookSlot")}</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  const list = queue.data ?? [];
  const ahead = list.filter((b) => b.queue_number < booking.queue_number && ["booked", "arrived"].includes(b.stage));
  const wait = predictWait({
    peopleAhead: ahead.length,
    avgMinutes: centre?.avg_minutes_per_farmer ?? 6,
    capacityPerSlot: centre?.capacity_per_slot ?? 10,
  });
  const isToday = booking.booking_date === todayISO();

  const qrPayload = JSON.stringify({
    farmerId: profile?.farmer_id,
    bookingId: booking.id,
    centre: centre?.code,
    date: booking.booking_date,
    time: booking.start_time,
    token: booking.token_code,
    queue: booking.queue_number,
  });

  async function checkIn() {
    if (!booking || !uid) return;
    const { error } = await supabase.from("bookings").update({ stage: "arrived" }).eq("id", booking.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await notify(
      uid,
      lang === "hi" ? "चेक-इन हो गया" : "Checked in",
      lang === "hi" ? `टोकन ${booking.token_code} केंद्र पर दर्ज।` : `Token ${booking.token_code} checked in at the centre.`,
      "queue",
    );
    qc.invalidateQueries();
    toast.success(lang === "hi" ? "क्यूआर चेक-इन पूर्ण" : "QR check-in complete");
  }

  async function cancelBooking() {
    if (!booking) return;
    const { error } = await supabase.from("bookings").update({ stage: "cancelled" }).eq("id", booking.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries();
    toast.success(lang === "hi" ? "स्लॉट रद्द किया गया" : "Slot cancelled");
  }

  return (
    <AppShell isAdmin={isAdmin}>
      <h1 className="text-3xl font-extrabold">{t("liveQueue")}</h1>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <div className="surface-card p-6 text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t("yourToken")}</p>
          <p className="token-type mt-1 text-5xl font-extrabold text-primary">{booking.token_code}</p>
          <div className="mt-4 flex justify-center rounded-xl bg-card p-3">
            <QRCodeSVG value={qrPayload} size={148} />
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            {centre?.name} · {booking.booking_date} · {timeLabel(booking.start_time)}
          </p>
          {booking.stage === "booked" && isToday && (
            <Button className="mt-4 w-full" onClick={checkIn}>
              {lang === "hi" ? "क्यूआर चेक-इन" : "QR check-in at centre"}
            </Button>
          )}
          {booking.stage === "booked" && (
            <Button variant="outline" className="mt-2 w-full" onClick={cancelBooking}>
              {lang === "hi" ? "स्लॉट रद्द करें" : "Cancel slot"}
            </Button>
          )}
        </div>

        <div className="surface-card p-6 lg:col-span-2">
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat label={t("nowServing")} value={centre?.now_serving || "—"} />
            <Stat label={t("farmersAhead")} value={isToday ? String(ahead.length) : "—"} />
            <Stat label={t("waitTime")} value={isToday ? formatMinutes(wait, lang) : "—"} />
          </div>
          <p className="mt-4 rounded-lg bg-secondary p-3 text-sm text-secondary-foreground">
            {lang === "hi"
              ? `आपका टोकन ${booking.token_code} | अभी चल रहा है ${centre?.now_serving || "—"} | ${ahead.length} किसान आगे | अनुमानित प्रतीक्षा ${formatMinutes(wait, lang)}`
              : `Your token ${booking.token_code} | Currently serving ${centre?.now_serving || "—"} | ${ahead.length} farmers ahead | Estimated wait ${formatMinutes(wait, lang)}`}
          </p>

          <p className="mt-5 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {lang === "hi" ? "आज की कतार" : "Today's queue"}
          </p>
          <ul className="mt-2 divide-y divide-border">
            {list.slice(0, 12).map((b) => (
              <li key={b.id} className="flex items-center justify-between py-2 text-sm">
                <span className={b.id === booking.id ? "token-type font-bold text-primary" : "token-type"}>
                  {b.token_code}
                </span>
                <span className="text-muted-foreground">{stageLabel(b.stage, lang)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-secondary p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}
