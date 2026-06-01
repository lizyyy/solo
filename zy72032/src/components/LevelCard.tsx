import { Check, Zap, Target } from "lucide-react"
import type { LevelPack, Difficulty } from "@/types"
import { cn } from "@/lib/utils"

interface LevelCardProps {
  pack: LevelPack
  selected: boolean
  onSelect: () => void
}

const difficultyConfig: Record<Difficulty, { icon: typeof Zap; color: string; bg: string }> = {
  入门: { icon: Zap, color: "text-success", bg: "bg-success/10 border-success/30" },
  进阶: { icon: Target, color: "text-warning", bg: "bg-warning/10 border-warning/30" },
  挑战: { icon: Target, color: "text-danger", bg: "bg-danger/10 border-danger/30" },
}

export default function LevelCard({ pack, selected, onSelect }: LevelCardProps) {
  const config = difficultyConfig[pack.difficulty]
  const Icon = config.icon

  return (
    <button
      onClick={onSelect}
      className={cn(
        "card p-6 text-left transition-all duration-300 hover:-translate-y-1",
        selected
          ? "border-brand-400 ring-2 ring-brand-400/50 shadow-xl shadow-brand-400/20"
          : "hover:border-slate-600"
      )}
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold mb-1">{pack.name}</h3>
          <p className="text-sm text-slate-400">{pack.description}</p>
        </div>
        {selected && (
          <div className="w-6 h-6 rounded-full bg-brand-400 flex items-center justify-center">
            <Check className="w-4 h-4 text-white" />
          </div>
        )}
      </div>

      <div className="flex items-center gap-4 text-sm">
        <div className={cn("tag gap-1", config.bg, config.color)}>
          <Icon className="w-3 h-3" />
          {pack.difficulty}
        </div>
        <div className="text-slate-400">
          {pack.scenarios.length} 个场景
        </div>
        <div className="text-slate-400">
          及格线 {pack.passingScore} 分
        </div>
      </div>
    </button>
  )
}
