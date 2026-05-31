import { Settings, FileDown, Copy, ClipboardCheck } from 'lucide-react'

const guideSections = [
  {
    icon: FileDown,
    title: '配置文件样例放置指引',
    steps: [
      {
        title: '放置位置',
        content:
          '将配置文件样例放在项目的 /config/samples/ 目录下，文件名格式为 {service-name}-config-sample.yaml',
      },
      {
        title: '命名规范',
        content:
          '使用小写字母与连字符，如：order-service-config-sample.yaml、payment-gateway-config-sample.yaml',
      },
      {
        title: '样例内容',
        content:
          '样例文件须包含完整的配置字段与注释说明，占位值用 <PLACEHOLDER> 标注，方便运维对照填写',
      },
    ],
  },
  {
    icon: Copy,
    title: '重复执行风险与规避',
    steps: [
      {
        title: '风险场景',
        content:
          '重复执行巡检时，如果"人工改过"记录已被确认，再次执行会将状态重置，导致已确认的改动被标记为待确认',
      },
      {
        title: '查看方法',
        content:
          '在运行账本页面，"人工改过"栏中的记录变更对比不会因重复执行而丢失。如发现状态被重置，可通过变更对比重新确认',
      },
      {
        title: '规避建议',
        content:
          '导出账本后再执行重新巡检；如需保留确认状态，请勿点击侧栏"重新巡检"按钮，改用手动刷新页面',
      },
    ],
  },
  {
    icon: ClipboardCheck,
    title: '导出前复核流程',
    steps: [
      {
        title: '第一步：检查待补区',
        content:
          '确认"待补材料"栏中所有记录的缺失材料信息是否完整、补交截止是否合理',
      },
      {
        title: '第二步：检查人工改过区',
        content:
          '确认"人工改过"栏中每条记录的变更前后对比是否准确，改动备注是否充分',
      },
      {
        title: '第三步：确认处理口径',
        content:
          '检查各记录的处理口径是否与当前值班策略一致，如有偏差需手动修正后重新导出',
      },
      {
        title: '第四步：点击导出',
        content:
          '通过复核后点击"导出账本"按钮，选择 JSON 或 CSV 格式下载。导出文件可直接转发至值班群',
      },
    ],
  },
]

export default function Guide() {
  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Settings size={24} className="text-indigo-950" />
        <h2 className="text-2xl font-bold text-indigo-950">配置与说明</h2>
      </div>

      <div className="space-y-8">
        {guideSections.map((section) => (
          <div key={section.title}>
            <div className="flex items-center gap-2 mb-4">
              <section.icon size={20} className="text-amber-500" />
              <h3 className="text-lg font-bold text-indigo-950">{section.title}</h3>
            </div>
            <div className="space-y-3">
              {section.steps.map((step, idx) => (
                <div
                  key={step.title}
                  className="bg-white rounded-lg border border-slate-200 px-5 py-4 shadow-sm flex gap-4"
                >
                  <span className="shrink-0 w-7 h-7 rounded-full bg-indigo-950 text-white text-xs font-bold flex items-center justify-center">
                    {idx + 1}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{step.title}</p>
                    <p className="text-sm text-slate-600 mt-1 leading-relaxed">{step.content}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
