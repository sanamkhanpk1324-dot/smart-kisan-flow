import { createFileRoute, Link } from "@tanstack/react-router";
import { BellRing, Clock, QrCode, Sprout, Wallet, Users, Languages, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LanguageToggle } from "@/components/AppShell";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "KisanQueue — Book slots, get tokens, skip the wait" },
      {
        name: "description",
        content:
          "KisanQueue lets farmers book a procurement slot, receive a digital QR token, track live queue position and follow procurement and payment status.",
      },
      { property: "og:title", content: "KisanQueue — Book slots, get tokens, skip the wait" },
      {
        property: "og:description",
        content:
          "Digital token, live queue position, procurement stage tracking and payment alerts for farmers.",
      },
    ],
  }),
  component: Landing,
});

const journey = [
  { en: "Register", hi: "पंजीकरण" },
  { en: "Book slot", hi: "स्लॉट बुक" },
  { en: "Digital token", hi: "डिजिटल टोकन" },
  { en: "Live queue", hi: "लाइव कतार" },
  { en: "Procurement", hi: "खरीद" },
  { en: "Payment done", hi: "भुगतान पूर्ण" },
];

function Landing() {
  const { t, lang } = useI18n();

  const features = [
    {
      icon: Clock,
      title: lang === "hi" ? "एआई प्रतीक्षा अनुमान" : "AI waiting-time prediction",
      body:
        lang === "hi"
          ? "आगे खड़े किसान, औसत प्रोसेसिंग समय और केंद्र क्षमता से प्रतीक्षा समय का अनुमान।"
          : "Estimates your wait from people ahead, average processing time and centre capacity.",
    },
    {
      icon: QrCode,
      title: lang === "hi" ? "क्यूआर चेक-इन टोकन" : "QR check-in token",
      body:
        lang === "hi"
          ? "टोकन में किसान आईडी, बुकिंग आईडी, केंद्र, तारीख और कतार संख्या।"
          : "Token carries Farmer ID, booking ID, centre, date, time and queue number.",
    },
    {
      icon: Users,
      title: lang === "hi" ? "स्मार्ट स्लॉट सुझाव" : "Smart slot recommendation",
      body:
        lang === "hi" ? "कम भीड़ वाले स्लॉट अपने आप सुझाए जाते हैं।" : "Suggests the least crowded slot automatically.",
    },
    {
      icon: Wallet,
      title: lang === "hi" ? "भुगतान ट्रैकिंग" : "Payment tracking",
      body:
        lang === "hi"
          ? "तौल, गुणवत्ता, राशि और भुगतान की तारीख एक जगह।"
          : "Weighing, quality result, amount and payment date in one place.",
    },
    {
      icon: BellRing,
      title: lang === "hi" ? "सूचनाएँ (SMS/WhatsApp मॉड्यूल)" : "Alerts (SMS/WhatsApp module)",
      body:
        lang === "hi"
          ? "स्लॉट रिमाइंडर, कतार अपडेट और भुगतान अलर्ट।"
          : "Slot reminders, queue updates, centre announcements and payment alerts.",
    },
    {
      icon: WifiOff,
      title: lang === "hi" ? "कम-नेटवर्क अनुकूल" : "Low-network friendly",
      body:
        lang === "hi"
          ? "हल्का इंटरफ़ेस, बड़े बटन और सरल भाषा।"
          : "Light interface, large touch targets and plain language for rural connectivity.",
    },
  ];

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-5">
        <span className="flex size-10 items-center justify-center rounded-xl bg-field text-primary-foreground">
          <Sprout className="size-5" />
        </span>
        <div>
          <p className="font-display text-xl font-extrabold leading-none">{t("appName")}</p>
          <p className="text-xs text-muted-foreground">{t("tagline")}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <LanguageToggle />
          <Button asChild size="sm">
            <Link to="/auth">{t("getStarted")}</Link>
          </Button>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl gap-8 px-4 py-10 lg:grid-cols-[1.15fr_1fr] lg:items-center">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-sm font-semibold text-secondary-foreground">
            <Languages className="size-4" /> {lang === "hi" ? "हिंदी + English" : "English + हिंदी"}
          </span>
          <h1 className="mt-4 text-4xl font-extrabold leading-tight sm:text-5xl">{t("heroTitle")}</h1>
          <p className="mt-4 max-w-xl text-lg text-muted-foreground">{t("heroSub")}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/auth">{t("getStarted")}</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/auth" search={{ mode: "login" }}>
                {t("login")}
              </Link>
            </Button>
          </div>
          <ol className="mt-8 flex flex-wrap gap-2">
            {journey.map((step, i) => (
              <li
                key={step.en}
                className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-sm font-semibold"
              >
                <span className="token-type text-xs text-muted-foreground">{i + 1}</span>
                {lang === "hi" ? step.hi : step.en}
              </li>
            ))}
          </ol>
        </div>

        <div className="surface-card shadow-lift overflow-hidden">
          <div className="bg-field px-6 py-5 text-primary-foreground">
            <p className="text-sm/5 opacity-80">{t("yourToken")}</p>
            <p className="token-type text-5xl font-bold">A124</p>
          </div>
          <div className="grid grid-cols-2 gap-px bg-border">
            <Stat label={t("nowServing")} value="A118" />
            <Stat label={t("farmersAhead")} value="6" />
            <Stat label={t("waitTime")} value="35 min" />
            <Stat label={t("paymentStatus")} value={lang === "hi" ? "प्रक्रिया में" : "Processing"} />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10">
        <h2 className="text-2xl font-bold">
          {lang === "hi" ? "सिर्फ़ स्लॉट बुकिंग नहीं" : "More than a slot-booking app"}
        </h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <article key={f.title} className="surface-card p-5">
              <span className="flex size-10 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
                <f.icon className="size-5" />
              </span>
              <h3 className="mt-3 text-lg font-bold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
            </article>
          ))}
        </div>
      </section>

      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        KisanQueue — {t("tagline")}
      </footer>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card px-5 py-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
    </div>
  );
}
