export const STAGES = [
  "booked",
  "arrived",
  "weighing",
  "quality_check",
  "completed",
  "payment_processing",
  "payment_completed",
] as const;

export type Stage = (typeof STAGES)[number] | "cancelled" | "no_show";

export const STAGE_LABEL: Record<string, { en: string; hi: string }> = {
  booked: { en: "Slot Booked", hi: "स्लॉट बुक" },
  arrived: { en: "Farmer Arrived", hi: "किसान पहुँचे" },
  weighing: { en: "Weighing", hi: "तौल" },
  quality_check: { en: "Quality Check", hi: "गुणवत्ता जाँच" },
  completed: { en: "Procurement Completed", hi: "खरीद पूर्ण" },
  payment_processing: { en: "Payment Processing", hi: "भुगतान प्रक्रिया" },
  payment_completed: { en: "Payment Completed", hi: "भुगतान पूर्ण" },
  cancelled: { en: "Cancelled", hi: "रद्द" },
  no_show: { en: "No Show", hi: "अनुपस्थित" },
};

export function stageLabel(stage: string, lang: "en" | "hi") {
  return STAGE_LABEL[stage]?.[lang] ?? stage;
}

export function stageIndex(stage: string) {
  const i = (STAGES as readonly string[]).indexOf(stage);
  return i < 0 ? 0 : i;
}

/**
 * AI-style waiting-time prediction.
 * Blends queue depth, the centre's average handling time, parallel counters
 * (capacity) and a load factor that grows as the queue gets deeper.
 */
export function predictWait(opts: {
  peopleAhead: number;
  avgMinutes: number;
  capacityPerSlot: number;
}) {
  const { peopleAhead, avgMinutes } = opts;
  const counters = Math.max(1, Math.round(opts.capacityPerSlot / 6));
  const congestion = 1 + Math.min(0.45, peopleAhead * 0.02);
  const minutes = Math.round((peopleAhead / counters) * avgMinutes * congestion);
  return Math.max(peopleAhead === 0 ? 0 : 3, minutes);
}

export function formatMinutes(mins: number, lang: "en" | "hi") {
  if (mins <= 0) return lang === "hi" ? "आपकी बारी" : "Your turn";
  if (mins < 60) return `${mins} ${lang === "hi" ? "मिनट" : "min"}`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return lang === "hi" ? `${h} घंटा ${m} मिनट` : `${h} hr ${m} min`;
}

export function tokenFor(centreCode: string, queueNumber: number) {
  return `${centreCode}${100 + queueNumber}`;
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function timeLabel(t: string) {
  const [h, m] = t.split(":");
  const hour = Number(h);
  const suffix = hour >= 12 ? "PM" : "AM";
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${m} ${suffix}`;
}

export function crops() {
  return ["Wheat", "Paddy", "Maize", "Mustard", "Gram", "Soybean", "Cotton"];
}
