import { Play, Pause, RotateCcw, Flag, ArrowLeft } from "lucide-react";
import type { GameStatus } from "@/types";
import { cn } from "@/lib/utils";

interface ControlBarProps {
  gameStatus: GameStatus;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onRestart: () => void;
  onEnd: () => void;
  onBack: () => void;
}

const buttons: {
  key: string;
  label: string;
  icon: React.ElementType;
  action: keyof ControlBarProps;
  statuses: GameStatus[];
}[] = [
  { key: "start", label: "开始", icon: Play, action: "onStart", statuses: ["idle"] },
  { key: "pause", label: "暂停", icon: Pause, action: "onPause", statuses: ["playing"] },
  { key: "resume", label: "继续", icon: Play, action: "onResume", statuses: ["paused"] },
  { key: "restart", label: "重开", icon: RotateCcw, action: "onRestart", statuses: ["playing", "paused", "completed"] },
  { key: "end", label: "结算", icon: Flag, action: "onEnd", statuses: ["playing", "paused"] },
  { key: "back", label: "返回", icon: ArrowLeft, action: "onBack", statuses: ["idle", "completed"] },
];

export default function ControlBar({
  gameStatus,
  onStart,
  onPause,
  onResume,
  onRestart,
  onEnd,
  onBack,
}: ControlBarProps) {
  const handlers: Record<string, () => void> = {
    onStart,
    onPause,
    onResume,
    onRestart,
    onEnd,
    onBack,
  };

  const visible = buttons.filter((b) => b.statuses.includes(gameStatus));

  return (
    <div className="flex flex-col gap-3">
      {visible.map((btn) => {
        const Icon = btn.icon;
        const isActive =
          (btn.key === "start" && gameStatus === "idle") ||
          (btn.key === "pause" && gameStatus === "playing") ||
          (btn.key === "resume" && gameStatus === "paused") ||
          (btn.key === "restart" && gameStatus === "completed") ||
          (btn.key === "back" && gameStatus === "completed");

        return (
          <button
            key={btn.key}
            onClick={handlers[btn.action] as () => void}
            className={cn(
              "group flex items-center gap-2 px-4 py-2.5 rounded-xl",
              "border transition-all duration-300",
              isActive
                ? "border-[#e6a817]/80 bg-[#e6a817]/15 text-[#e6a817] shadow-[0_0_16px_#e6a81730] hover:shadow-[0_0_24px_#e6a81750] hover:bg-[#e6a817]/25"
                : "border-[#4a3f6b] bg-[#2a2a4a]/60 text-[#8a7faa] hover:text-[#c0b0e0] hover:border-[#6a5f8b]"
            )}
            style={{ fontFamily: "'Noto Sans SC', sans-serif" }}
          >
            <Icon size={18} strokeWidth={2} />
            <span className="text-sm font-medium">{btn.label}</span>
          </button>
        );
      })}
    </div>
  );
}
