import type { ExperimentRecord } from "@/types"

let idCounter = 100
function nextId(): string {
  return `rec-${++idCounter}`
}

export const MOCK_RECORDS: ExperimentRecord[] = [
  {
    id: nextId(), batchId: "BATCH-2024-001", timestamp: "2024-03-01 08:15",
    temperature: 220, temperatureUnit: "°C", duration: 12, durationUnit: "min",
    beanCenterTemp: 195, beanSurfaceTemp: 218, roastingLevel: "中烘",
    rawNote: "", dataQualityFlags: [], conflictWithNote: false,
  },
  {
    id: nextId(), batchId: "BATCH-2024-001", timestamp: "2024-03-01 08:30",
    temperature: 230, temperatureUnit: "°C", duration: 14, durationUnit: "min",
    beanCenterTemp: 205, beanSurfaceTemp: 228, roastingLevel: "中深烘",
    rawNote: "", dataQualityFlags: [], conflictWithNote: false,
  },
  {
    id: nextId(), batchId: "BATCH-2024-001", timestamp: "2024-03-01 09:00",
    temperature: 225, temperatureUnit: "°C", duration: 13, durationUnit: "min",
    beanCenterTemp: 198, beanSurfaceTemp: 223, roastingLevel: "中烘",
    rawNote: "这天设备好像不太对", dataQualityFlags: [], conflictWithNote: false,
  },
  {
    id: nextId(), batchId: "BATCH-2024-001", timestamp: "2024-03-01 09:20",
    temperature: 428, temperatureUnit: "°F", duration: 12, durationUnit: "min",
    beanCenterTemp: 202, beanSurfaceTemp: 220, roastingLevel: "中烘",
    rawNote: "", dataQualityFlags: [], conflictWithNote: false,
  },
  {
    id: nextId(), batchId: "BATCH-2024-001", timestamp: "2024-03-01 09:45",
    temperature: 235, temperatureUnit: "°C", duration: null, durationUnit: "unknown",
    beanCenterTemp: 210, beanSurfaceTemp: 232, roastingLevel: "中深烘",
    rawNote: "", dataQualityFlags: [], conflictWithNote: false,
  },
  {
    id: nextId(), batchId: "BATCH-2024-002", timestamp: "2024-03-02 08:10",
    temperature: 228, temperatureUnit: "°C", duration: 13, durationUnit: "min",
    beanCenterTemp: 200, beanSurfaceTemp: 225, roastingLevel: "中烘",
    rawNote: "", dataQualityFlags: [], conflictWithNote: false,
  },
  {
    id: nextId(), batchId: "BATCH-2024-002", timestamp: "2024-03-02 08:30",
    temperature: null, temperatureUnit: "°C", duration: 11, durationUnit: "min",
    beanCenterTemp: null, beanSurfaceTemp: null, roastingLevel: "浅烘",
    rawNote: "传感器没接好", dataQualityFlags: [], conflictWithNote: false,
  },
  {
    id: nextId(), batchId: "BATCH-2024-002", timestamp: "2024-03-02 09:00",
    temperature: 240, temperatureUnit: "°C", duration: 15, durationUnit: "min",
    beanCenterTemp: 218, beanSurfaceTemp: 238, roastingLevel: "深烘",
    rawNote: "", dataQualityFlags: [], conflictWithNote: false,
  },
  {
    id: nextId(), batchId: "BATCH-2024-002", timestamp: "2024-03-02 09:00",
    temperature: 240, temperatureUnit: "°C", duration: 15, durationUnit: "min",
    beanCenterTemp: 218, beanSurfaceTemp: 238, roastingLevel: "深烘",
    rawNote: "", dataQualityFlags: [], conflictWithNote: false,
  },
  {
    id: nextId(), batchId: "BATCH-2024-002", timestamp: "2024-03-02 09:30",
    temperature: 232, temperatureUnit: "°C", duration: 14, durationUnit: "min",
    beanCenterTemp: 208, beanSurfaceTemp: 230, roastingLevel: "中深烘",
    rawNote: "", dataQualityFlags: [], conflictWithNote: false,
  },
  {
    id: nextId(), batchId: "BATCH-2024-002", timestamp: "2024-03-02 10:00",
    temperature: 238, temperatureUnit: "°C", duration: 780, durationUnit: "s",
    beanCenterTemp: 215, beanSurfaceTemp: 235, roastingLevel: "深烘",
    rawNote: "", dataQualityFlags: [], conflictWithNote: false,
  },
  {
    id: nextId(), batchId: "BATCH-2024-003", timestamp: "2024-03-03 08:20",
    temperature: 225, temperatureUnit: "°C", duration: 12, durationUnit: "min",
    beanCenterTemp: 199, beanSurfaceTemp: 222, roastingLevel: "中烘",
    rawNote: "温度异常偏低", dataQualityFlags: [], conflictWithNote: true,
    conflictDetail: {
      noteSays: "温度异常偏低",
      dataSays: "225°C（正常范围 200–250°C）",
      suggestedActions: [
        { label: "按备注修正", description: "如果确认实际温度偏低，请手动降低该行温度值" },
        { label: "按数据保留", description: "225°C 在正常范围内，备注可能指其他方面" },
        { label: "暂不处理", description: "留待进一步确认，该条目会持续标记为冲突" },
      ],
    },
  },
  {
    id: nextId(), batchId: "BATCH-2024-003", timestamp: "2024-03-03 08:50",
    temperature: null, temperatureUnit: "°C", duration: 13, durationUnit: "min",
    beanCenterTemp: null, beanSurfaceTemp: null, roastingLevel: "中烘",
    rawNote: "数据没存上", dataQualityFlags: [], conflictWithNote: false,
  },
  {
    id: nextId(), batchId: "BATCH-2024-003", timestamp: "2024-03-03 09:20",
    temperature: 242, temperatureUnit: "°C", duration: 16, durationUnit: "min",
    beanCenterTemp: 222, beanSurfaceTemp: 240, roastingLevel: "深烘",
    rawNote: "", dataQualityFlags: [], conflictWithNote: false,
  },
  {
    id: nextId(), batchId: "BATCH-2024-003", timestamp: "2024-03-03 09:50",
    temperature: 228, temperatureUnit: "°C", duration: 12, durationUnit: "min",
    beanCenterTemp: 203, beanSurfaceTemp: 225, roastingLevel: "中烘",
    rawNote: "老岑说这批还行", dataQualityFlags: [], conflictWithNote: false,
  },
  {
    id: nextId(), batchId: "BATCH-2024-003", timestamp: "2024-03-03 10:10",
    temperature: 235, temperatureUnit: "°C", duration: 14, durationUnit: "min",
    beanCenterTemp: 212, beanSurfaceTemp: 232, roastingLevel: "中深烘",
    rawNote: "", dataQualityFlags: [], conflictWithNote: false,
  },
  {
    id: nextId(), batchId: "BATCH-2024-003", timestamp: "2024-03-03 10:40",
    temperature: 258, temperatureUnit: "°C", duration: 18, durationUnit: "min",
    beanCenterTemp: 268, beanSurfaceTemp: 255, roastingLevel: "极深烘",
    rawNote: "正常出炉", dataQualityFlags: [], conflictWithNote: true,
    conflictDetail: {
      noteSays: "正常出炉",
      dataSays: "豆心温度 268°C，超过安全阈值 250°C",
      suggestedActions: [
        { label: "按备注修正", description: "如果确认正常出炉，考虑是否需要上调安全阈值" },
        { label: "按数据标记超限", description: "268°C 超过 250°C 阈值，标记为超限记录" },
        { label: "暂不处理", description: "留待进一步确认，该条目会持续标记为冲突" },
      ],
    },
  },
  {
    id: nextId(), batchId: "BATCH-2024-003", timestamp: "2024-03-03 11:00",
    temperature: 232, temperatureUnit: "°C", duration: 13, durationUnit: "min",
    beanCenterTemp: 207, beanSurfaceTemp: 230, roastingLevel: "中深烘",
    rawNote: "", dataQualityFlags: [], conflictWithNote: false,
  },
  {
    id: nextId(), batchId: "BATCH-2024-004", timestamp: "2024-03-04 08:15",
    temperature: 226, temperatureUnit: "°C", duration: 12, durationUnit: "min",
    beanCenterTemp: 200, beanSurfaceTemp: 224, roastingLevel: "中烘",
    rawNote: "", dataQualityFlags: [], conflictWithNote: false,
  },
  {
    id: nextId(), batchId: "BATCH-2024-004", timestamp: "2024-03-04 08:45",
    temperature: 234, temperatureUnit: "°C", duration: 14, durationUnit: "min",
    beanCenterTemp: 211, beanSurfaceTemp: 231, roastingLevel: "中深烘",
    rawNote: "", dataQualityFlags: [], conflictWithNote: false,
  },
]
