import { create } from 'zustand'
import type {
  Course,
  WeightItem,
  CalculationRecord,
  HistoryEntry,
  WorkflowStep,
  RecordType,
} from '@/types'

interface AppState {
  courses: Course[]
  weights: WeightItem[]
  calculations: CalculationRecord[]
  history: HistoryEntry[]
  steps: WorkflowStep[]
  mixedConfirmed: Record<string, boolean>

  importBoundaryValues: () => void
  confirmMixed: (courseId: string) => void
  supplementOldCaliber: (courseId: string, dimension: string, value: number) => void
  calculate: () => void
  correctRecord: (recordId: string, newScore: number, operator: string) => void
  rerun: () => void
  getCourseWeights: (courseId: string) => WeightItem[]
  getCourseCalculation: (courseId: string) => CalculationRecord | undefined
  getCourseHistory: (courseId: string) => HistoryEntry[]
  getCoursesByType: (type: RecordType) => Course[]
}

const DIMENSIONS = ['内容质量', '互动热度', '完成率', '更新频率', '用户评分']

const INITIAL_COURSES: Course[] = [
  {
    id: 'c1',
    name: 'Python 入门',
    status: 'pending',
    recordType: 'smooth',
    rawScores: { '内容质量': 85, '互动热度': 72, '完成率': 90, '更新频率': 68, '用户评分': 88 },
  },
  {
    id: 'c2',
    name: '数据分析实战',
    status: 'pending',
    recordType: 'mixed',
    rawScores: { '内容质量': 78, '互动热度': 65, '完成率': 82, '更新频率': 55, '用户评分': 80 },
  },
  {
    id: 'c3',
    name: '机器学习基础',
    status: 'pending',
    recordType: 'supplement',
    rawScores: { '内容质量': 92, '互动热度': 58, '完成率': 75, '更新频率': 70, '用户评分': 95 },
  },
]

const INITIAL_WEIGHTS: WeightItem[] = [
  { id: 'w1-1', courseId: 'c1', dimension: '内容质量', rawValue: '0.30', numericValue: 0.30, format: 'decimal', source: 'import', isOldCaliber: false },
  { id: 'w1-2', courseId: 'c1', dimension: '互动热度', rawValue: '0.20', numericValue: 0.20, format: 'decimal', source: 'import', isOldCaliber: false },
  { id: 'w1-3', courseId: 'c1', dimension: '完成率', rawValue: '0.25', numericValue: 0.25, format: 'decimal', source: 'import', isOldCaliber: false },
  { id: 'w1-4', courseId: 'c1', dimension: '更新频率', rawValue: '0.10', numericValue: 0.10, format: 'decimal', source: 'import', isOldCaliber: false },
  { id: 'w1-5', courseId: 'c1', dimension: '用户评分', rawValue: '0.15', numericValue: 0.15, format: 'decimal', source: 'import', isOldCaliber: false },

  { id: 'w2-1', courseId: 'c2', dimension: '内容质量', rawValue: '25%', numericValue: 0.25, format: 'percentage', source: 'import', isOldCaliber: false },
  { id: 'w2-2', courseId: 'c2', dimension: '互动热度', rawValue: '0.30', numericValue: 0.30, format: 'decimal', source: 'import', isOldCaliber: false },
  { id: 'w2-3', courseId: 'c2', dimension: '完成率', rawValue: '20%', numericValue: 0.20, format: 'percentage', source: 'import', isOldCaliber: false },
  { id: 'w2-4', courseId: 'c2', dimension: '更新频率', rawValue: '0.10', numericValue: 0.10, format: 'decimal', source: 'import', isOldCaliber: false },
  { id: 'w2-5', courseId: 'c2', dimension: '用户评分', rawValue: '15%', numericValue: 0.15, format: 'percentage', source: 'import', isOldCaliber: false },

  { id: 'w3-1', courseId: 'c3', dimension: '内容质量', rawValue: '0.25', numericValue: 0.25, format: 'decimal', source: 'import', isOldCaliber: false },
  { id: 'w3-2', courseId: 'c3', dimension: '互动热度', rawValue: '0.20', numericValue: 0.20, format: 'decimal', source: 'import', isOldCaliber: false },
  { id: 'w3-3', courseId: 'c3', dimension: '完成率', rawValue: '0.25', numericValue: 0.25, format: 'decimal', source: 'import', isOldCaliber: false },
  { id: 'w3-4', courseId: 'c3', dimension: '更新频率', rawValue: '0.10', numericValue: 0.10, format: 'decimal', source: 'import', isOldCaliber: false },
  { id: 'w3-5', courseId: 'c3', dimension: '用户评分', rawValue: '0.20', numericValue: 0.20, format: 'decimal', source: 'import', isOldCaliber: false },
]

const INITIAL_STEPS: WorkflowStep[] = [
  { key: 'import', label: '边界值说明导入', description: '第一次导入边界值说明数据，识别并标记异常格式', status: 'active', path: '/import' },
  { key: 'weights', label: '评分权重表补看', description: '教研负责人补看评分权重表，补充旧口径数据', status: 'pending', path: '/weights' },
  { key: 'calculation', label: '计算明细更新', description: '查看计算结果，执行人工修正和重跑', status: 'pending', path: '/calculation' },
]

let nextHistoryId = 1
function makeHistoryId() {
  return `h${nextHistoryId++}`
}

function computeScore(course: Course, weights: WeightItem[]): number {
  const courseWeights = weights.filter(w => w.courseId === course.id)
  let totalWeighted = 0
  let totalWeight = 0
  for (const w of courseWeights) {
    const raw = course.rawScores[w.dimension] ?? 0
    totalWeighted += w.numericValue * raw
    totalWeight += w.numericValue
  }
  return totalWeight > 0 ? Math.round((totalWeighted / totalWeight) * 100) / 100 : 0
}

function computeDetailScores(course: Course, weights: WeightItem[]): Record<string, { weight: number; raw: number; weighted: number }> {
  const courseWeights = weights.filter(w => w.courseId === course.id)
  const result: Record<string, { weight: number; raw: number; weighted: number }> = {}
  for (const w of courseWeights) {
    const raw = course.rawScores[w.dimension] ?? 0
    result[w.dimension] = { weight: w.numericValue, raw, weighted: Math.round(w.numericValue * raw * 100) / 100 }
  }
  return result
}

function now() {
  return new Date().toLocaleString('zh-CN', { hour12: false })
}

export const useStore = create<AppState>((set, get) => ({
  courses: INITIAL_COURSES,
  weights: INITIAL_WEIGHTS,
  calculations: [],
  history: [],
  steps: INITIAL_STEPS,
  mixedConfirmed: {},

  importBoundaryValues: () => {
    const { courses, weights, steps } = get()

    const mixedCourses = courses.filter(c => c.recordType === 'mixed')
    const newHistory: HistoryEntry[] = courses.map(c => ({
      id: makeHistoryId(),
      courseId: c.id,
      action: 'import' as const,
      operator: '吴老师',
      timestamp: now(),
      detail: `导入课程「${c.name}」的边界值说明，共 ${DIMENSIONS.length} 个维度权重`,
    }))

    const hasMixed = mixedCourses.length > 0
    if (hasMixed) {
      for (const c of mixedCourses) {
        newHistory.push({
          id: makeHistoryId(),
          courseId: c.id,
          action: 'import' as const,
          operator: '系统',
          timestamp: now(),
          detail: `检测到「${c.name}」权重格式混用（百分数+小数），已标记为"待复核"，留给活动负责人确认`,
        })
      }
    }

    set({
      courses: courses.map(c => ({ ...c, status: 'reviewing' as const })),
      history: [...get().history, ...newHistory],
      steps: steps.map(s =>
        s.key === 'import' ? { ...s, status: 'completed' as const }
          : s.key === 'weights' ? { ...s, status: 'active' as const }
            : s
      ),
    })
  },

  confirmMixed: (courseId: string) => {
    const { courses, mixedConfirmed, history } = get()
    const course = courses.find(c => c.id === courseId)

    set({
      mixedConfirmed: { ...mixedConfirmed, [courseId]: true },
      history: [
        ...history,
        {
          id: makeHistoryId(),
          courseId,
          action: 'confirm',
          operator: '活动负责人',
          timestamp: now(),
          detail: `活动负责人确认「${course?.name}」的混合格式权重，归入正常计算`,
        },
      ],
    })
  },

  supplementOldCaliber: (courseId: string, dimension: string, value: number) => {
    const { weights, history } = get()
    const course = get().courses.find(c => c.id === courseId)

    const existingIdx = weights.findIndex(w => w.courseId === courseId && w.dimension === dimension)

    const newWeight: WeightItem = {
      id: `w-sup-${courseId}-${dimension}`,
      courseId,
      dimension,
      rawValue: value.toString(),
      numericValue: value,
      format: 'decimal',
      source: 'supplement',
      isOldCaliber: true,
    }

    let newWeights: WeightItem[]
    if (existingIdx >= 0) {
      newWeights = [...weights]
      newWeights[existingIdx] = newWeight
    } else {
      newWeights = [...weights, newWeight]
    }

    set({
      weights: newWeights,
      history: [
        ...history,
        {
          id: makeHistoryId(),
          courseId,
          action: 'supplement',
          operator: '吴老师',
          timestamp: now(),
          detail: `从评分权重表补录「${course?.name}」维度「${dimension}」的旧口径值 ${value}`,
        },
      ],
    })
  },

  calculate: () => {
    const { courses, weights, mixedConfirmed, steps } = get()
    const newCalcs: CalculationRecord[] = []
    const newHistory: HistoryEntry[] = []

    for (const course of courses) {
      const courseWeights = weights.filter(w => w.courseId === course.id)
      const detailScores = computeDetailScores(course, courseWeights)
      const score = computeScore(course, courseWeights)

      let status: CalculationRecord['status'] = 'pass'
      if (course.recordType === 'mixed' && !mixedConfirmed[course.id]) {
        status = 'pending_review'
      }

      newCalcs.push({
        id: `calc-${course.id}`,
        courseId: course.id,
        recordType: course.recordType,
        score,
        detailScores,
        status,
        lastModifiedBy: '系统',
        lastModifiedAt: now(),
      })

      newHistory.push({
        id: makeHistoryId(),
        courseId: course.id,
        action: 'calculate',
        operator: '系统',
        timestamp: now(),
        detail: `计算「${course.name}」最终得分 ${score}，状态：${status === 'pass' ? '通过' : status === 'pending_review' ? '待复核' : '已修正'}`,
      })
    }

    set({
      calculations: newCalcs,
      history: [...get().history, ...newHistory],
      steps: steps.map(s =>
        s.key === 'calculation' ? { ...s, status: 'completed' as const } : s
      ),
    })
  },

  correctRecord: (recordId: string, newScore: number, operator: string) => {
    const { calculations, history } = get()
    const record = calculations.find(r => r.id === recordId)
    const course = record ? get().courses.find(c => c.id === record.courseId) : undefined

    set({
      calculations: calculations.map(r =>
        r.id === recordId
          ? { ...r, previousScore: r.score, score: newScore, status: 'corrected' as const, lastModifiedBy: operator, lastModifiedAt: now() }
          : r
      ),
      history: [
        ...history,
        {
          id: makeHistoryId(),
          courseId: record?.courseId ?? '',
          action: 'correct',
          operator,
          timestamp: now(),
          detail: `人工修正「${course?.name}」得分：${record?.score} → ${newScore}，修正人：${operator}`,
        },
      ],
    })
  },

  rerun: () => {
    const { courses, weights, mixedConfirmed } = get()
    const newCalcs: CalculationRecord[] = []
    const newHistory: HistoryEntry[] = []

    for (const course of courses) {
      const courseWeights = weights.filter(w => w.courseId === course.id)
      const detailScores = computeDetailScores(course, courseWeights)
      const score = computeScore(course, courseWeights)

      let status: CalculationRecord['status'] = 'pass'
      if (course.recordType === 'mixed' && !mixedConfirmed[course.id]) {
        status = 'pending_review'
      }

      const existing = get().calculations.find(r => r.courseId === course.id)

      newCalcs.push({
        id: `calc-${course.id}`,
        courseId: course.id,
        recordType: course.recordType,
        score,
        detailScores,
        status,
        lastModifiedBy: '系统',
        lastModifiedAt: now(),
        previousScore: existing?.score,
      })

      newHistory.push({
        id: makeHistoryId(),
        courseId: course.id,
        action: 'rerun',
        operator: '吴老师',
        timestamp: now(),
        detail: `重跑「${course.name}」计算，得分 ${existing?.score} → ${score}`,
      })
    }

    set({
      calculations: newCalcs,
      history: [...get().history, ...newHistory],
    })
  },

  getCourseWeights: (courseId: string) => {
    return get().weights.filter(w => w.courseId === courseId)
  },

  getCourseCalculation: (courseId: string) => {
    return get().calculations.find(r => r.courseId === courseId)
  },

  getCourseHistory: (courseId: string) => {
    return get().history.filter(h => h.courseId === courseId)
  },

  getCoursesByType: (type: RecordType) => {
    return get().courses.filter(c => c.recordType === type)
  },
}))
