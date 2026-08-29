import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  CalendarPlus,
  LayoutDashboard,
  ListOrdered,
  LogOut,
  PackageCheck,
  Shield,
  Sprout,
  User,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

const navItems = [
  { to: "/dashboard", key: "dashboard", icon: LayoutDashboard },
  { to: "/book", key: "bookSlot", icon: CalendarPlus },
  { to: "/queue", key: "liveQueue", icon: ListOrdered },
  { to: "/status", key: "status", icon: PackageCheck },
  { to: "/notifications", key: "notifications", icon: Bell },
  { to: "/profile", key: "profile", icon: User },
] as const;

export function LanguageToggle() {
  const { lang, setLang } = useI18n();
  return (
    <div className="inline-flex items-center rounded-full border border-border bg-card p-0.5">
      {(["en", "hi"] as const).map((l) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          aria-pressed={lang === l}
          className={cn(
            "rounded-full px-3 py-1 text-sm font-semibold transition-colors",
            lang === l ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {l === "en" ? "EN" : "हिं"}
        </button>
      ))}
    </div>
  );
}

export function AppShell({ children, isAdmin }: { children: ReactNode; isAdmin?: boolean }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", search: { mode: "login" }, replace: true });
  }

  const items = isAdmin ? [...navItems, { to: "/admin", key: "admin", icon: Shield } as const] : navItems;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <Link to="/dashboard" className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-xl bg-field text-primary-foreground">
              <Sprout className="size-5" />
            </span>
            <span className="font-display text-lg font-extrabold tracking-tight">{t("appName")}</span>
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <LanguageToggle />
            <Button variant="outline" size="sm" onClick={signOut}>
              <LogOut className="size-4" /> {t("logout")}
            </Button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-3 pb-2">
          {items.map((item) => {
            const active = pathname === item.to;
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-sm font-semibold transition-colors",
                  active
                    ? "bg-secondary text-secondary-foreground"
                    : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                )}
              >
                <Icon className="size-4" />
                {t(item.key)}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 pb-20">{children}</main>
    </div>
  );
}
