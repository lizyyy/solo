import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface StepIndicatorProps {
  currentStep: 1 | 2 | 3;
}

const steps = [
  { num: 1, label: "铭牌参数确认" },
  { num: 2, label: "维修群截图补看" },
  { num: 3, label: "安全提醒更新" },
] as const;

export default function StepIndicator({ currentStep }: StepIndicatorProps) {
  return (
    <div className="flex items-center">
      {steps.map((step, idx) => {
        const isCompleted = currentStep > step.num;
        const isCurrent = currentStep === step.num;
        const isFuture = currentStep < step.num;

        return (
          <div key={step.num} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition",
                  isCompleted && "bg-emerald-600 text-white",
                  isCurrent && "bg-amber-500 text-white",
                  isFuture && "border-2 border-gray-300 text-gray-400"
                )}
              >
                {isCompleted ? <Check size={16} /> : step.num}
              </div>
              <span
                className={cn(
                  "mt-1.5 text-xs",
                  isCompleted && "text-emerald-600",
                  isCurrent && "font-medium text-amber-600",
                  isFuture && "text-gray-400"
                )}
              >
                {step.label}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <div
                className={cn(
                  "mx-3 h-0.5 w-12",
                  currentStep > step.num ? "bg-emerald-500" : "bg-gray-300"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
