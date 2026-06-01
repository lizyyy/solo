import { useEffect } from "react";
import type { FeedbackInfo } from "@/types";
import { cn } from "@/lib/utils";

interface FeedbackOverlayProps {
  feedback: FeedbackInfo | null;
  onDismiss: () => void;
}

export default function FeedbackOverlay({
  feedback,
  onDismiss,
}: FeedbackOverlayProps) {
  useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(onDismiss, 2000);
    return () => clearTimeout(timer);
  }, [feedback, onDismiss]);

  if (!feedback) return null;

  const isCorrect = feedback.correct;

  return (
    <div
      className={cn(
        "fixed top-6 left-1/2 -translate-x-1/2 z-50",
        "animate-slide-in"
      )}
    >
      <div
        className={cn(
          "min-w-[280px] max-w-[400px] rounded-2xl px-6 py-4",
          "shadow-2xl backdrop-blur-sm",
          "border",
          isCorrect
            ? "bg-[#2ecc71]/15 border-[#2ecc71]/50 shadow-[0_0_30px_#2ecc7130]"
            : "bg-[#e74c3c]/15 border-[#e74c3c]/50 shadow-[0_0_30px_#e74c3c30]"
        )}
      >
        <div className="flex items-center gap-3 mb-1">
          <span className="text-2xl">{isCorrect ? "🎶" : "🎵"}</span>
          <span
            className={cn(
              "text-lg font-bold",
              isCorrect ? "text-[#2ecc71]" : "text-[#e74c3c]"
            )}
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            {feedback.message}
          </span>
        </div>
        <p
          className={cn(
            "text-sm pl-11",
            isCorrect ? "text-[#2ecc71]/80" : "text-[#e74c3c]/80"
          )}
          style={{ fontFamily: "'Noto Sans SC', sans-serif" }}
        >
          {feedback.detail}
        </p>
      </div>
    </div>
  );
}
