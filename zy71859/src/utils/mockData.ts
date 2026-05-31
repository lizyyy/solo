import { PracticeRecord, Part, Script, AuditLog, BatchTask } from '@/types'

const studentNames = [
  '李明', '王芳', '张伟', '刘洋', '陈静',
  '杨帆', '赵磊', '周婷', '吴强', '郑丽',
  '孙浩', '马超', '朱琳', '胡军', '郭燕',
]

const partTypes = ['电阻', '电容', '集成电路', '二极管', '三极管', '连接器']
const suppliers = ['电子科技有限公司', '创新元器件', '精密电子', '环球半导体']

function generateId(prefix: string, index: number): string {
  return `${prefix}_${String(index).padStart(4, '0')}`
}

function randomDate(start: Date, end: Date): string {
  return new Date(
    start.getTime() + Math.random() * (end.getTime() - start.getTime())
  ).toISOString()
}

function randomScore(): number {
  return Math.floor(Math.random() * 40) + 60
}

function randomStatus(): PracticeRecord['status'] {
  const statuses: PracticeRecord['status'][] = ['pending', 'processing', 'completed', 'failed']
  return statuses[Math.floor(Math.random() * statuses.length)]
}

export function generateMockData(): {
  records: PracticeRecord[]
  parts: Part[]
  scripts: Script[]
  auditLogs: AuditLog[]
  batchTasks: BatchTask[]
} {
  const parts: Part[] = Array.from({ length: 15 }, (_, i) => ({
    id: generateId('part', i + 1),
    name: `${partTypes[i % partTypes.length]} ${String(i + 1).padStart(3, '0')}`,
    type: partTypes[i % partTypes.length],
    quantity: Math.floor(Math.random() * 100) + 10,
    specification: `${Math.floor(Math.random() * 1000) + 100}Ω/μF/V`,
    supplier: suppliers[i % suppliers.length],
    createdAt: randomDate(new Date('2024-01-01'), new Date('2024-06-01')),
  }))

  const scripts: Script[] = [
    {
      id: 'script_001',
      title: '基础电阻焊接教程',
      version: 'v1.2',
      content: '步骤1：准备工具和材料\n步骤2：清洁焊盘\n步骤3：涂抹焊锡膏\n步骤4：放置电阻\n步骤5：加热焊接\n步骤6：检查质量',
      createdAt: '2024-01-15T00:00:00.000Z',
      updatedAt: '2024-03-20T00:00:00.000Z',
    },
    {
      id: 'script_002',
      title: 'SMT芯片焊接指南',
      version: 'v2.0',
      content: '步骤1：芯片定位\n步骤2：引脚对齐\n步骤3：固定对角引脚\n步骤4：逐引脚焊接\n步骤5：连锡修复\n步骤6：清洗残留',
      createdAt: '2024-02-01T00:00:00.000Z',
      updatedAt: '2024-04-10T00:00:00.000Z',
    },
    {
      id: 'script_003',
      title: '连接器焊接规范',
      version: 'v1.0',
      content: '步骤1：连接器固定\n步骤2：引脚预处理\n步骤3：顺序焊接\n步骤4：应力释放',
      createdAt: '2024-03-01T00:00:00.000Z',
      updatedAt: '2024-03-01T00:00:00.000Z',
    },
  ]

  const records: PracticeRecord[] = Array.from({ length: 45 }, (_, i) => ({
    id: generateId('rec', i + 1),
    studentName: studentNames[i % studentNames.length],
    studentId: `S${String(2024001 + i).padStart(7, '0')}`,
    partId: parts[Math.floor(Math.random() * parts.length)].id,
    scriptId: scripts[Math.floor(Math.random() * scripts.length)].id,
    status: randomStatus(),
    score: randomScore(),
    practiceDate: randomDate(new Date('2024-05-01'), new Date()),
    operator: '张老师',
    createdAt: randomDate(new Date('2024-05-01'), new Date()),
    updatedAt: randomDate(new Date('2024-05-01'), new Date()),
    remark: Math.random() > 0.7 ? '注意焊接温度控制' : undefined,
  }))

  const auditLogs: AuditLog[] = records.slice(0, 10).map((record, i) => ({
    id: `log_init_${i}`,
    action: 'create' as const,
    operator: '系统初始化',
    targetType: 'record' as const,
    targetId: record.id,
    afterData: JSON.stringify(record),
    createdAt: record.createdAt,
  }))

  const batchTasks: BatchTask[] = [
    {
      id: 'task_init_001',
      type: 'import',
      status: 'completed',
      total: 45,
      success: 45,
      failed: 0,
      operator: '系统初始化',
      createdAt: '2024-05-01T00:00:00.000Z',
    },
  ]

  return { records, parts, scripts, auditLogs, batchTasks }
}
