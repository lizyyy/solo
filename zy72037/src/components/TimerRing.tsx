import { useMemo } from "react";

interface TimerRingProps {
  timeLeft: number;
  totalTime: number;
}

export default function TimerRing({ timeLeft, totalTime }: TimerRingProps) {
  const radius = 54;
  const stroke = 6;
  const normalizedRadius = radius - stroke / 2;
  const circumference = normalizedRadius * 2 * Math.PI;

  const progress = totalTime > 0 ? timeLeft / totalTime : 1;
  const strokeDashoffset = circumference * (1 - progress);

  const seconds = (timeLeft / 10).toFixed(1);

  const color = useMemo(() => {
    if (progress > 0.5) return "#e6a817";
    if (progress > 0.25) return "#f39c12";
    return "#e74c3c";
  }, [progress]);

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={radius * 2} height={radius * 2} className="transform -rotate-90">
        <circle
          cx={radius}
          cy={radius}
          r={normalizedRadius}
          fill="none"
          stroke="#2a2a4a"
          strokeWidth={stroke}
        />
        <circle
          cx={radius}
          cy={radius}
          r={normalizedRadius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-100 ease-linear"
          style={{
            filter: `drop-shadow(0 0 6px ${color}80)`,
          }}
        />
      </svg>
      <span
        className="absolute font-bold text-lg tabular-nums"
        style={{ color, fontFamily: "'Playfair Display', serif" }}
      >
        {seconds}s
      </span>
    </div>
  );
}
