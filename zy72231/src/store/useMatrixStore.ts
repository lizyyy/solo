import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { MigrationRecord, ExRightsData, StatusFilter, TimelineEvent } from "@/types"

const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2, 9)

interface MatrixState {
  records: MigrationRecord[]
  filter: StatusFilter
  initialized: boolean

  setFilter: (filter: StatusFilter) => void
  initDemoData: (records: MigrationRecord[]) => void
  addRecord: (record: MigrationRecord) => void
  supplementExRights: (recordId: string, exRightsData: ExRightsData) => void
  reviewRecord: (recordId: string, action: "confirmed" | "rejected") => void
  rerunRecord: (recordId: string) => void
  importCustodyData: (record: MigrationRecord) => void
  getFilteredRecords: () => MigrationRecord[]
  getRecordById: (id: string) => MigrationRecord | undefined
  getStats: () => { total: number; smooth: number; pendingReview: number; oldCaliberSupplemented: number }
}

export const useMatrixStore = create<MatrixState>()(
  persist(
    (set, get) => ({
      records: [],
      filter: "all" as StatusFilter,
      initialized: false,

      setFilter: (filter) => set({ filter }),

      initDemoData: (records) => {
        if (!get().initialized) {
          set({ records, initialized: true })
        }
      },

      addRecord: (record) => set({ records: [...get().records, record] }),

      supplementExRights: (recordId, exRightsData) => {
        const record = get().records.find((r) => r.id === recordId)
        if (!record) return

        let newCaliber = record.settlementCaliber
        let caliberChanged = false

        if (exRightsData.remark.includes("T+2")) {
          newCaliber = "T+2"
          caliberChanged = newCaliber !== record.settlementCaliber
        }

        const newEvents: TimelineEvent[] = [
          { id: generateId(), type: "supplement", timestamp: new Date().toISOString(), description: "补充除权数据" },
        ]

        if (caliberChanged) {
          newEvents.push({
            id: generateId(),
            type: "caliber_change",
            timestamp: new Date().toISOString(),
            description: `结算口径变更为 ${newCaliber}`,
          })
        }

        set({
          records: get().records.map((r) =>
            r.id === recordId
              ? {
                  ...r,
                  exRightsData,
                  settlementCaliber: caliberChanged ? newCaliber : r.settlementCaliber,
                  status: caliberChanged ? "old_caliber_supplemented" as const : r.status,
                  timeline: [...r.timeline, ...newEvents],
                  previousReconciliationNote: r.reconciliationNote,
                  reconciliationNote: `补充除权数据: ${exRightsData.remark}`,
                }
              : r
          ),
        })
      },

      reviewRecord: (recordId, action) => {
        set({
          records: get().records.map((r) =>
            r.id === recordId
              ? {
                  ...r,
                  reviewStatus: action,
                  settlementCaliber: action === "rejected" ? r.originalCaliber : r.settlementCaliber,
                  timeline: [
                    ...r.timeline,
                    {
                      id: generateId(),
                      type: "review",
                      timestamp: new Date().toISOString(),
                      description: action === "confirmed" ? "审核通过" : "审核驳回",
                    },
                  ],
                }
              : r
          ),
        })
      },

      rerunRecord: (recordId) => {
        set({
          records: get().records.map((r) =>
            r.id === recordId
              ? {
                  ...r,
                  timeline: [
                    ...r.timeline,
                    { id: generateId(), type: "rerun", timestamp: new Date().toISOString(), description: "重新计算" },
                  ],
                  reconciliationNote: "重新计算对账备注",
                }
              : r
          ),
        })
      },

      importCustodyData: (record) => {
        const newRecord = record.isManualCorrection
          ? { ...record, status: "pending_review" as const }
          : record
        set({ records: [...get().records, newRecord] })
      },

      getFilteredRecords: () => {
        const { records, filter } = get()
        if (filter === "all") return records
        return records.filter((r) => r.status === filter)
      },

      getRecordById: (id) => get().records.find((r) => r.id === id),

      getStats: () => {
        const records = get().records
        return {
          total: records.length,
          smooth: records.filter((r) => r.status === "smooth").length,
          pendingReview: records.filter((r) => r.status === "pending_review").length,
          oldCaliberSupplemented: records.filter((r) => r.status === "old_caliber_supplemented").length,
        }
      },
    }),
    {
      name: "migration-matrix-data",
    }
  )
)
