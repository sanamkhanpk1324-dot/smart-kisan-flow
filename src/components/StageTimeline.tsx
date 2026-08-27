import { Check } from "lucide-react";
import { STAGES, stageIndex, stageLabel } from "@/lib/kq";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function StageTimeline({ stage }: { stage: string }) {
  const { lang } = useI18n();
  const cancelled = stage === "cancelled" || stage === "no_show";
  const current = stageIndex(stage);

  if (cancelled) {
    return (
      <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive">
        {stageLabel(stage, lang)}
      </p>
    );
  }

  return (
    <ol className="space-y-0">
      {STAGES.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={s} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  "flex size-7 items-center justify-center rounded-full border-2 text-xs font-bold",
                  done && "border-success bg-success text-success-foreground",
                  active && "border-primary bg-primary text-primary-foreground",
                  !done && !active && "border-border bg-card text-muted-foreground",
                )}
              >
                {done ? <Check className="size-4" /> : i + 1}
              </span>
              {i < STAGES.length - 1 && (
                <span className={cn("w-0.5 flex-1", i < current ? "bg-success" : "bg-border")} />
              )}
            </div>
            <p
              className={cn(
                "pb-4 pt-0.5 text-sm",
                active ? "font-bold text-foreground" : done ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {stageLabel(s, lang)}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
