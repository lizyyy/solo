import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  PracticeRecord,
  Part,
  Script,
  AuditLog,
  BatchTask,
  TableState,
} from '@/types'
import { generateMockData } from '@/utils/mockData'

interface AppState {
  records: PracticeRecord[]
  parts: Part[]
  scripts: Script[]
  auditLogs: AuditLog[]
  batchTasks: BatchTask[]
  tableState: TableState
  currentUser: { name: string; role: string }
}

interface AppActions {
  addRecord: (record: Omit<PracticeRecord, 'id' | 'createdAt' | 'updatedAt'>) => void
  updateRecord: (id: string, record: Partial<PracticeRecord>) => void
  deleteRecord: (id: string) => void
  batchImportRecords: (records: Omit<PracticeRecord, 'id' | 'createdAt' | 'updatedAt'>[]) => void
  updateTableState: (state: Partial<TableState>) => void
  addAuditLog: (log: Omit<AuditLog, 'id' | 'createdAt'>) => void
  addBatchTask: (task: Omit<BatchTask, 'id' | 'createdAt'>) => void
  updateBatchTask: (id: string, updates: Partial<BatchTask>) => void
  resetData: () => void
}

const mockData = generateMockData()

export const useAppStore = create<AppState & AppActions>()(
  persist(
    (set, get) => ({
      ...mockData,
      tableState: {
        current: 1,
        pageSize: 10,
        scrollTop: 0,
        filters: {},
      },
      currentUser: { name: '张老师', role: 'teacher' },

      addRecord: (record) => {
        const newRecord: PracticeRecord = {
          ...record,
          id: `rec_${Date.now()}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
        get().addAuditLog({
          action: 'create',
          operator: get().currentUser.name,
          targetType: 'record',
          targetId: newRecord.id,
          afterData: JSON.stringify(newRecord),
        })
        set((state) => ({ records: [...state.records, newRecord] }))
      },

      updateRecord: (id, updates) => {
        const beforeRecord = get().records.find((r) => r.id === id)
        set((state) => ({
          records: state.records.map((r) =>
            r.id === id ? { ...r, ...updates, updatedAt: new Date().toISOString() } : r
          ),
        }))
        const afterRecord = get().records.find((r) => r.id === id)
        get().addAuditLog({
          action: 'update',
          operator: get().currentUser.name,
          targetType: 'record',
          targetId: id,
          beforeData: JSON.stringify(beforeRecord),
          afterData: JSON.stringify(afterRecord),
        })
      },

      deleteRecord: (id) => {
        const beforeRecord = get().records.find((r) => r.id === id)
        get().addAuditLog({
          action: 'delete',
          operator: get().currentUser.name,
          targetType: 'record',
          targetId: id,
          beforeData: JSON.stringify(beforeRecord),
        })
        set((state) => ({ records: state.records.filter((r) => r.id !== id) }))
      },

      batchImportRecords: (records) => {
        const taskId = `task_${Date.now()}`
        const newRecords: PracticeRecord[] = records.map((r, index) => ({
          ...r,
          id: `rec_${Date.now()}_${index}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }))
        get().addBatchTask({
          type: 'import',
          status: 'completed',
          total: records.length,
          success: records.length,
          failed: 0,
          operator: get().currentUser.name,
        })
        get().addAuditLog({
          action: 'import',
          operator: get().currentUser.name,
          targetType: 'batch',
          targetId: taskId,
          afterData: `批量导入 ${records.length} 条记录`,
        })
        set((state) => ({ records: [...state.records, ...newRecords] }))
      },

      updateTableState: (newState) =>
        set((state) => ({
          tableState: { ...state.tableState, ...newState },
        })),

      addAuditLog: (log) =>
        set((state) => ({
          auditLogs: [
            {
              ...log,
              id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              createdAt: new Date().toISOString(),
            },
            ...state.auditLogs,
          ].slice(0, 500),
        })),

      addBatchTask: (task) =>
        set((state) => ({
          batchTasks: [
            {
              ...task,
              id: `task_${Date.now()}`,
              createdAt: new Date().toISOString(),
            },
            ...state.batchTasks,
          ],
        })),

      updateBatchTask: (id, updates) =>
        set((state) => ({
          batchTasks: state.batchTasks.map((t) =>
            t.id === id ? { ...t, ...updates } : t
          ),
        })),

      resetData: () => set(mockData),
    }),
    {
      name: 'pcb-solder-storage',
      partialize: (state) => ({
        records: state.records,
        parts: state.parts,
        scripts: state.scripts,
        auditLogs: state.auditLogs,
        batchTasks: state.batchTasks,
        tableState: state.tableState,
      }),
    }
  )
)
