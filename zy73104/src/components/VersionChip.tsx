import type { DrawingVersion } from "shared/types";
import { cn } from "@/lib/utils";

interface VersionChipProps {
  version: DrawingVersion;
  className?: string;
}

export default function VersionChip({ version, className }: VersionChipProps) {
  const { version: label, isLatest, isValid } = version;

  if (!isValid) {
    return (
      <span
        className={cn(
          "chip border border-ink-200 bg-ink-50 text-ink-500 line-through",
          className
        )}
      >
        {label} 已失效
      </span>
    );
  }

  return (
    <span className={cn("chip border border-ink-200 bg-ink-50 text-ink-700", className)}>
      {label}
      {isLatest && (
        <span className="ml-1 chip bg-accent-confirmed text-white border border-accent-confirmed">
          最新
        </span>
      )}
    </span>
  );
}
