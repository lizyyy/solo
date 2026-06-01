import { cn } from "@/lib/utils";

interface LevelProgressProps {
  current: number;
  total: number;
  levelName: string;
}

export default function LevelProgress({
  current,
  total,
  levelName,
}: LevelProgressProps) {
  const progress = total > 0 ? current / total : 0;

  return (
    <div className="w-full max-w-md">
      <div className="flex items-center justify-between mb-2">
        <span
          className="text-sm font-medium text-[#c0b0e0]"
          style={{ fontFamily: "'Noto Sans SC', sans-serif" }}
        >
          {levelName}
        </span>
        <span
          className="text-xs tabular-nums text-[#8a7faa]"
          style={{ fontFamily: "'Noto Sans SC', sans-serif" }}
        >
          {current} / {total}
        </span>
      </div>

      <div className="relative h-2 rounded-full bg-[#2a2a4a] overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-500 ease-out"
          style={{
            width: `${progress * 100}%`,
            background: "linear-gradient(90deg, #e6a817, #f0c040)",
            boxShadow: "0 0 10px #e6a81760",
          }}
        />
      </div>

      <div className="relative mt-1 h-4">
        {Array.from({ length: total }, (_, i) => {
          const pos = total > 1 ? (i / (total - 1)) * 100 : 0;
          const isPassed = i < current;
          const isCurrent = i === current;

          return (
            <span
              key={i}
              className="absolute top-0 -translate-x-1/2"
              style={{ left: `${pos}%` }}
            >
              <span
                className={cn(
                  "block w-2 h-2 rounded-full transition-all duration-300",
                  isPassed
                    ? "bg-[#e6a817] shadow-[0_0_6px_#e6a81780]"
                    : isCurrent
                      ? "bg-[#e6a817]/60 shadow-[0_0_8px_#e6a81740] animate-dot-pulse"
                      : "bg-[#4a3f6b]"
                )}
              />
            </span>
          );
        })}
      </div>
    </div>
  );
}
