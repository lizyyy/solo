import { FileInput, Eye, ClipboardCheck } from "lucide-react"

const steps = [
  {
    num: "01",
    icon: <FileInput size={20} className="text-amber-500" />,
    title: "放灰度记录样例",
    items: [
      "进入「版本巡检」页面，点击上方「摄入数据包」按钮，系统将模拟摄入一包混合材料",
      "摄入的数据包中会包含：正常灰度发布记录、晚到附件（系统会自动标记「晚到」标签）、重复推送项（自动标记「重复」标签）以及人工更正记录",
      "如果需要手动新增灰度记录样例，可在巡检列表中观察已摄入数据的格式，后续对接真实数据源时按相同字段提供即可",
      "晚到附件和重复项在时间线页面中也会以标签形式出现，方便快速识别",
    ],
  },
  {
    num: "02",
    icon: <Eye size={20} className="text-rose-500" />,
    title: "查敏感词漏脱敏",
    items: [
      "在「统一时间线」页面，用状态筛选选择「待补」，查看所有未完成处理的记录",
      "点击来源筛选中的「质检表」，聚焦质检维度的待处理项",
      '每条待处理记录的摘要和橙色「待处理原因」区域会说明漏脱敏的具体情况（如"3 条敏感词未脱敏"）',
      "进入「版本巡检」页面，点击对应记录行打开右侧详情抽屉，查看变更历史中操作人的具体备注",
    ],
  },
  {
    num: "03",
    icon: <ClipboardCheck size={20} className="text-emerald-500" />,
    title: "导出质检周报前复核",
    items: [
      "进入「质检周报」页面，依次切换三个 Tab（已确认 / 待补 / 人工改过），确认每条记录的「处理口径」描述准确",
      "重点检查「待补」Tab 下的记录：是否所有待补项都已标注处理口径？是否有标记为待补但实际已处理的遗漏？",
      "检查「人工改过」Tab：确认更正原因描述清晰，业务负责人能理解为什么需要人工介入",
      "确认无误后，点击页面右上角「导出周报」按钮，将生成 HTML 格式周报文件，可直接发送给业务负责人",
    ],
  },
]

export default function GuidePage() {
  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-slate-800">收尾说明</h2>
        <p className="text-sm text-slate-500 mt-1">运营分析师操作备忘</p>
      </div>

      <div className="space-y-5">
        {steps.map((step) => (
          <div key={step.num} className="bg-white rounded-lg border border-slate-200 p-6 hover:shadow-sm transition-shadow">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-2xl font-bold text-slate-200 font-mono">{step.num}</span>
              <div className="flex items-center gap-2">
                {step.icon}
                <h3 className="text-base font-semibold text-slate-800">{step.title}</h3>
              </div>
            </div>
            <ol className="space-y-2.5 pl-2">
              {step.items.map((item, i) => (
                <li key={i} className="flex gap-2.5 text-sm text-slate-600 leading-relaxed">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-slate-100 text-slate-500 text-[10px] flex items-center justify-center font-medium mt-0.5">
                    {i + 1}
                  </span>
                  {item}
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </div>
  )
}
