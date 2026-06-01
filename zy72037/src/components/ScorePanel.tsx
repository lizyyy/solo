import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface ScorePanelProps {
  score: number;
  combo: number;
  maxCombo: number;
}

export default function ScorePanel({ score, combo, maxCombo }: ScorePanelProps) {
  const [prevScore, setPrevScore] = useState(score);
  const [pulsing, setPulsing] = useState(false);

  useEffect(() => {
    if (score !== prevScore) {
      setPulsing(true);
      const timer = setTimeout(() => setPulsing(false), 400);
      setPrevScore(score);
      return () => clearTimeout(timer);
    }
  }, [score, prevScore]);

  const multiplier = combo >= 2 ? 1.5 : 1;

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={cn(
          "text-4xl font-bold tabular-nums transition-transform duration-300",
          pulsing && "animate-score-pulse"
        )}
        style={{
          color: "#e6a817",
          fontFamily: "'Playfair Display', serif",
          textShadow: pulsing ? "0 0 20px #e6a81780" : "none",
        }}
      >
        {score}
      </div>

      <div className="flex items-center gap-2">
        <span
          className={cn(
            "text-xs px-2 py-0.5 rounded-full font-medium transition-all duration-300",
            combo >= 2
              ? "bg-[#e6a817]/20 text-[#e6a817] border border-[#e6a817]/40 shadow-[0_0_12px_#e6a81730]"
              : "bg-[#4a3f6b] text-[#8a7faa] border border-[#4a3f6b]"
          )}
          style={{ fontFamily: "'Noto Sans SC', sans-serif" }}
        >
          连击 {combo}
        </span>

        {combo >= 2 && (
          <span
            className="text-xs px-2 py-0.5 rounded-full font-bold bg-[#2ecc71]/20 text-[#2ecc71] border border-[#2ecc71]/40 animate-combo-glow"
            style={{ fontFamily: "'Noto Sans SC', sans-serif" }}
          >
            x{multiplier}
          </span>
        )}
      </div>

      <span
        className="text-[10px] text-[#6a5f8b]"
        style={{ fontFamily: "'Noto Sans SC', sans-serif" }}
      >
        最高连击 {maxCombo}
      </span>
    </div>
  );
}
