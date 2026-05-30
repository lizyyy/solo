import { Wallet, ShieldCheck, Banknote, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface SummaryCardsProps {
  totalAmount: number;
  confirmedAmount: number;
  matchedAmount: number;
  anomalyCount: number;
}

interface CardConfig {
  icon: LucideIcon;
  label: string;
  value: number;
  format: "currency" | "count";
  subtitle: (props: SummaryCardsProps) => string;
  accent: string;
}

const cards: CardConfig[] = [
  {
    icon: Wallet,
    label: "债权总额",
    value: 0,
    format: "currency",
    subtitle: () => "全部登记债权",
    accent: "text-[#22c55e]",
  },
  {
    icon: ShieldCheck,
    label: "已确认金额",
    value: 0,
    format: "currency",
    subtitle: (p) => {
      const ratio = p.totalAmount ? (p.confirmedAmount / p.totalAmount) * 100 : 0;
      return `确认率 ${ratio.toFixed(1)}%`;
    },
    accent: "text-[#22c55e]",
  },
  {
    icon: Banknote,
    label: "回款匹配金额",
    value: 0,
    format: "currency",
    subtitle: (p) => {
      const ratio = p.confirmedAmount ? (p.matchedAmount / p.confirmedAmount) * 100 : 0;
      return `匹配率 ${ratio.toFixed(1)}%`;
    },
    accent: "text-[#f59e0b]",
  },
  {
    icon: AlertTriangle,
    label: "异常条目",
    value: 0,
    format: "count",
    subtitle: (p) => {
      const ratio = p.totalAmount ? (p.anomalyCount / p.totalAmount) * 100 : 0;
      return `占比 ${ratio.toFixed(2)}%`;
    },
    accent: "text-[#ef4444]",
  },
];

function formatCurrency(n: number) {
  return `¥${n.toLocaleString("zh-CN")}`;
}

export default function SummaryCards({
  totalAmount,
  confirmedAmount,
  matchedAmount,
  anomalyCount,
}: SummaryCardsProps) {
  const values = [totalAmount, confirmedAmount, matchedAmount, anomalyCount];
  const props = { totalAmount, confirmedAmount, matchedAmount, anomalyCount };

  return (
    <div className="grid grid-cols-4 gap-4">
      {cards.map((card, i) => {
        const Icon = card.icon;
        const isAnomaly = card.format === "count" && anomalyCount > 0;

        return (
          <div
            key={card.label}
            className={cn(
              "rounded-xl border border-[#2a3042] bg-[#242938] p-5 transition-shadow hover:shadow-lg hover:shadow-black/20",
              isAnomaly && "border-l-[3px] border-l-[#ef4444]"
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm text-[#f0ece4]/60">{card.label}</span>
              <Icon size={18} className={card.accent} />
            </div>
            <div className="mt-3 font-['JetBrains_Mono'] text-2xl font-semibold tracking-tight">
              {card.format === "currency"
                ? formatCurrency(values[i])
                : values[i].toLocaleString("zh-CN")}
            </div>
            <div className="mt-1.5 text-xs text-[#f0ece4]/40">
              {card.subtitle(props)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
