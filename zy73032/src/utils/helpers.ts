export const SAMPLE_CSV = `pet_name,course_name,course_date,duration_min,trainer
小黄,基础服从课,2026-06-01,60,阿岑
阿黑,社交课,2026-06-02,45,阿岑
黄黄,基础服从课,2026-06-03,60,阿岑
黑妞,唤回课,2026-06-04,30,阿岑
`

export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function formatDateCN(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
  } catch {
    return dateStr
  }
}

export function formatDateTimeCN(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    const hh = String(d.getHours()).padStart(2, '0')
    const mi = String(d.getMinutes()).padStart(2, '0')
    return `${d.getFullYear()}-${mm}-${dd} ${hh}:${mi}`
  } catch {
    return dateStr
  }
}

export const ONBOARDING_STEPS = [
  {
    id: 1,
    title: '先看总览',
    description: '汇总卡区分正常排程和异常隔离，待确认数和异常数带徽标提示。',
    actionLabel: '前往总览',
    to: '/',
    tip: '异常排程不计入正常汇总，不会和正常数据揉在一起。',
  },
  {
    id: 2,
    title: '导入训练课CSV',
    description: '上传排程CSV，系统按宠物别名自动归类，未绑定的别名会进入异常区。',
    actionLabel: '去导入CSV',
    to: '/import',
    tip: '导入后先别急着确认，看看异常区有没有需要先处理的别名。',
  },
  {
    id: 3,
    title: '录入手写病历单',
    description: '把病历手写单录进来，系统会按宠物名和日期尝试关联到训练课排程。',
    actionLabel: '录入手写单',
    to: '/import',
    tip: '录入时会附带一条正常记录样例，方便对照确认逻辑。',
  },
  {
    id: 4,
    title: '逐条确认排程明细',
    description: '待确认的排程可以展开查看来源、关联病历、操作轨迹，然后人工确认。',
    actionLabel: '去排程明细',
    to: '/schedules',
    tip: '确认前后的字段变化会写入操作日志，公示复盘时能直接对照。',
  },
  {
    id: 5,
    title: '处理异常别名',
    description: '每条异常都写明了需要补看的来源和影响范围，绑定到规范宠物后自动回到正常汇总。',
    actionLabel: '查看异常',
    to: '/anomalies',
    tip: '别直接确认异常记录，先绑定别名，不然会揉进正常汇总。',
  },
  {
    id: 6,
    title: '打开操作日志复盘',
    description: '所有确认、撤回、绑定别名都留痕，能看到改前改后是谁做的、为什么改。',
    actionLabel: '操作日志',
    to: '/logs',
    tip: '社区公示前就在这里并排对比确认前后，变动原因不会断在中间。',
  },
  {
    id: 7,
    title: '导出CSV对接别人',
    description: '导出排程明细CSV，包含状态、来源、异常原因，小乔拿去和别人对账就行。',
    actionLabel: '回到总览',
    to: '/',
    tip: '导出的CSV和页面上看到的是同一份SQLite数据，口径一致。',
  },
]
