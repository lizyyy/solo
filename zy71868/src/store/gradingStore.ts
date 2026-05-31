import { create } from "zustand"
import { persist } from "zustand/middleware"
import type {
  GradingRecord,
  AuditEntry,
  CurrentUser,
  ChangeType,
  RecordStatus,
} from "@/types"

const now = () => new Date().toISOString()
const uid = () => crypto.randomUUID()

const SEED_RECORDS: GradingRecord[] = [
  {
    id: "r1",
    questionNo: "3",
    description: "集合 A={1,2,3} 与 B={1,2} 的包含关系判断，分步得分标准模糊",
    source: "difficulty_label",
    changeType: "supplementary",
    status: "confirmed",
    difficulty: "中等",
    originalAnswer: "A⊇B",
    standardAnswer: "A⊇B（B是A的真子集）",
    equivalentAnswerIssue: false,
    equivalentAnswers: [],
    pendingReason: "",
    reviewConclusion: "",
    createdAt: "2026-05-28T09:15:00.000Z",
    updatedAt: "2026-05-28T14:20:00.000Z",
    createdBy: "王老师",
  },
  {
    id: "r2",
    questionNo: "5",
    description: "等价答案 A∩B=B 未被判为正确，学生写了 B⊆A∩B 得零分",
    source: "review_record",
    changeType: "conclusion_change",
    status: "pending",
    difficulty: "中等",
    originalAnswer: "A∪B=A",
    standardAnswer: "A∪B=A",
    equivalentAnswerIssue: true,
    equivalentAnswers: ["A∩B=B", "B⊆A"],
    pendingReason: "等价答案误判：A∩B=B 与标准答案 A∪B=A 在集合关系上等价，但批改时被判为错误",
    reviewConclusion: "",
    createdAt: "2026-05-29T10:30:00.000Z",
    updatedAt: "2026-05-29T10:30:00.000Z",
    createdBy: "李助教",
  },
  {
    id: "r3",
    questionNo: "7",
    description: '题库表中难度从"简单"手工改为"较难"，未记录原因',
    source: "question_bank",
    changeType: "conclusion_change",
    status: "pending",
    difficulty: "较难",
    originalAnswer: "∁ᵤA∩∁ᵤB",
    standardAnswer: "∁ᵤ(A∪B)",
    equivalentAnswerIssue: false,
    equivalentAnswers: [],
    pendingReason: "题库表手工改动难度标签，需确认是否影响评分标准",
    reviewConclusion: "",
    createdAt: "2026-05-30T08:45:00.000Z",
    updatedAt: "2026-05-30T11:00:00.000Z",
    createdBy: "王老师",
  },
  {
    id: "r4",
    questionNo: "2",
    description: "讲评记录晚补：集合 A-B 与 A∩∁ᵤB 的等价关系讲评稿未及时录入",
    source: "review_record",
    changeType: "supplementary",
    status: "confirmed",
    difficulty: "简单",
    originalAnswer: "A-B",
    standardAnswer: "A∩∁ᵤB",
    equivalentAnswerIssue: false,
    equivalentAnswers: [],
    pendingReason: "",
    reviewConclusion: "",
    createdAt: "2026-05-30T15:00:00.000Z",
    updatedAt: "2026-05-30T16:30:00.000Z",
    createdBy: "张老师",
  },
  {
    id: "r5",
    description: "难度标签早到：分步得分 ∁ᵤ(A∩B)=∁ᵤA∪∁ᵤB 应算偏还是不算异常",
    questionNo: "9",
    source: "difficulty_label",
    changeType: "conclusion_change",
    status: "pending",
    difficulty: "较难",
    originalAnswer: "∁ᵤ(A∩B)",
    standardAnswer: "∁ᵤA∪∁ᵤB",
    equivalentAnswerIssue: true,
    equivalentAnswers: ["∁ᵤA∪∁ᵤB", "Aᶜ∪Bᶜ"],
    pendingReason: "分步得分标准争议：中间步骤 ∁ᵤ(A∩B) 与最终答案 ∁ᵤA∪∁ᵤB 等价，但评分时仅最终答案给满分，中间步骤得分比例待确认",
    reviewConclusion: "",
    createdAt: "2026-05-31T07:30:00.000Z",
    updatedAt: "2026-05-31T07:30:00.000Z",
    createdBy: "李助教",
  },
]

const SEED_AUDIT: AuditEntry[] = [
  {
    id: "a1",
    recordId: "r1",
    operator: "王老师",
    role: "teacher",
    action: "新增记录",
    changeType: "supplementary",
    detail: "补充难度标签说明，集合包含关系的分步得分标准",
    timestamp: "2026-05-28T09:15:00.000Z",
  },
  {
    id: "a2",
    recordId: "r1",
    operator: "张老师",
    role: "teacher",
    action: "确认记录",
    changeType: "supplementary",
    detail: "确认补充材料完整，无结论变更",
    timestamp: "2026-05-28T14:20:00.000Z",
  },
  {
    id: "a3",
    recordId: "r2",
    operator: "李助教",
    role: "assistant",
    action: "新增记录",
    changeType: "conclusion_change",
    detail: "等价答案 A∩B=B 被判为错误，属于误判",
    timestamp: "2026-05-29T10:30:00.000Z",
  },
  {
    id: "a4",
    recordId: "r3",
    operator: "王老师",
    role: "teacher",
    action: "新增记录",
    changeType: "conclusion_change",
    detail: '题库表难度从"简单"手工改为"较难"',
    timestamp: "2026-05-30T08:45:00.000Z",
  },
  {
    id: "a5",
    recordId: "r3",
    operator: "王老师",
    role: "teacher",
    action: "补充原因",
    changeType: "conclusion_change",
    detail: "补充说明：根据上周测试数据，此题正确率仅35%，应调整为较难",
    timestamp: "2026-05-30T11:00:00.000Z",
  },
  {
    id: "a6",
    recordId: "r4",
    operator: "张老师",
    role: "teacher",
    action: "新增记录",
    changeType: "supplementary",
    detail: "补录讲评稿：A-B 与 A∩∁ᵤB 等价关系的讲解",
    timestamp: "2026-05-30T15:00:00.000Z",
  },
  {
    id: "a7",
    recordId: "r4",
    operator: "李助教",
    role: "assistant",
    action: "确认记录",
    changeType: "supplementary",
    detail: "讲评稿补录完整",
    timestamp: "2026-05-30T16:30:00.000Z",
  },
  {
    id: "a8",
    recordId: "r5",
    operator: "李助教",
    role: "assistant",
    action: "新增记录",
    changeType: "conclusion_change",
    detail: "难度标签提前录入，分步得分标准存疑",
    timestamp: "2026-05-31T07:30:00.000Z",
  },
]

interface GradingStore {
  records: GradingRecord[]
  auditLog: AuditEntry[]
  currentUser: CurrentUser

  addRecord: (
    record: Omit<GradingRecord, "id" | "createdAt" | "updatedAt">
  ) => void
  updateRecord: (
    id: string,
    updates: Partial<GradingRecord>,
    auditDetail: string
  ) => void
  reviewEquivalentAnswer: (recordId: string, conclusion: string) => void
  exportReviewNotes: (filter: "all" | "pending" | "conclusion_change") => string
  setCurrentUser: (user: CurrentUser) => void
}

export const useGradingStore = create<GradingStore>()(
  persist(
    (set, get) => ({
      records: SEED_RECORDS,
      auditLog: SEED_AUDIT,
      currentUser: { name: "王老师", role: "teacher" },

      addRecord: (record) => {
        const id = uid()
        const timestamp = now()
        const newRecord: GradingRecord = {
          ...record,
          id,
          createdAt: timestamp,
          updatedAt: timestamp,
        }
        const status: RecordStatus =
          record.changeType === "conclusion_change" ||
          record.equivalentAnswerIssue
            ? "pending"
            : "confirmed"

        newRecord.status = status
        if (status === "pending" && !newRecord.pendingReason) {
          newRecord.pendingReason =
            record.changeType === "conclusion_change"
              ? "涉及结论变更，需复核"
              : record.equivalentAnswerIssue
                ? "等价答案误判，需复核"
                : ""
        }

        const newAudit: AuditEntry = {
          id: uid(),
          recordId: id,
          operator: get().currentUser.name,
          role: get().currentUser.role,
          action: "新增记录",
          changeType: record.changeType,
          detail: `新增批改记录，题号 ${record.questionNo}`,
          timestamp,
        }

        set((state) => ({
          records: [newRecord, ...state.records],
          auditLog: [newAudit, ...state.auditLog],
        }))
      },

      updateRecord: (id, updates, auditDetail) => {
        const timestamp = now()
        const record = get().records.find((r) => r.id === id)
        if (!record) return

        const changeType: ChangeType =
          updates.changeType ?? record.changeType

        const newAudit: AuditEntry = {
          id: uid(),
          recordId: id,
          operator: get().currentUser.name,
          role: get().currentUser.role,
          action: "修改记录",
          changeType,
          detail: auditDetail,
          timestamp,
        }

        set((state) => ({
          records: state.records.map((r) =>
            r.id === id ? { ...r, ...updates, updatedAt: timestamp } : r
          ),
          auditLog: [newAudit, ...state.auditLog],
        }))
      },

      reviewEquivalentAnswer: (recordId, conclusion) => {
        const timestamp = now()
        const record = get().records.find((r) => r.id === recordId)
        if (!record) return

        const newAudit: AuditEntry = {
          id: uid(),
          recordId,
          operator: get().currentUser.name,
          role: get().currentUser.role,
          action: "复核等价答案",
          changeType: record.changeType,
          detail: `复核结论：${conclusion}`,
          timestamp,
        }

        set((state) => ({
          records: state.records.map((r) =>
            r.id === recordId
              ? {
                  ...r,
                  reviewConclusion: conclusion,
                  status: "confirmed" as RecordStatus,
                  updatedAt: timestamp,
                }
              : r
          ),
          auditLog: [newAudit, ...state.auditLog],
        }))
      },

      exportReviewNotes: (filter) => {
        const { records, auditLog } = get()
        let filtered = records
        if (filter === "pending") {
          filtered = records.filter((r) => r.status === "pending")
        } else if (filter === "conclusion_change") {
          filtered = records.filter(
            (r) => r.changeType === "conclusion_change"
          )
        }

        const sorted = [...filtered].sort((a, b) =>
          a.questionNo.localeCompare(b.questionNo, undefined, { numeric: true })
        )

        const sourceLabel = (s: string) => {
          const map: Record<string, string> = {
            difficulty_label: "难度标签",
            review_record: "讲评记录",
            question_bank: "题库表",
          }
          return map[s] ?? s
        }
        const changeLabel = (c: string) =>
          c === "supplementary" ? "补材料" : "改结论"
        const statusLabel = (s: string) => {
          const map: Record<string, string> = {
            pending: "待处理",
            confirmed: "已确认",
            closed: "已关闭",
          }
          return map[s] ?? s
        }

        const lines: string[] = [
          "集合关系批改 · 讲评稿",
          `导出时间：${new Date().toLocaleString("zh-CN")}`,
          `筛选范围：${filter === "all" ? "全部" : filter === "pending" ? "仅待处理" : "仅改结论"}`,
          `共 ${sorted.length} 条记录`,
          "─".repeat(40),
        ]

        for (const r of sorted) {
          lines.push("")
          lines.push(`题号 ${r.questionNo} ｜ ${r.description}`)
          lines.push(`  来源：${sourceLabel(r.source)}  变更类型：${changeLabel(r.changeType)}  状态：${statusLabel(r.status)}`)
          lines.push(`  难度：${r.difficulty}`)
          lines.push(`  原始答案：${r.originalAnswer}`)
          lines.push(`  标准答案：${r.standardAnswer}`)
          if (r.equivalentAnswerIssue && r.equivalentAnswers.length > 0) {
            lines.push(`  等价答案（误判）：${r.equivalentAnswers.join("、")}`)
          }
          if (r.pendingReason) {
            lines.push(`  待处理原因：${r.pendingReason}`)
          }
          if (r.reviewConclusion) {
            lines.push(`  复核结论：${r.reviewConclusion}`)
          }

          const relatedAudit = auditLog
            .filter((a) => a.recordId === r.id)
            .sort(
              (a, b) =>
                new Date(a.timestamp).getTime() -
                new Date(b.timestamp).getTime()
            )
          if (relatedAudit.length > 0) {
            lines.push("  审计记录：")
            for (const a of relatedAudit) {
              const t = new Date(a.timestamp).toLocaleString("zh-CN")
              lines.push(
                `    [${t}] ${a.operator}(${a.role}) ${a.action} — ${a.detail}`
              )
            }
          }

          lines.push("─".repeat(40))
        }

        return lines.join("\n")
      },

      setCurrentUser: (user) => set({ currentUser: user }),
    }),
    {
      name: "grading-store",
    }
  )
)
