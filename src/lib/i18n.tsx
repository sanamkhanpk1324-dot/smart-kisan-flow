import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "en" | "hi";

type Dict = Record<string, { en: string; hi: string }>;

const dict: Dict = {
  appName: { en: "KisanQueue", hi: "किसानक्यू" },
  tagline: {
    en: "Smart Procurement & Payment Management",
    hi: "स्मार्ट खरीद एवं भुगतान प्रबंधन",
  },
  heroTitle: {
    en: "Stop waiting at the procurement centre.",
    hi: "खरीद केंद्र पर घंटों इंतज़ार अब नहीं।",
  },
  heroSub: {
    en: "KisanQueue tells you when to come, gives you a digital token, shows your live position in the queue, tracks your procurement and tells you when your payment is done.",
    hi: "किसानक्यू आपको बताता है कब आना है, डिजिटल टोकन देता है, कतार में आपकी लाइव स्थिति दिखाता है, खरीद ट्रैक करता है और भुगतान पूरा होने पर सूचित करता है।",
  },
  getStarted: { en: "Register / Login", hi: "पंजीकरण / लॉगिन" },
  login: { en: "Login", hi: "लॉगिन" },
  register: { en: "Register", hi: "पंजीकरण" },
  logout: { en: "Logout", hi: "लॉगआउट" },
  dashboard: { en: "Dashboard", hi: "डैशबोर्ड" },
  bookSlot: { en: "Book Slot", hi: "स्लॉट बुक करें" },
  liveQueue: { en: "Live Queue", hi: "लाइव कतार" },
  status: { en: "Procurement Status", hi: "खरीद स्थिति" },
  notifications: { en: "Notifications", hi: "सूचनाएँ" },
  profile: { en: "Profile", hi: "प्रोफ़ाइल" },
  admin: { en: "Centre Console", hi: "केंद्र कंसोल" },
  upcomingSlot: { en: "Upcoming Slot", hi: "आगामी स्लॉट" },
  queuePosition: { en: "Live Queue Position", hi: "लाइव कतार स्थिति" },
  waitTime: { en: "Estimated Waiting Time", hi: "अनुमानित प्रतीक्षा समय" },
  paymentStatus: { en: "Payment Status", hi: "भुगतान स्थिति" },
  fullName: { en: "Full name", hi: "पूरा नाम" },
  mobile: { en: "Mobile number", hi: "मोबाइल नंबर" },
  farmerId: { en: "Farmer ID", hi: "किसान आईडी" },
  village: { en: "Village", hi: "गाँव" },
  district: { en: "District", hi: "ज़िला" },
  crop: { en: "Crop", hi: "फ़सल" },
  landSize: { en: "Land (acres)", hi: "भूमि (एकड़)" },
  password: { en: "Password", hi: "पासवर्ड" },
  centre: { en: "Procurement centre", hi: "खरीद केंद्र" },
  quantity: { en: "Expected quantity (quintal)", hi: "अनुमानित मात्रा (क्विंटल)" },
  date: { en: "Date", hi: "तारीख़" },
  timeSlot: { en: "Time slot", hi: "समय स्लॉट" },
  confirmBooking: { en: "Confirm booking", hi: "बुकिंग पक्की करें" },
  yourToken: { en: "Your token", hi: "आपका टोकन" },
  nowServing: { en: "Currently serving", hi: "अभी चल रहा है" },
  farmersAhead: { en: "farmers ahead", hi: "किसान आगे" },
  minutes: { en: "minutes", hi: "मिनट" },
  noBooking: { en: "No active booking yet.", hi: "अभी कोई सक्रिय बुकिंग नहीं है।" },
  bookNow: { en: "Book a slot", hi: "स्लॉट बुक करें" },
  save: { en: "Save changes", hi: "बदलाव सहेजें" },
  history: { en: "Booking & payment history", hi: "बुकिंग एवं भुगतान इतिहास" },
  markRead: { en: "Mark all read", hi: "सभी पढ़े हुए" },
  callNext: { en: "Call next farmer", hi: "अगले किसान को बुलाएँ" },
  smartPick: { en: "AI smart slot pick", hi: "एआई स्मार्ट स्लॉट सुझाव" },
};

type I18n = { lang: Lang; setLang: (l: Lang) => void; t: (k: keyof typeof dict | string) => string };

const I18nContext = createContext<I18n>({ lang: "en", setLang: () => {}, t: (k) => String(k) });

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    const stored = window.localStorage.getItem("kq-lang");
    if (stored === "hi" || stored === "en") setLangState(stored);
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    window.localStorage.setItem("kq-lang", l);
  }, []);

  const t = useCallback(
    (k: string) => {
      const entry = dict[k];
      return entry ? entry[lang] : k;
    },
    [lang],
  );

  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
