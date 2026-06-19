import { ChevronDown, ChevronRight, Lightbulb } from "lucide-react";
import { clsx } from "clsx";

interface Props {
  title: string;
  openKey: string;
  isOpen: boolean;
  onToggle: () => void;
  tone?: "default" | "warn" | "info" | "pass";
  badge?: string;
  children: React.ReactNode;
}

export default function ExplainBlock({
  title,
  openKey,
  isOpen,
  onToggle,
  tone = "default",
  badge,
  children,
}: Props) {
  const toneCls =
    tone === "warn" ? "border-amber-200 bg-amber-50/50" :
    tone === "info" ? "border-ink-200 bg-ink-50/60" :
    tone === "pass" ? "border-emerald-200 bg-emerald-50/50" :
    "border-ink-200 bg-white";

  const iconCls =
    tone === "warn" ? "text-amber-600" :
    tone === "info" ? "text-ink-600" :
    tone === "pass" ? "text-emerald-600" :
    "text-ember-500";

  return (
    <div className={clsx("rounded-sm2 border overflow-hidden", toneCls)}>
      <button
        onClick={onToggle}
        className="w-full px-3 py-2.5 flex items-center gap-2 hover:bg-black/[0.02] transition-colors"
      >
        <Lightbulb className={clsx("w-4 h-4 shrink-0", iconCls)} />
        <span className="flex-1 text-left text-sm text-ink-800 font-medium">{title}</span>
        {badge && <span className="chip-neutral">{badge}</span>}
        {isOpen ? <ChevronDown className="w-4 h-4 text-ink-400" /> : <ChevronRight className="w-4 h-4 text-ink-400" />}
      </button>
      {isOpen && (
        <div className="px-4 py-3 border-t border-black/[0.05] text-xs text-ink-700 space-y-2 bg-white/60">
          {children}
        </div>
      )}
    </div>
  );
}
