import type { ConditionLog, ThresholdConfig, ThresholdEvent, MaintenanceOrder, Attachment } from "@/types"

const THRESHOLD_CONFIGS: ThresholdConfig[] = [
  {
    id: "tc-001",
    parameterName: "泵站振动速度",
    warningThreshold: 4.5,
    alarmThreshold: 7.1,
    unit: "mm/s",
  },
  {
    id: "tc-002",
    parameterName: "轴承温度",
    warningThreshold: 65,
    alarmThreshold: 80,
    unit: "°C",
  },
]

const conditionLogs: ConditionLog[] = [
  {
    id: "cl-001",
    timestamp: "2025-05-28T08:00:00",
    vibrationValue: 2.3,
    unit: "mm/s",
    equipmentId: "P-101",
    status: "confirmed",
    attachments: [
      { id: "att-001", parentId: "cl-001", fileName: "振动图谱_0528.png", uploadedAt: "2025-05-28T08:05:00", isLate: false },
    ],
  },
  {
    id: "cl-002",
    timestamp: "2025-05-28T12:00:00",
    vibrationValue: 5.1,
    unit: "mm/s",
    equipmentId: "P-101",
    status: "confirmed",
    attachments: [],
  },
  {
    id: "cl-003",
    timestamp: "2025-05-29T08:00:00",
    vibrationValue: 6.8,
    unit: "mm/s",
    equipmentId: "P-101",
    status: "manual_corrected",
    correctionNote: "原始记录6.3，现场复核后修正为6.8",
    attachments: [
      { id: "att-003", parentId: "cl-003", fileName: "复核记录_0529.pdf", uploadedAt: "2025-05-31T10:00:00", isLate: true },
    ],
  },
  {
    id: "cl-004",
    timestamp: "2025-05-29T14:00:00",
    vibrationValue: 3.2,
    unit: "mm/s",
    equipmentId: "P-101",
    status: "pending",
    attachments: [
      { id: "att-004", parentId: "cl-004", fileName: "振动图谱_0529_14.pdf", uploadedAt: "2025-05-31T09:00:00", isLate: true },
    ],
  },
  {
    id: "cl-005",
    timestamp: "2025-05-30T08:00:00",
    vibrationValue: 7.5,
    unit: "mm/s",
    equipmentId: "P-101",
    status: "confirmed",
    attachments: [
      { id: "att-005", parentId: "cl-005", fileName: "振动图谱_0530.png", uploadedAt: "2025-05-30T08:10:00", isLate: false },
    ],
  },
  {
    id: "cl-006",
    timestamp: "2025-05-30T08:00:00",
    vibrationValue: 7.5,
    unit: "mm/s",
    equipmentId: "P-101",
    status: "pending",
    attachments: [],
  },
]

const thresholdEvents: ThresholdEvent[] = [
  {
    id: "te-001",
    timestamp: "2025-05-28T12:00:00",
    thresholdId: "tc-001",
    actualValue: 5.1,
    level: "warning",
    status: "confirmed",
  },
  {
    id: "te-002",
    timestamp: "2025-05-29T08:00:00",
    thresholdId: "tc-001",
    actualValue: 6.8,
    level: "warning",
    status: "manual_corrected",
  },
  {
    id: "te-003",
    timestamp: "2025-05-30T08:00:00",
    thresholdId: "tc-001",
    actualValue: 7.5,
    level: "alarm",
    status: "confirmed",
  },
]

const maintenanceOrders: MaintenanceOrder[] = [
  {
    id: "mo-001",
    createdAt: "2025-05-28T13:00:00",
    equipmentId: "P-101",
    faultDesc: "泵体振动偏大，需检查地脚螺栓松动情况",
    severity: "minor",
    status: "confirmed",
    attachments: [
      { id: "att-m01", parentId: "mo-001", fileName: "维修照片_0528.jpg", uploadedAt: "2025-05-28T14:00:00", isLate: false },
    ],
  },
  {
    id: "mo-002",
    createdAt: "2025-05-30T09:00:00",
    equipmentId: "P-101",
    faultDesc: "振动报警，轴承可能磨损，需安排停机检查",
    severity: "critical",
    status: "pending",
    attachments: [
      { id: "att-m02", parentId: "mo-002", fileName: "轴承照片_0530.jpg", uploadedAt: "2025-06-01T08:00:00", isLate: true },
    ],
  },
  {
    id: "mo-003",
    createdAt: "2025-05-30T10:00:00",
    equipmentId: "P-101",
    faultDesc: "更换轴承后试运行，振动恢复正常",
    severity: "minor",
    status: "manual_corrected",
    attachments: [],
  },
]

export const mockData = {
  conditionLogs,
  thresholdConfigs: THRESHOLD_CONFIGS,
  thresholdEvents,
  maintenanceOrders,
}
