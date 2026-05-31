import { create } from "zustand"
import type { ConditionLog, ThresholdConfig, ThresholdEvent, MaintenanceOrder, TimelineEvent, ValidationIssue, RecordStatus, HandlingTag } from "@/types"
import { mockData } from "@/data/mockData"
import { validateData } from "@/data/validators"

interface InspectionState {
  conditionLogs: ConditionLog[]
  thresholdConfigs: ThresholdConfig[]
  thresholdEvents: ThresholdEvent[]
  maintenanceOrders: MaintenanceOrder[]
  validationIssues: ValidationIssue[]
  dataLoaded: boolean
  selectedEventId: string | null
  handlingTags: Record<string, HandlingTag>

  loadMockData: () => void
  setRecordStatus: (recordType: "condition" | "threshold" | "maintenance", recordId: string, status: RecordStatus) => void
  setHandlingTag: (recordId: string, tag: HandlingTag) => void
  selectEvent: (eventId: string | null) => void
  getTimelineEvents: () => TimelineEvent[]
  getEventById: (id: string) => TimelineEvent | undefined
}

export const useInspectionStore = create<InspectionState>((set, get) => ({
  conditionLogs: [],
  thresholdConfigs: [],
  thresholdEvents: [],
  maintenanceOrders: [],
  validationIssues: [],
  dataLoaded: false,
  selectedEventId: null,
  handlingTags: {},

  loadMockData: () => {
    const { conditionLogs, thresholdConfigs, thresholdEvents, maintenanceOrders } = mockData
    const issues = validateData(conditionLogs, thresholdEvents, maintenanceOrders)
    const tags: Record<string, HandlingTag> = {}

    for (const log of conditionLogs) {
      if (log.status === "confirmed") tags[log.id] = "resolved"
      else if (log.status === "pending") tags[log.id] = "need_attachment"
      else if (log.status === "manual_corrected") tags[log.id] = "manually_corrected"
    }
    for (const evt of thresholdEvents) {
      if (evt.status === "confirmed") tags[evt.id] = "continue_observe"
      else if (evt.status === "manual_corrected") tags[evt.id] = "manually_corrected"
      else tags[evt.id] = "continue_observe"
    }
    for (const order of maintenanceOrders) {
      if (order.status === "confirmed") tags[order.id] = "resolved"
      else if (order.status === "pending") tags[order.id] = "need_attachment"
      else if (order.status === "manual_corrected") tags[order.id] = "manually_corrected"
    }

    set({
      conditionLogs,
      thresholdConfigs,
      thresholdEvents,
      maintenanceOrders,
      validationIssues: issues,
      dataLoaded: true,
      handlingTags: tags,
    })
  },

  setRecordStatus: (recordType, recordId, status) => {
    set((state) => {
      if (recordType === "condition") {
        return {
          conditionLogs: state.conditionLogs.map((l) =>
            l.id === recordId ? { ...l, status } : l
          ),
        }
      }
      if (recordType === "threshold") {
        return {
          thresholdEvents: state.thresholdEvents.map((e) =>
            e.id === recordId ? { ...e, status } : e
          ),
        }
      }
      return {
        maintenanceOrders: state.maintenanceOrders.map((o) =>
          o.id === recordId ? { ...o, status } : o
        ),
      }
    })
  },

  setHandlingTag: (recordId, tag) => {
    set((state) => ({
      handlingTags: { ...state.handlingTags, [recordId]: tag },
    }))
  },

  selectEvent: (eventId) => {
    set({ selectedEventId: eventId })
  },

  getTimelineEvents: () => {
    const { conditionLogs, thresholdEvents, maintenanceOrders } = get()
    const events: TimelineEvent[] = [
      ...conditionLogs.map((d) => ({ type: "condition" as const, data: d })),
      ...thresholdEvents.map((d) => ({ type: "threshold" as const, data: d })),
      ...maintenanceOrders.map((d) => ({ type: "maintenance" as const, data: d })),
    ]
    events.sort((a, b) => {
      const tA = a.type === "maintenance" ? a.data.createdAt : a.data.timestamp
      const tB = b.type === "maintenance" ? b.data.createdAt : b.data.timestamp
      return new Date(tA).getTime() - new Date(tB).getTime()
    })
    return events
  },

  getEventById: (id) => {
    const events = get().getTimelineEvents()
    return events.find((e) => e.data.id === id)
  },
}))
