import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { fetchCentreQueue, fetchCentres, fetchSlots, notify, type Slot } from "@/lib/queries";
import { crops, timeLabel, tokenFor } from "@/lib/kq";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/book")({
  head: () => ({
    meta: [
      { title: "Book a procurement slot — KisanQueue" },
      { name: "description", content: "Pick a centre, crop, quantity and time slot, then get a digital QR token." },
      { property: "og:title", content: "Book a procurement slot — KisanQueue" },
      { property: "og:description", content: "Smart slot recommendation shows the least crowded time to arrive." },
    ],
  }),
  component: BookPage,
});

function BookPage() {
  const { t, lang } = useI18n();
  const { user, profile, isAdmin } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const centres = useQuery({ queryKey: ["centres"], queryFn: fetchCentres });
  const [centreId, setCentreId] = useState<string>("");
  const activeCentre = centres.data?.find((c) => c.id === centreId) ?? centres.data?.[0];
  const activeCentreId = activeCentre?.id ?? "";

  const slots = useQuery({
    queryKey: ["slots", activeCentreId],
    queryFn: () => fetchSlots(activeCentreId),
    enabled: !!activeCentreId,
  });

  const [crop, setCrop] = useState(profile?.crop || "Wheat");
  const [quantity, setQuantity] = useState("20");
  const [slotId, setSlotId] = useState("");
  const [busy, setBusy] = useState(false);

  const open = useMemo(
    () => (slots.data ?? []).filter((s) => s.is_open && s.booked_count < s.capacity),
    [slots.data],
  );
  const recommended = useMemo(() => {
    return [...open].sort(
      (a, b) => a.booked_count / a.capacity - b.booked_count / b.capacity || (a.slot_date + a.start_time).localeCompare(b.slot_date + b.start_time),
    )[0];
  }, [open]);

  const byDate = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const s of open) map.set(s.slot_date, [...(map.get(s.slot_date) ?? []), s]);
    return [...map.entries()].slice(0, 7);
  }, [open]);

  async function confirm() {
    const slot = open.find((s) => s.id === slotId);
    const qty = Number(quantity);
    if (!slot || !activeCentre || !user) {
      toast.error(lang === "hi" ? "कृपया एक स्लॉट चुनें" : "Please choose a time slot");
      return;
    }
    if (!(qty > 0 && qty <= 500)) {
      toast.error(lang === "hi" ? "मात्रा 1 से 500 क्विंटल के बीच रखें" : "Quantity must be between 1 and 500 quintal");
      return;
    }
    setBusy(true);
    const dayQueue = await fetchCentreQueue(activeCentre.id, slot.slot_date);
    const queueNumber = dayQueue.length + 1;
    const token = tokenFor(activeCentre.code, queueNumber);

    const { data, error } = await supabase
      .from("bookings")
      .insert({
        user_id: user.id,
        centre_id: activeCentre.id,
        slot_id: slot.id,
        crop,
        expected_quantity: qty,
        booking_date: slot.slot_date,
        start_time: slot.start_time,
        token_code: token,
        queue_number: queueNumber,
        stage: "booked",
      })
      .select("id")
      .single();

    if (error || !data) {
      setBusy(false);
      toast.error(error?.message ?? "Booking failed");
      return;
    }

    await supabase
      .from("slots")
      .update({ booked_count: slot.booked_count + 1 })
      .eq("id", slot.id);

    await notify(
      user.id,
      lang === "hi" ? `टोकन ${token} जारी हुआ` : `Token ${token} issued`,
      lang === "hi"
        ? `${activeCentre.name} · ${slot.slot_date} · ${timeLabel(slot.start_time)} — समय पर पहुँचें।`
        : `${activeCentre.name} · ${slot.slot_date} · ${timeLabel(slot.start_time)} — please arrive on time.`,
      "slot",
    );

    qc.invalidateQueries();
    setBusy(false);
    toast.success(lang === "hi" ? "स्लॉट बुक हो गया" : "Slot booked");
    navigate({ to: "/queue" });
  }

  return (
    <AppShell isAdmin={isAdmin}>
      <h1 className="text-3xl font-extrabold">{t("bookSlot")}</h1>
      <p className="text-muted-foreground">
        {lang === "hi" ? "केंद्र, फसल, मात्रा और समय चुनें।" : "Choose a centre, crop, quantity and time."}
      </p>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="surface-card space-y-4 p-5 lg:col-span-2">
          <div className="space-y-2">
            <Label>{t("centre")}</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {(centres.data ?? []).map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setCentreId(c.id);
                    setSlotId("");
                  }}
                  className={cn(
                    "rounded-xl border p-3 text-left transition-colors",
                    c.id === activeCentreId ? "border-primary bg-secondary" : "border-border hover:bg-secondary/50",
                  )}
                >
                  <p className="font-bold">{c.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {c.district} · {c.code}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="crop">{t("crop")}</Label>
              <select
                id="crop"
                value={crop}
                onChange={(e) => setCrop(e.target.value)}
                className="h-11 w-full rounded-md border border-input bg-background px-3 text-base"
              >
                {crops().map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qty">{t("quantity")}</Label>
              <Input
                id="qty"
                type="number"
                min="1"
                max="500"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="h-11 text-base"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t("timeSlot")}</Label>
            {byDate.length === 0 && (
              <p className="text-sm text-muted-foreground">
                {lang === "hi" ? "इस केंद्र पर स्लॉट उपलब्ध नहीं।" : "No open slots at this centre."}
              </p>
            )}
            {byDate.map(([date, list]) => (
              <div key={date}>
                <p className="mt-3 text-sm font-semibold text-muted-foreground">{date}</p>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {list.map((s) => {
                    const isRec = recommended?.id === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setSlotId(s.id)}
                        className={cn(
                          "rounded-full border px-3.5 py-2 text-sm font-semibold transition-colors",
                          slotId === s.id
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border hover:bg-secondary",
                        )}
                      >
                        {timeLabel(s.start_time)}
                        <span className="ml-2 text-xs font-medium opacity-80">
                          {s.capacity - s.booked_count} {lang === "hi" ? "जगह" : "left"}
                        </span>
                        {isRec && <Sparkles className="ml-1.5 inline size-3.5" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="surface-card h-fit space-y-3 p-5">
          <p className="flex items-center gap-2 font-bold">
            <Sparkles className="size-4 text-accent" /> {t("smartPick")}
          </p>
          {recommended ? (
            <>
              <p className="text-sm text-muted-foreground">
                {lang === "hi" ? "सबसे कम भीड़ वाला स्लॉट:" : "Least crowded slot:"}
              </p>
              <p className="text-lg font-bold">
                {recommended.slot_date} · {timeLabel(recommended.start_time)}
              </p>
              <Button variant="outline" className="w-full" onClick={() => setSlotId(recommended.id)}>
                {lang === "hi" ? "यही चुनें" : "Use this slot"}
              </Button>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">—</p>
          )}
          <Button size="lg" className="w-full" onClick={confirm} disabled={busy || !slotId}>
            {t("confirmBooking")}
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
