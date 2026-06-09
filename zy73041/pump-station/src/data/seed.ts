import type {
  Inspection,
  ChangeRecord,
  NoteRecord,
  Screenshot,
  AlertPoint,
} from '../types'
import { DEFAULT_THRESHOLD, THRESHOLD_VERSION, METRIC_LABELS } from './thresholds'

function buildAlerts(metrics: any, inspectionId: string): AlertPoint[] {
  const alerts: AlertPoint[] = []
  const metricKeys: (keyof typeof DEFAULT_THRESHOLD)[] = [
    'vibration',
    'temperature',
    'pressure',
    'flowRate',
    'current',
  ]
  for (const k of metricKeys) {
    const t = DEFAULT_THRESHOLD[k]
    const v = metrics[k] as number
    let level: 'warning' | 'critical' | null = null
    if (v < t.min || v > t.max) level = 'critical'
    else if (v < t.warningMin || v > t.warningMax) level = 'warning'
    if (level) {
      alerts.push({
        metric: k as any,
        metricLabel: METRIC_LABELS[k],
        value: v,
        thresholdMin: t.min,
        thresholdMax: t.max,
        level,
        formula: `${METRIC_LABELS[k]} = ${v}${v < t.warningMin ? ' < ' + t.warningMin : ' > ' + t.warningMax}（警戒值）${level === 'critical' ? '，超出极限值' : ''}`,
        inspectionId,
      })
    }
  }
  return alerts
}

const now = new Date()
const day = (d: number) => {
  const x = new Date(now)
  x.setDate(x.getDate() - d)
  return x.toISOString().split('T')[0]
}
const time = (baseISO: string, h: number, m: number) => {
  const d = new Date(baseISO)
  d.setHours(h, m, 0, 0)
  return d.toISOString()
}

const _rawInsp: Inspection[] = [
  {
    id: 'INS-20260608-001',
    pumpId: 'P-101A',
    pumpName: '1号取水泵',
    inspectionDate: day(1),
    shift: 'morning',
    inspector: '张伟（早班）',
    source: 'routine',
    rerunCount: 0,
    status: 'normal',
    metrics: { vibration: 3.2, temperature: 52, pressure: 0.62, flowRate: 185, current: 52 },
    parts: [
      { name: '机械密封', model: 'BURGMANN-M74N', replaced: false },
      { name: '滚动轴承', model: 'SKF-6314', replaced: false },
    ],
    alerts: [],
    calcFormulaVersion: THRESHOLD_VERSION,
    calcNotes: '正常巡检，各项指标在稳定区间内',
    createTime: time(day(1), 9, 15),
    updateTime: time(day(1), 9, 15),
  },
  {
    id: 'INS-20260608-002',
    pumpId: 'P-101A',
    pumpName: '1号取水泵',
    inspectionDate: day(1),
    shift: 'afternoon',
    inspector: '王芳（中班）',
    source: 'routine',
    rerunCount: 0,
    status: 'warning',
    metrics: { vibration: 6.8, temperature: 68, pressure: 0.55, flowRate: 178, current: 61 },
    parts: [
      { name: '机械密封', model: 'BURGMANN-M74N', replaced: false },
      { name: '滚动轴承', model: 'SKF-6314', replaced: false },
    ],
    alerts: [],
    calcFormulaVersion: THRESHOLD_VERSION,
    calcNotes: '振动接近上限，中班已登记并加强观察',
    createTime: time(day(1), 15, 40),
    updateTime: time(day(1), 16, 5),
  },
  {
    id: 'INS-20260609-001',
    pumpId: 'P-101A',
    pumpName: '1号取水泵',
    inspectionDate: day(0),
    shift: 'morning',
    inspector: '宋磊（早班调度）',
    source: 'supplement',
    parentId: 'INS-20260608-002',
    rerunCount: 1,
    status: 'pending_confirm',
    metrics: { vibration: 7.3, temperature: 78, pressure: 0.48, flowRate: 150, current: 74 },
    parts: [
      {
        name: '机械密封',
        model: 'BORG-WARNER-170',
        replaced: true,
        originalModel: 'BURGMANN-M74N',
        newModel: 'BORG-WARNER-170',
        replaceTime: time(day(0), 7, 30),
      },
      { name: '滚动轴承', model: 'SKF-6314', replaced: false },
    ],
    alerts: [],
    calcFormulaVersion: THRESHOLD_VERSION,
    calcNotes: '昨夜紧急替换机械密封（原型号缺料），运行数据波动，待主管确认',
    createTime: time(day(0), 8, 50),
    updateTime: time(day(0), 8, 58),
  },
  {
    id: 'INS-20260607-003',
    pumpId: 'P-102B',
    pumpName: '2号加压泵',
    inspectionDate: day(2),
    shift: 'night',
    inspector: '李强（夜班）',
    source: 'routine',
    rerunCount: 0,
    status: 'critical',
    metrics: { vibration: 9.1, temperature: 92, pressure: 0.28, flowRate: 65, current: 98 },
    parts: [
      { name: '机械密封', model: 'BURGMANN-M74N', replaced: false },
      { name: '滚动轴承', model: 'SKF-6314', replaced: false },
    ],
    alerts: [],
    calcFormulaVersion: THRESHOLD_VERSION,
    calcNotes: '多项指标超限，已启动紧急停机预案',
    createTime: time(day(2), 2, 20),
    updateTime: time(day(2), 2, 45),
  },
]
export const seedInspections: Inspection[] = _rawInsp.map((r: Inspection) => ({
  ...r,
  alerts: buildAlerts(r.metrics, r.id),
}))

export const seedChanges: ChangeRecord[] = [
  {
    id: 'CH-001',
    inspectionId: 'INS-20260608-002',
    field: 'metrics.vibration',
    oldValue: '6.5',
    newValue: '6.8',
    operator: '王芳',
    operatorRole: '巡检员（中班）',
    changeTime: time(day(1), 16, 2),
    shift: 'afternoon',
    reason: '复核读数，振动实际比初测略高0.3mm/s',
  },
  {
    id: 'CH-002',
    inspectionId: 'INS-20260608-002',
    field: 'calcNotes',
    oldValue: '中班巡检完成',
    newValue: '振动接近上限，中班已登记并加强观察',
    operator: '王芳',
    operatorRole: '巡检员（中班）',
    changeTime: time(day(1), 16, 5),
    shift: 'afternoon',
    reason: '补充观察结论，提醒夜班注意',
  },
  {
    id: 'CH-003',
    inspectionId: 'INS-20260609-001',
    field: 'parts[0].model',
    oldValue: 'BURGMANN-M74N',
    newValue: 'BORG-WARNER-170',
    operator: '宋磊',
    operatorRole: '调度（早班）',
    changeTime: time(day(0), 8, 52),
    shift: 'morning',
    reason: '昨夜紧急备件替换，原型号库存耗尽',
  },
  {
    id: 'CH-004',
    inspectionId: 'INS-20260607-003',
    field: 'status',
    oldValue: 'warning',
    newValue: 'critical',
    operator: '李强',
    operatorRole: '巡检员（夜班）',
    changeTime: time(day(2), 2, 45),
    shift: 'night',
    reason: '温度持续攀升至92℃，升级为超限状态',
  },
]

export const seedNotes: NoteRecord[] = [
  {
    id: 'NOTE-001',
    inspectionId: 'INS-20260608-002',
    content: '周一早会临时补充：振动6.8mm/s是本班与上一班的关键差异点，上一班为3.2mm/s，增幅112.5%。原判断为"观察"，现调整为"预警跟踪"。',
    author: '宋磊',
    authorRole: '调度（早班）',
    createTime: time(day(0), 8, 30),
    affectedJudgments: [
      '振动从"正常区间"调整为"预警跟踪"',
      '班次交接差异从"平稳"调整为"显著变化"',
      '建议从4小时巡检加密到2小时巡检',
    ],
    screenshotRefs: ['SC-001'],
  },
  {
    id: 'NOTE-002',
    inspectionId: 'INS-20260609-001',
    content: '机械密封型号替换（BURGMANN-M74N → BORG-WARNER-170），运行数据目前高于正常区间。按规则已挂起，不做"假稳定"结论，等待运营主管李总确认。',
    author: '宋磊',
    authorRole: '调度（早班）',
    createTime: time(day(0), 8, 58),
    affectedJudgments: [
      '状态判定从"预警"改为"挂起待确认"',
      '密封件型号不一致，历史曲线可比性需校正',
      '导出报表时需标注"本记录含未确认备件替换"',
    ],
  },
  {
    id: 'NOTE-003',
    inspectionId: 'INS-20260607-003',
    content: '夜班紧急停机：温度从78℃→92℃（1小时内），振动与电流同步恶化，判断为轴承抱死前兆。已停机，工单已转维修班组。',
    author: '李强',
    authorRole: '巡检员（夜班）',
    createTime: time(day(2), 2, 50),
    affectedJudgments: [
      '状态从"预警"升级为"超限/停机"',
      '后续24小时巡检记录将标注"停机中"',
      '维修前不再做"稳定"判断',
    ],
    screenshotRefs: ['SC-002'],
  },
]

function makeSvgDataUrl(title: string, color: string, text: string) {
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="480" height="280" viewBox="0 0 480 280">
    <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${color}" stop-opacity="0.2"/>
      <stop offset="100%" stop-color="${color}" stop-opacity="0.05"/>
    </linearGradient></defs>
    <rect width="480" height="280" fill="url(#g)" rx="8"/>
    <rect x="16" y="16" width="448" height="248" fill="#fff" fill-opacity="0.7" rx="6"/>
    <text x="32" y="52" font-family="sans-serif" font-size="16" font-weight="bold" fill="#1f2937">${title}</text>
    <polyline points="40,200 80,180 120,160 160,140 200,120 240,130 280,100 320,80 360,90 400,70 440,60"
      fill="none" stroke="${color}" stroke-width="3"/>
    <circle cx="280" cy="100" r="5" fill="#ef4444"/>
    <text x="285" y="92" font-family="sans-serif" font-size="11" fill="#ef4444">异常点</text>
    <text x="32" y="255" font-family="sans-serif" font-size="12" fill="#6b7280">${text}</text>
  </svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg.trim())}`
}

export const seedScreenshots: Screenshot[] = [
  {
    id: 'SC-001',
    inspectionId: 'INS-20260608-002',
    name: '振动趋势异常截图',
    dataUrl: makeSvgDataUrl('1号取水泵 - 振动趋势 (中班)', '#f59e0b', '图中折线 16:00 后连续走高，标记为关注点'),
    uploadTime: time(day(0), 8, 32),
    description: '早会提交：与早班3.2对比，中班6.8已进入预警区',
  },
  {
    id: 'SC-002',
    inspectionId: 'INS-20260607-003',
    name: '夜班紧急停机趋势',
    dataUrl: makeSvgDataUrl('2号加压泵 - 温度趋势 (夜班)', '#dc2626', '温度92℃超限，已触发紧急停机流程'),
    uploadTime: time(day(2), 2, 52),
    description: '与报警截图同时提交，维修班前已完成断电挂牌',
  },
]

export function makeId(prefix: string) {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
}
