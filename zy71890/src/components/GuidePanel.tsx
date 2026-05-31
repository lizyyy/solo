import { BookOpen, FileText, AlertCircle, ClipboardCheck } from "lucide-react"

const guides = [
  {
    icon: FileText,
    title: "如何放置工况日志样例",
    content: "进入「数据导入」页面，点击上传区或将 JSON/CSV 文件拖入。样例文件应包含 timestamp、vibrationValue、unit、equipmentId 四个必要字段。系统会自动校验格式和内容。",
  },
  {
    icon: AlertCircle,
    title: "去哪看故障复现顺序错",
    content: "在「巡检时间线」页面，所有事件按时间排列。如果阈值触发出现在维修单之后，说明故障复现顺序可能有问题——请重点关注时间线上橙色（阈值）和红色（维修单）节点的先后关系。校验结果中也会标注晚到附件。",
  },
  {
    icon: ClipboardCheck,
    title: "导出巡检报告前怎么复核",
    content: "在「巡检报告」页面点击「导出报告」按钮，系统会弹出复核清单：确认待补记录已处理、重复项已排除、所有记录已标注处理口径、已人工复核内容。四项全部打勾后才能导出。",
  },
]

export default function GuidePanel() {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="mb-4 flex items-center gap-2">
        <BookOpen className="h-4 w-4 text-slate-600" />
        <h3 className="text-sm font-semibold text-slate-800">收尾说明</h3>
      </div>
      <div className="space-y-4">
        {guides.map((g) => {
          const Icon = g.icon
          return (
            <div key={g.title} className="flex gap-3">
              <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded bg-slate-100">
                <Icon className="h-3.5 w-3.5 text-slate-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-700">{g.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">{g.content}</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
