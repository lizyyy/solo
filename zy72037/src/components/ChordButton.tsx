import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";

interface ChordButtonProps {
  label: string;
  onClick: () => void;
  disabled: boolean;
  isCorrect: boolean | null;
  showResult: boolean;
}

export default function ChordButton({
  label,
  onClick,
  disabled,
  isCorrect,
  showResult,
}: ChordButtonProps) {
  const [ripples, setRipples] = useState<
    { id: number; x: number; y: number }[]
  >([]);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      if (disabled) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const id = Date.now();
      setRipples((prev) => [...prev, { id, x, y }]);
      setTimeout(() => {
        setRipples((prev) => prev.filter((r) => r.id !== id));
      }, 600);
      onClick();
    },
    [disabled, onClick]
  );

  const ringColor = showResult
    ? isCorrect
      ? "ring-2 ring-[#2ecc71] shadow-[0_0_20px_#2ecc7180]"
      : "ring-2 ring-[#e74c3c] shadow-[0_0_20px_#e74c3c80]"
    : "";

  const borderColor = showResult
    ? isCorrect
      ? "border-[#2ecc71]"
      : "border-[#e74c3c]"
    : "border-[#e6a817]/60";

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      className={cn(
        "relative overflow-hidden",
        "min-w-[120px] px-6 py-3",
        "rounded-xl border-2 bg-[#4a3f6b]",
        "text-[#f0e6d3] text-lg font-semibold",
        "transition-all duration-300 ease-out",
        "hover:shadow-[0_0_24px_#e6a81740] hover:border-[#e6a817]",
        "active:scale-95",
        "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-none",
        borderColor,
        ringColor
      )}
    >
      <span className="relative z-10" style={{ fontFamily: "'Playfair Display', serif" }}>
        {label}
      </span>
      {ripples.map((ripple) => (
        <span
          key={ripple.id}
          className="absolute rounded-full bg-white/30 animate-ripple pointer-events-none"
          style={{
            left: ripple.x - 10,
            top: ripple.y - 10,
            width: 20,
            height: 20,
          }}
        />
      ))}
    </button>
  );
}
