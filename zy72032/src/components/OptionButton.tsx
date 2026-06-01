import { cn } from "@/lib/utils"
import type { Option } from "@/types"

interface OptionButtonProps {
  option: Option
  disabled?: boolean
  onClick: () => void
  index: number
}

const labelColors = ["bg-brand-400", "bg-success", "bg-warning", "bg-danger"]

export default function OptionButton({
  option,
  disabled,
  onClick,
  index,
}: OptionButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "group w-full text-left p-5 rounded-xl border-2 border-slate-700/50 bg-slate-800/50",
        "transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-400/50 hover:bg-slate-800",
        "hover:shadow-lg hover:shadow-brand-400/10",
        "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0",
        "animate-slide-up"
      )}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="flex items-start gap-4">
        <div
          className={cn(
            "w-10 h-10 rounded-lg flex items-center justify-center font-bold text-white flex-shrink-0 transition-transform group-hover:scale-110",
            labelColors[index % labelColors.length]
          )}
        >
          {option.label}
        </div>
        <div className="flex-1 pt-1">
          <p className="text-base leading-relaxed">{option.text}</p>
        </div>
      </div>
    </button>
  )
}
