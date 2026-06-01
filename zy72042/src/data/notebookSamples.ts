import type { NotebookEntry } from '@/types'

export const NOTEBOOK_SAMPLES: NotebookEntry[] = [
  {
    id: 'nb-001',
    studentName: '张同学',
    levelId: 'smooth-a',
    issue: '配比未达到目标分数75',
    score: 68,
    timestamp: Date.now() - 86400000,
  },
  {
    id: 'nb-002',
    studentName: '李同学',
    levelId: 'rework-b',
    issue: '风险超限0.5，实际0.72',
    score: 82,
    timestamp: Date.now() - 72000000,
  },
  {
    id: 'nb-003',
    studentName: '王同学',
    levelId: 'boundary-c',
    issue: '边界分数69，差1分达标',
    score: 69,
    timestamp: Date.now() - 36000000,
  },
  {
    id: 'nb-004',
    studentName: '赵同学',
    levelId: 'smooth-a',
    issue: '操作超时未完成配比',
    score: 45,
    timestamp: Date.now() - 18000000,
  },
]

export const CONFLICT_SAMPLE_SCENARIOS = [
  {
    field: 'score',
    notebookValue: '68',
    importedValue: '72',
    suggestion: '错题本记录68分，但导入数据显示72分。可能是补考后更新了分数但错题本未同步。建议：核对原始考试记录。',
  },
  {
    field: 'risk',
    notebookValue: '0.72',
    importedValue: '0.48',
    suggestion: '错题本记录风险超限(0.72)，但导入数据显示风险在红线内(0.48)。可能是调整后重新提交了结果。建议：查看操作时间线确认调整记录。',
  },
  {
    field: 'failReason',
    notebookValue: '规则未理解',
    importedValue: '操作超时',
    suggestion: '错题本标注为"规则未理解"，但系统记录为"操作超时"。可能是教师主观判断与系统判定不一致。建议：查看详细操作日志后决定。',
  },
]
