import { CheckCircle, AlertCircle, Edit3 } from "lucide-react"
import { useAppStore } from "@/store/useAppStore"
import ConfirmedList from "@/components/Evaluation/ConfirmedList"
import PendingList from "@/components/Evaluation/PendingList"
import ModifiedList from "@/components/Evaluation/ModifiedList"

const sections = [
  {
    title: "已确认记录",
    icon: CheckCircle,
    iconColor: "text-emerald-500",
    component: ConfirmedList,
  },
  {
    title: "待补记录",
    icon: AlertCircle,
    iconColor: "text-red-500",
    component: PendingList,
  },
  {
    title: "人工改动记录",
    icon: Edit3,
    iconColor: "text-slate-400",
    component: ModifiedList,
  },
] as const

export default function Evaluation() {
  const selectedExperimentId = useAppStore((s) => s.selectedExperimentId)
  const selectExperiment = useAppStore((s) => s.selectExperiment)
  const experiments = useAppStore((s) => s.experiments)

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="text-xl font-bold text-slate-100">评估说明</h1>

      <div className="mt-4">
        <select
          value={selectedExperimentId ?? ""}
          onChange={(e) => selectExperiment(e.target.value || null)}
          className="rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:border-amber-500"
        >
          <option value="">选择实验</option>
          {experiments.map((exp) => (
            <option key={exp.id} value={exp.id}>
              {exp.name}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-8 flex flex-col gap-8">
        {sections.map(({ title, icon: Icon, iconColor, component: Component }) => (
          <section key={title}>
            <div className="mb-3 flex items-center gap-2">
              <Icon size={18} className={iconColor} />
              <h2 className="text-base font-semibold text-slate-100">{title}</h2>
            </div>
            <Component />
          </section>
        ))}
      </div>
    </div>
  )
}
