import type {
  RangefinderRecord,
  ObstacleRemark,
  ObstructionPoint,
  ObstructionHistory,
  GradingResult,
  ValidationResult,
} from "@/types"

export const MOCK_RANGEFINDER_RECORDS: RangefinderRecord[] = [
  {
    id: "rec-001",
    importBatchId: "batch-001",
    importTime: "2026-05-28 09:15:00",
    operator: "安全员-张明",
    status: "normal",
    slopeName: "阳光大道A段",
    photoPoints: [
      { id: "pp-001-1", recordId: "rec-001", sequenceNumber: 1, photoUrl: "/photos/001-1.jpg", longitude: 126.6534, latitude: 45.7211 },
      { id: "pp-001-2", recordId: "rec-001", sequenceNumber: 2, photoUrl: "/photos/001-2.jpg", longitude: 126.6538, latitude: 45.7215 },
      { id: "pp-001-3", recordId: "rec-001", sequenceNumber: 3, photoUrl: "/photos/001-3.jpg", longitude: 126.6542, latitude: 45.7219 },
    ],
    coordinateRows: [
      { id: "cr-001-1", recordId: "rec-001", sequenceNumber: 1, longitude: 126.6534, latitude: 45.7211, elevation: 1280 },
      { id: "cr-001-2", recordId: "rec-001", sequenceNumber: 2, longitude: 126.6538, latitude: 45.7215, elevation: 1295 },
      { id: "cr-001-3", recordId: "rec-001", sequenceNumber: 3, longitude: 126.6542, latitude: 45.7219, elevation: 1310 },
    ],
  },
  {
    id: "rec-002",
    importBatchId: "batch-002",
    importTime: "2026-05-28 10:30:00",
    operator: "安全员-张明",
    status: "pending_review",
    slopeName: "雪鹰弯B段",
    photoPoints: [
      { id: "pp-002-1", recordId: "rec-002", sequenceNumber: 1, photoUrl: "/photos/002-1.jpg", longitude: 126.6550, latitude: 45.7225 },
      { id: "pp-002-2", recordId: "rec-002", sequenceNumber: 2, photoUrl: "/photos/002-2.jpg", longitude: 126.6554, latitude: 45.7229 },
      { id: "pp-002-3", recordId: "rec-002", sequenceNumber: 3, photoUrl: "/photos/002-3.jpg", longitude: 126.6558, latitude: 45.7233 },
      { id: "pp-002-4", recordId: "rec-002", sequenceNumber: 4, photoUrl: "/photos/002-4.jpg", longitude: 126.6562, latitude: 45.7237 },
    ],
    coordinateRows: [
      { id: "cr-002-1", recordId: "rec-002", sequenceNumber: 1, longitude: 126.6550, latitude: 45.7225, elevation: 1350 },
      { id: "cr-002-3", recordId: "rec-002", sequenceNumber: 3, longitude: 126.6558, latitude: 45.7233, elevation: 1380 },
      { id: "cr-002-4", recordId: "rec-002", sequenceNumber: 4, longitude: 126.6562, latitude: 45.7237, elevation: 1395 },
    ],
  },
  {
    id: "rec-003",
    importBatchId: "batch-003",
    importTime: "2026-05-28 14:00:00",
    operator: "安全员-张明",
    status: "conflict",
    slopeName: "冰河谷C段",
    photoPoints: [
      { id: "pp-003-1", recordId: "rec-003", sequenceNumber: 1, photoUrl: "/photos/003-1.jpg", longitude: 126.6570, latitude: 45.7245 },
      { id: "pp-003-2", recordId: "rec-003", sequenceNumber: 2, photoUrl: "/photos/003-2.jpg", longitude: 126.6574, latitude: 45.7249 },
      { id: "pp-003-3", recordId: "rec-003", sequenceNumber: 3, photoUrl: "/photos/003-3.jpg", longitude: 126.6578, latitude: 45.7253 },
    ],
    coordinateRows: [
      { id: "cr-003-1", recordId: "rec-003", sequenceNumber: 1, longitude: 126.6570, latitude: 45.7245, elevation: 1420 },
      { id: "cr-003-2", recordId: "rec-003", sequenceNumber: 2, longitude: 126.6574, latitude: 45.7249, elevation: 1445 },
      { id: "cr-003-3", recordId: "rec-003", sequenceNumber: 3, longitude: 126.6578, latitude: 45.7253, elevation: 1460 },
    ],
  },
]

export const MOCK_OBSTACLE_REMARKS: ObstacleRemark[] = [
  {
    id: "orm-001",
    recordId: "rec-001",
    remarkText: "阳光大道A段无遮挡，测量正常",
    source: "现场记录",
    recordedAt: "2026-05-28 09:20:00",
    entries: [],
  },
  {
    id: "orm-002",
    recordId: "rec-002",
    remarkText: "雪鹰弯B段第2点位处有大型岩石遮挡，坐标缺失",
    source: "现场记录",
    recordedAt: "2026-05-28 10:35:00",
    entries: [
      {
        id: "re-002-1",
        remarkId: "orm-002",
        sequenceNumber: 2,
        longitude: 126.6554,
        latitude: 45.7229,
        description: "岩石遮挡，相机无法拍摄完整坐标标",
      },
    ],
  },
  {
    id: "orm-003",
    recordId: "rec-003",
    remarkText: "冰河谷C段第2点位：旧口径记录坐标与测距仪不一致",
    source: "旧记录本补录",
    recordedAt: "2025-11-15 16:00:00",
    entries: [
      {
        id: "re-003-1",
        remarkId: "orm-003",
        sequenceNumber: 2,
        longitude: 126.6580,
        latitude: 45.7250,
        description: "旧口径记录坐标偏差较大",
      },
    ],
  },
]

export const MOCK_OBSTRUCTION_POINTS: ObstructionPoint[] = [
  {
    id: "op-001",
    label: "阳光大道A段-点位1",
    longitude: 126.6534,
    latitude: 45.7211,
    status: "normal",
    sourceType: "rangefinder",
    confirmedBy: "",
    confirmedAt: "",
    reason: "",
    recordId: "rec-001",
  },
  {
    id: "op-002",
    label: "阳光大道A段-点位2",
    longitude: 126.6538,
    latitude: 45.7215,
    status: "normal",
    sourceType: "rangefinder",
    confirmedBy: "",
    confirmedAt: "",
    reason: "",
    recordId: "rec-001",
  },
  {
    id: "op-003",
    label: "阳光大道A段-点位3",
    longitude: 126.6542,
    latitude: 45.7219,
    status: "normal",
    sourceType: "rangefinder",
    confirmedBy: "",
    confirmedAt: "",
    reason: "",
    recordId: "rec-001",
  },
  {
    id: "op-004",
    label: "雪鹰弯B段-点位2（缺失坐标）",
    longitude: 126.6554,
    latitude: 45.7229,
    status: "pending_review",
    sourceType: "obstacle_remark",
    confirmedBy: "",
    confirmedAt: "",
    reason: "照片有点位但坐标表缺一行，需安全员复核",
    recordId: "rec-002",
  },
]

export const MOCK_OBSTRUCTION_HISTORY: ObstructionHistory[] = [
  {
    id: "oh-001",
    pointId: "op-001",
    action: "导入",
    operator: "安全员-张明",
    timestamp: "2026-05-28 09:15:00",
    detail: "测距仪记录首次导入，自动校验通过",
  },
  {
    id: "oh-002",
    pointId: "op-004",
    action: "标记待复核",
    operator: "系统",
    timestamp: "2026-05-28 10:30:00",
    detail: "照片有点位但坐标表缺一行，自动标记为待复核",
  },
  {
    id: "oh-003",
    pointId: "op-004",
    action: "补看障碍物备注",
    operator: "设备工程师-许工",
    timestamp: "2026-05-28 11:00:00",
    detail: "许工补看障碍物备注，确认第2点位被岩石遮挡",
  },
]

export const MOCK_GRADING_RESULTS: GradingResult[] = [
  {
    id: "gr-001",
    pointId: "op-001",
    slopeName: "阳光大道A段",
    slopeGrade: "beginner",
    slopeAngle: 8.5,
    paramVersion: "SLOPE-CALC-v2.3",
    modelVersion: "GRADE-MODEL-v1.1",
    tradeoffReason: "",
    calculatedAt: "2026-05-28 09:20:00",
  },
  {
    id: "gr-002",
    pointId: "op-002",
    slopeName: "阳光大道A段",
    slopeGrade: "beginner",
    slopeAngle: 9.2,
    paramVersion: "SLOPE-CALC-v2.3",
    modelVersion: "GRADE-MODEL-v1.1",
    tradeoffReason: "",
    calculatedAt: "2026-05-28 09:20:00",
  },
  {
    id: "gr-003",
    pointId: "op-003",
    slopeName: "阳光大道A段",
    slopeGrade: "intermediate",
    slopeAngle: 15.7,
    paramVersion: "SLOPE-CALC-v2.3",
    modelVersion: "GRADE-MODEL-v1.1",
    tradeoffReason: "",
    calculatedAt: "2026-05-28 09:20:00",
  },
]

export const MOCK_VALIDATION_RESULTS: ValidationResult[] = [
  {
    recordId: "rec-001",
    type: "normal",
    description: "照片3张，坐标表3行，完全对应",
    missingSequenceNumbers: [],
  },
  {
    recordId: "rec-002",
    type: "missing_coordinate",
    description: "照片4张，坐标表仅3行，缺失第2点位坐标",
    missingSequenceNumbers: [2],
  },
  {
    recordId: "rec-003",
    type: "supplement_mismatch",
    description: "障碍物备注中第2点位坐标（126.6580, 45.7250）与测距仪记录（126.6574, 45.7249）不一致",
    missingSequenceNumbers: [],
  },
]
