import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlarmClock, Bell, CalendarDays, ListOrdered, Sparkles, Wallet } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import {
  activeBooking,
  fetchCentreQueue,
  fetchCentres,
  fetchMyBookings,
  fetchNotifications,
  fetchPayments,
} from "@/lib/queries";
import { formatMinutes, predictWait, stageLabel, timeLabel, todayISO } from "@/lib/kq";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Farmer dashboard — KisanQueue" },
      { name: "description", content: "Your upcoming slot, live queue position, waiting time and payment status." },
      { property: "og:title", content: "Farmer dashboard — KisanQueue" },
      { property: "og:description", content: "Track your procurement slot, queue and payments in one place." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { t, lang } = useI18n();
  const { user, profile, isAdmin } = useAuth();
  const qc = useQueryClient();
  const uid = user?.id;

  const centres = useQuery({ queryKey: ["centres"], queryFn: fetchCentres });
  const bookings = useQuery({ queryKey: ["bookings", uid], queryFn: () => fetchMyBookings(uid!), enabled: !!uid });
  const payments = useQuery({ queryKey: ["payments", uid], queryFn: () => fetchPayments(uid!), enabled: !!uid });
  const notifications = useQuery({
    queryKey: ["notifications", uid],
    queryFn: () => fetchNotifications(uid!),
    enabled: !!uid,
  });

  const booking = activeBooking(bookings.data ?? []);
  const centre = centres.data?.find((c) => c.id === booking?.centre_id);

  const queue = useQuery({
    queryKey: ["queue", booking?.centre_id, booking?.booking_date],
    queryFn: () => fetchCentreQueue(booking!.centre_id, booking!.booking_date),
    enabled: !!booking,
  });

  useEffect(() => {
    if (!booking) return;
    const channel = supabase
      .channel("dashboard-queue")
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, () => {
        qc.invalidateQueries({ queryKey: ["queue"] });
        qc.invalidateQueries({ queryKey: ["bookings", uid] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "centres" }, () => {
        qc.invalidateQueries({ queryKey: ["centres"] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [booking, qc, uid]);

  const ahead = (queue.data ?? []).filter(
    (b) => b.queue_number < (booking?.queue_number ?? 0) && ["booked", "arrived"].includes(b.stage),
  ).length;
  const wait = predictWait({
    peopleAhead: ahead,
    avgMinutes: centre?.avg_minutes_per_farmer ?? 6,
    capacityPerSlot: centre?.capacity_per_slot ?? 10,
  });
  const payment = payments.data?.find((p) => p.booking_id === booking?.id);
  const unread = (notifications.data ?? []).filter((n) => !n.is_read).length;

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold">
            {lang === "hi" ? "नमस्ते" : "Namaste"}, {profile?.full_name || "Kisan"}
          </h1>
          <p className="text-muted-foreground">
            {t("farmerId")}: <span className="token-type font-semibold">{profile?.farmer_id}</span>
          </p>
        </div>
        <Button asChild size="lg">
          <Link to="/book">{t("bookNow")}</Link>
        </Button>
      </div>

      {!booking ? (
        <div className="surface-card mt-6 p-8 text-center">
          <p className="text-lg font-semibold">{t("noBooking")}</p>
          <p className="mt-1 text-muted-foreground">
            {lang === "hi"
              ? "स्लॉट बुक करते ही आपको डिजिटल टोकन और लाइव कतार दिखेगी।"
              : "Book a slot to get your digital token and live queue tracking."}
          </p>
          <Button asChild className="mt-4">
            <Link to="/book">{t("bookSlot")}</Link>
          </Button>
        </div>
      ) : (
        <>
          <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Tile
              icon={CalendarDays}
              label={t("upcomingSlot")}
              value={`${booking.booking_date} · ${timeLabel(booking.start_time)}`}
              sub={centre?.name ?? ""}
            />
            <Tile
              icon={ListOrdered}
              label={t("queuePosition")}
              value={booking.booking_date === todayISO() ? `${ahead} ${t("farmersAhead")}` : "—"}
              sub={`${t("yourToken")}: ${booking.token_code} · ${t("nowServing")}: ${centre?.now_serving || "—"}`}
              highlight
            />
            <Tile
              icon={AlarmClock}
              label={t("waitTime")}
              value={booking.booking_date === todayISO() ? formatMinutes(wait, lang) : "—"}
              sub={lang === "hi" ? "एआई अनुमान" : "AI prediction"}
            />
            <Tile
              icon={Wallet}
              label={t("paymentStatus")}
              value={
                payment
                  ? payment.status === "paid"
                    ? lang === "hi"
                      ? "भुगतान पूर्ण"
                      : "Paid"
                    : lang === "hi"
                      ? "प्रक्रिया में"
                      : "Processing"
                  : lang === "hi"
                    ? "लंबित"
                    : "Pending"
              }
              sub={payment ? `₹ ${Number(payment.amount).toLocaleString("en-IN")}` : "—"}
            />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <div className="surface-card p-5 lg:col-span-2">
              <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t("status")}</p>
              <p className="mt-2 text-2xl font-bold">{stageLabel(booking.stage, lang)}</p>
              <p className="mt-1 text-muted-foreground">
                {booking.crop} · {booking.expected_quantity} {lang === "hi" ? "क्विंटल" : "quintal"}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button asChild variant="outline">
                  <Link to="/queue">{t("liveQueue")}</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/status">{t("status")}</Link>
                </Button>
              </div>
            </div>
            <div className="surface-card p-5">
              <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                <Bell className="size-4" /> {t("notifications")}
              </p>
              <p className="mt-2 text-3xl font-bold">{unread}</p>
              <p className="text-muted-foreground">{lang === "hi" ? "नई सूचनाएँ" : "unread alerts"}</p>
              <Button asChild variant="outline" className="mt-3 w-full">
                <Link to="/notifications">{t("notifications")}</Link>
              </Button>
            </div>
          </div>
        </>
      )}

      <div className="surface-card mt-4 flex items-start gap-3 p-5">
        <Sparkles className="mt-1 size-5 text-accent" />
        <div>
          <p className="font-bold">{t("smartPick")}</p>
          <p className="text-sm text-muted-foreground">
            {lang === "hi"
              ? "बुकिंग स्क्रीन पर सबसे कम भीड़ वाला स्लॉट अपने आप हाइलाइट होता है।"
              : "The least crowded slot is highlighted automatically on the booking screen."}
          </p>
        </div>
      </div>
    </AppShell>
  );
}

function Tile({
  icon: Icon,
  label,
  value,
  sub,
  highlight,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub: string;
  highlight?: boolean;
}) {
  return (
    <div className={`surface-card p-5 ${highlight ? "ring-2 ring-primary/25" : ""}`}>
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="size-4" /> {label}
      </p>
      <p className="mt-2 text-xl font-bold leading-tight">{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{sub}</p>
    </div>
  );
}
