import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { StageTimeline } from "@/components/StageTimeline";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/lib/i18n";
import { activeBooking, fetchCentres, fetchMyBookings, fetchPayments, fetchRecords } from "@/lib/queries";
import { timeLabel } from "@/lib/kq";

export const Route = createFileRoute("/_authenticated/status")({
  head: () => ({
    meta: [
      { title: "Procurement & payment status — KisanQueue" },
      {
        name: "description",
        content: "Follow every stage from slot booked to payment completed, with quantity, grade and amount.",
      },
      { property: "og:title", content: "Procurement & payment status — KisanQueue" },
      { property: "og:description", content: "Weighing, quality result, expected amount and payment date in one view." },
    ],
  }),
  component: StatusPage,
});

function StatusPage() {
  const { t, lang } = useI18n();
  const { user, isAdmin } = useAuth();
  const uid = user?.id;

  const centres = useQuery({ queryKey: ["centres"], queryFn: fetchCentres });
  const bookings = useQuery({ queryKey: ["bookings", uid], queryFn: () => fetchMyBookings(uid!), enabled: !!uid });
  const records = useQuery({ queryKey: ["records", uid], queryFn: () => fetchRecords(uid!), enabled: !!uid });
  const payments = useQuery({ queryKey: ["payments", uid], queryFn: () => fetchPayments(uid!), enabled: !!uid });

  const booking = activeBooking(bookings.data ?? []) ?? (bookings.data ?? [])[0];
  const centre = centres.data?.find((c) => c.id === booking?.centre_id);
  const record = records.data?.find((r) => r.booking_id === booking?.id);
  const payment = payments.data?.find((p) => p.booking_id === booking?.id);

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

  return (
    <AppShell isAdmin={isAdmin}>
      <h1 className="text-3xl font-extrabold">{t("status")}</h1>
      <p className="text-muted-foreground">
        {centre?.name} · {booking.booking_date} · {timeLabel(booking.start_time)} ·{" "}
        <span className="token-type font-semibold">{booking.token_code}</span>
      </p>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="surface-card p-6">
          <StageTimeline stage={booking.stage} />
        </div>
        <div className="surface-card space-y-3 p-6">
          <Row label={t("crop")} value={booking.crop} />
          <Row
            label={lang === "hi" ? "अपेक्षित मात्रा" : "Expected quantity"}
            value={`${booking.expected_quantity} ${lang === "hi" ? "क्विंटल" : "quintal"}`}
          />
          <Row
            label={lang === "hi" ? "तौल मात्रा" : "Weighed quantity"}
            value={record ? `${record.actual_quantity} ${lang === "hi" ? "क्विंटल" : "quintal"}` : "—"}
          />
          <Row label={lang === "hi" ? "गुणवत्ता" : "Quality result"} value={record?.quality_grade || "—"} />
          <Row
            label={lang === "hi" ? "नमी" : "Moisture"}
            value={record?.moisture != null ? `${record.moisture}%` : "—"}
          />
          <Row
            label={lang === "hi" ? "दर / क्विंटल" : "Rate per quintal"}
            value={record ? `₹ ${Number(record.rate_per_quintal).toLocaleString("en-IN")}` : "—"}
          />
          <Row
            label={lang === "hi" ? "अपेक्षित राशि" : "Expected amount"}
            value={record ? `₹ ${Number(record.amount).toLocaleString("en-IN")}` : "—"}
          />
          <Row
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
          />
          <Row
            label={lang === "hi" ? "भुगतान तिथि" : "Payment date"}
            value={payment?.paid_at ? new Date(payment.paid_at).toLocaleDateString("en-IN") : "—"}
          />
          <Row label={lang === "hi" ? "संदर्भ संख्या" : "Reference"} value={payment?.reference || "—"} />
        </div>
      </div>
    </AppShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border pb-2 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-right font-semibold">{value}</span>
    </div>
  );
}
