import type { ObstructionHistory } from "@/types"
import { Clock } from "lucide-react"

interface HistoryTimelineProps {
  items: ObstructionHistory[]
}

export default function HistoryTimeline({ items }: HistoryTimelineProps) {
  if (items.length === 0) {
    return <p className="py-4 text-center text-sm text-gray-400">暂无历史记录</p>
  }

  return (
    <ol className="relative border-l border-gray-200 pl-6">
      {items.map((item) => (
        <li key={item.id} className="mb-4 last:mb-0">
          <div className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full bg-blue-500" />
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Clock className="h-3 w-3" />
            <span>{item.timestamp}</span>
            <span className="font-medium text-gray-700">{item.operator}</span>
          </div>
          <p className="mt-0.5 text-sm font-medium text-gray-900">{item.action}</p>
          <p className="text-xs text-gray-500">{item.detail}</p>
        </li>
      ))}
    </ol>
  )
}
