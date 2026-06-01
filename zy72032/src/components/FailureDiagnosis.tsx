import { AlertCircle, Clock } from "lucide-react"
import type { FailureType } from "@/types"
import { cn } from "@/lib/utils"

interface FailureDiagnosisProps {
  type: FailureType
  detail: string
}

const config: Record<FailureType, { icon: typeof AlertCircle; bg: string; border: string; title: string }> = {
  "规则未理解": {
    icon: AlertCircle,
    bg: "bg-danger/10",
    border: "border-danger/30",
    title: "看起来规则这块还需要再熟悉一下",
  },
  "操作偏慢": {
    icon: Clock,
    bg: "bg-warning/10",
    border: "border-warning/30",
    title: "反应速度这块还可以再提一提",
  },
}

export default function FailureDiagnosis({ type, detail }: FailureDiagnosisProps) {
  const cfg = config[type]
  const Icon = cfg.icon

  return (
    <div
      className={cn(
        "card p-6 border-2",
        cfg.bg,
        cfg.border,
        "animate-fade-in"
      )}
    >
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
          <Icon className="w-6 h-6 text-white" />
        </div>
        <div>
          <h3 className="text-lg font-bold mb-2">{cfg.title}</h3>
          <p className="text-slate-300 prose-like leading-relaxed">
            {detail}
          </p>
        </div>
      </div>
    </div>
  )
}
