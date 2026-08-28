import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, MessageSquare } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { fetchNotifications } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — KisanQueue" },
      { name: "description", content: "Slot reminders, queue updates, centre announcements and payment alerts." },
      { property: "og:title", content: "Notifications — KisanQueue" },
      { property: "og:description", content: "In-app alerts with an SMS/WhatsApp module for low-network villages." },
    ],
  }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const { t, lang } = useI18n();
  const { user, isAdmin } = useAuth();
  const qc = useQueryClient();
  const uid = user?.id;

  const notifications = useQuery({
    queryKey: ["notifications", uid],
    queryFn: () => fetchNotifications(uid!),
    enabled: !!uid,
  });

  async function markAll() {
    if (!uid) return;
    await supabase.from("notifications").update({ is_read: true }).eq("user_id", uid).eq("is_read", false);
    qc.invalidateQueries({ queryKey: ["notifications", uid] });
  }

  const list = notifications.data ?? [];

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-extrabold">{t("notifications")}</h1>
        <Button variant="outline" onClick={markAll}>
          {t("markRead")}
        </Button>
      </div>

      <div className="surface-card mt-5 flex items-start gap-3 p-4">
        <MessageSquare className="mt-0.5 size-5 text-accent" />
        <p className="text-sm text-muted-foreground">
          {lang === "hi"
            ? "SMS / WhatsApp अलर्ट इस प्रोटोटाइप में मॉड्यूल के रूप में दिखाए गए हैं — असली गेटवे जोड़ते ही यही सूचनाएँ फ़ोन पर जाएँगी।"
            : "SMS / WhatsApp alerts are shown as a plug-in module in this prototype — the same messages go to the phone once a gateway is connected."}
        </p>
      </div>

      <ul className="mt-4 space-y-3">
        {list.length === 0 && (
          <li className="surface-card p-8 text-center text-muted-foreground">
            {lang === "hi" ? "अभी कोई सूचना नहीं।" : "No notifications yet."}
          </li>
        )}
        {list.map((n) => (
          <li key={n.id} className={`surface-card p-4 ${n.is_read ? "" : "ring-2 ring-primary/20"}`}>
            <div className="flex items-start gap-3">
              <Bell className={`mt-0.5 size-4 ${n.is_read ? "text-muted-foreground" : "text-primary"}`} />
              <div>
                <p className="font-bold">{n.title}</p>
                <p className="text-sm text-muted-foreground">{n.message}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {new Date(n.created_at).toLocaleString("en-IN")} · {n.category}
                </p>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </AppShell>
  );
}
