import { cn } from "@/lib/utils";
import { Radio, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

type AudioStatus = "idle" | "processing" | "completed" | "error";

interface HeaderProps {
  className?: string;
  currentAudioName?: string;
  status?: AudioStatus;
}

const statusConfig: Record<
  AudioStatus,
  { label: string; icon: typeof Radio; color: string; spinner?: boolean }
> = {
  idle: { label: "待处理", icon: Radio, color: "text-text-muted" },
  processing: { label: "处理中", icon: Loader2, color: "text-accent-cyan", spinner: true },
  completed: { label: "已完成", icon: CheckCircle2, color: "text-accent-green" },
  error: { label: "处理失败", icon: AlertCircle, color: "text-accent-red" },
};

export default function Header({
  className,
  currentAudioName,
  status = "idle",
}: HeaderProps) {
  const config = statusConfig[status];
  const StatusIcon = config.icon;

  return (
    <header
      className={cn(
        "h-16 bg-bg-secondary border-b border-border-default flex items-center justify-between px-6",
        className
      )}
    >
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold text-text-primary">
          播客响度批量修正工具
        </h1>
      </div>
      <div className="flex items-center gap-4">
        {currentAudioName && (
        <div className="flex items-center gap-3 px-4 py-2 rounded-lg bg-bg-tertiary border border-border-default">
          <span className="text-text-secondary text-sm truncate max-w-[200px]">
            {currentAudioName}
          </span>
          <div className="flex items-center gap-1.5">
            <StatusIcon
              className={cn(
                "w-4 h-4",
                config.color,
                config.spinner && "animate-spin"
              )}
            />
            <span className={cn("text-xs font-medium", config.color)}>
              {config.label}
            </span>
          </div>
        </div>
      )}
      </div>
    </header>
  );
}
