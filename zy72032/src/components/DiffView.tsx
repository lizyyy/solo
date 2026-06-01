import { ArrowRight } from "lucide-react"
import type { SupplementRecord } from "@/types"

interface DiffViewProps {
  supplement: SupplementRecord
  fields?: { name: string; oldValue: string; newValue: string }[]
}

export default function DiffView({ supplement, fields }: DiffViewProps) {
  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm">
          <span className="tag tag-info mr-2">{supplement.source}</span>
          <span className="text-slate-400">
            {new Date(supplement.timestamp).toLocaleString("zh-CN")}
          </span>
        </div>
      </div>

      <p className="text-slate-300 mb-4 text-sm">{supplement.content}</p>

      <div className="space-y-2">
        {supplement.previousScore !== undefined &&
          supplement.newScore !== undefined && (
            <div className="flex items-center gap-3 p-2 bg-warning/10 rounded-lg">
              <span className="text-sm text-slate-400 w-16">总分</span>
              <span className="font-mono text-danger">
                {supplement.previousScore}
              </span>
              <ArrowRight className="w-4 h-4 text-slate-500" />
              <span className="font-mono text-warning">
                {supplement.newScore}
              </span>
            </div>
          )}
        {fields?.map((field, idx) => (
          <div key={idx} className="flex items-center gap-3 p-2 bg-slate-700/30 rounded-lg">
            <span className="text-sm text-slate-400 w-16">{field.name}</span>
            <span className="text-sm text-danger line-through">
              {field.oldValue}
            </span>
            <ArrowRight className="w-4 h-4 text-slate-500" />
            <span className="text-sm text-success">{field.newValue}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
