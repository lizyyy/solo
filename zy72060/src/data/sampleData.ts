import { InspectionPoint, TraceRecord, ConflictEvidence, InspectionPhoto, Plan } from '@/types'

export const SAMPLE_PLAN: Plan = {
  id: 'plan-v2',
  name: '岸桥QC-03 2026年5月巡检方案 V2',
  createdAt: '2026-05-20T09:00:00Z',
  updatedAt: '2026-05-28T16:30:00Z',
  creator: '许姐',
  cameraState: { position: [15, 10, 15], target: [0, 5, 0] },
  viewPreset: 'free',
}

export const SAMPLE_PLAN_V1: Plan = {
  id: 'plan-v1',
  name: '岸桥QC-03 2026年5月巡检方案 V1',
  createdAt: '2026-05-15T10:00:00Z',
  updatedAt: '2026-05-18T14:00:00Z',
  creator: '许姐',
  cameraState: { position: [0, 5, 20], target: [0, 5, 0] },
  viewPreset: 'front',
}

export const SAMPLE_POINTS: InspectionPoint[] = [
  { id: 'P001', planId: 'plan-v2', label: 'P001', component: '主梁', inspectItem: '焊缝裂纹', measuredValue: '0mm', standardValue: '0mm', judgment: '合格', x: 0, y: 10, z: 0, status: 'normal', sourceType: 'point_table', sourceRef: '行1', originalRow: 1 },
  { id: 'P002', planId: 'plan-v2', label: 'P002', component: '主梁', inspectItem: '挠度测量', measuredValue: 'L/800', standardValue: '≤L/700', judgment: '合格', x: 2, y: 10, z: 0, status: 'normal', sourceType: 'point_table', sourceRef: '行2', originalRow: 2 },
  { id: 'P003', planId: 'plan-v2', label: 'P003', component: '主梁', inspectItem: '锈蚀检测', measuredValue: '2.1mm', standardValue: '≤1.5mm', judgment: '不合格', x: -2, y: 10, z: 0, status: 'anomaly', sourceType: 'point_table', sourceRef: '行3', originalRow: 3 },
  { id: 'P004', planId: 'plan-v2', label: 'P004', component: '主梁', inspectItem: '螺栓松动', measuredValue: '0个', standardValue: '0个', judgment: '合格', x: -4, y: 10, z: 0, status: 'normal', sourceType: 'point_table', sourceRef: '行4', originalRow: 4 },
  { id: 'P005', planId: 'plan-v2', label: 'P005', component: '左立柱', inspectItem: '垂直度', measuredValue: 'H/1200', standardValue: '≤H/1000', judgment: '合格', x: -6, y: 5, z: 0, status: 'normal', sourceType: 'point_table', sourceRef: '行5', originalRow: 5 },
  { id: 'P006', planId: 'plan-v2', label: 'P006', component: '左立柱', inspectItem: '锈蚀检测', measuredValue: '1.8mm', standardValue: '≤1.5mm', judgment: '不合格', x: -6, y: 3, z: 0, status: 'anomaly', sourceType: 'point_table', sourceRef: '行6', originalRow: 6 },
  { id: 'P007', planId: 'plan-v2', label: 'P007', component: '左立柱', inspectItem: '焊缝裂纹', measuredValue: '0mm', standardValue: '0mm', judgment: '合格', x: -6, y: 7, z: 0, status: 'normal', sourceType: 'point_table', sourceRef: '行7', originalRow: 7 },
  { id: 'P008', planId: 'plan-v2', label: 'P008', component: '右立柱', inspectItem: '垂直度', measuredValue: 'H/950', standardValue: '≤H/1000', judgment: '不合格', x: 6, y: 5, z: 0, status: 'anomaly', sourceType: 'point_table', sourceRef: '行8', originalRow: 8 },
  { id: 'P009', planId: 'plan-v2', label: 'P009', component: '右立柱', inspectItem: '锈蚀检测', measuredValue: '0.8mm', standardValue: '≤1.5mm', judgment: '合格', x: 6, y: 3, z: 0, status: 'normal', sourceType: 'point_table', sourceRef: '行9', originalRow: 9 },
  { id: 'P010', planId: 'plan-v2', label: 'P010', component: '右立柱', inspectItem: '地脚螺栓', measuredValue: '2个松动', standardValue: '0个', judgment: '不合格', x: 6, y: 7, z: 0, status: 'conflict', sourceType: 'point_table', sourceRef: '行10', originalRow: 10 },
  { id: 'P011', planId: 'plan-v2', label: 'P011', component: '前大梁', inspectItem: '挠度测量', measuredValue: 'L/650', standardValue: '≤L/700', judgment: '不合格', x: 0, y: 10, z: 8, status: 'anomaly', sourceType: 'point_table', sourceRef: '行11', originalRow: 11 },
  { id: 'P012', planId: 'plan-v2', label: 'P012', component: '前大梁', inspectItem: '锈蚀检测', measuredValue: '0.5mm', standardValue: '≤1.5mm', judgment: '合格', x: 2, y: 10, z: 8, status: 'normal', sourceType: 'point_table', sourceRef: '行12', originalRow: 12 },
  { id: 'P013', planId: 'plan-v2', label: 'P013', component: '前大梁', inspectItem: '焊缝裂纹', measuredValue: '0.3mm', standardValue: '0mm', judgment: '不合格', x: -2, y: 10, z: 8, status: 'conflict', sourceType: 'point_table', sourceRef: '行13', originalRow: 13 },
  { id: 'P014', planId: 'plan-v2', label: 'P014', component: '后大梁', inspectItem: '挠度测量', measuredValue: 'L/900', standardValue: '≤L/700', judgment: '合格', x: 0, y: 10, z: -6, status: 'normal', sourceType: 'point_table', sourceRef: '行14', originalRow: 14 },
  { id: 'P015', planId: 'plan-v2', label: 'P015', component: '后大梁', inspectItem: '锈蚀检测', measuredValue: '1.2mm', standardValue: '≤1.5mm', judgment: '合格', x: 2, y: 10, z: -6, status: 'normal', sourceType: 'point_table', sourceRef: '行15', originalRow: 15 },
  { id: 'P016', planId: 'plan-v2', label: 'P016', component: '小车', inspectItem: '车轮磨损', measuredValue: '3mm', standardValue: '≤5mm', judgment: '合格', x: 0, y: 11, z: 3, status: 'normal', sourceType: 'point_table', sourceRef: '行16', originalRow: 16 },
  { id: 'P017', planId: 'plan-v2', label: 'P017', component: '小车', inspectItem: '钢丝绳', measuredValue: '断丝6根', standardValue: '≤断丝5根', judgment: '不合格', x: 2, y: 11, z: 3, status: 'anomaly', sourceType: 'point_table', sourceRef: '行17', originalRow: 17 },
  { id: 'P018', planId: 'plan-v2', label: 'P018', component: '小车', inspectItem: '制动器', measuredValue: '正常', standardValue: '正常', judgment: '合格', x: -2, y: 11, z: 3, status: 'normal', sourceType: 'point_table', sourceRef: '行18', originalRow: 18 },
  { id: 'P019', planId: 'plan-v2', label: 'P019', component: '主梁', inspectItem: '涂层厚度', measuredValue: '180μm', standardValue: '≥200μm', judgment: '不合格', x: 4, y: 10, z: 0, status: 'anomaly', sourceType: 'point_table', sourceRef: '行19', originalRow: 19 },
  { id: 'P020', planId: 'plan-v2', label: 'P020', component: '左立柱', inspectItem: '地脚螺栓', measuredValue: '0个松动', standardValue: '0个', judgment: '合格', x: -6, y: 1, z: 0, status: 'normal', sourceType: 'point_table', sourceRef: '行20', originalRow: 20 },
]

export const SAMPLE_TRACES: TraceRecord[] = [
  { id: 'T001', pointId: 'P003', sourceRow: '行3', sourceType: 'point_table', sourceContent: '主梁锈蚀检测: 测量值2.1mm, 标准值≤1.5mm, 判定不合格', note: '已安排除锈补漆，预计6月5日前完成', processedAt: '2026-05-22T14:30:00Z', processedBy: '许姐' },
  { id: 'T002', pointId: 'P006', sourceRow: '行6', sourceType: 'point_table', sourceContent: '左立柱锈蚀检测: 测量值1.8mm, 标准值≤1.5mm, 判定不合格', note: '需二次复检确认腐蚀面积', processedAt: '2026-05-23T10:00:00Z', processedBy: '许姐' },
  { id: 'T003', pointId: 'P008', sourceRow: '行8', sourceType: 'point_table', sourceContent: '右立柱垂直度: 测量值H/950, 标准值≤H/1000, 判定不合格', note: '超差较小，持续监测', processedAt: '2026-05-24T09:15:00Z', processedBy: '许姐' },
  { id: 'T004', pointId: 'P010', sourceRow: '行10', sourceType: 'point_table', sourceContent: '右立柱地脚螺栓: 测量值2个松动, 标准值0个, 判定不合格', note: '与照片描述冲突，待确认', processedAt: '2026-05-24T11:00:00Z', processedBy: '许姐' },
  { id: 'T005', pointId: 'P011', sourceRow: '行11', sourceType: 'point_table', sourceContent: '前大梁挠度: 测量值L/650, 标准值≤L/700, 判定不合格', note: '挠度超限，需结构加固评估', processedAt: '2026-05-25T15:20:00Z', processedBy: '许姐' },
  { id: 'T006', pointId: 'P013', sourceRow: '行13', sourceType: 'point_table', sourceContent: '前大梁焊缝: 测量值0.3mm, 标准值0mm, 判定不合格', note: '与照片描述冲突，待确认', processedAt: '2026-05-25T16:00:00Z', processedBy: '许姐' },
  { id: 'T007', pointId: 'P017', sourceRow: '行17', sourceType: 'point_table', sourceContent: '小车钢丝绳: 测量值断丝6根, 标准值≤断丝5根, 判定不合格', note: '已安排更换钢丝绳', processedAt: '2026-05-26T10:00:00Z', processedBy: '许姐' },
  { id: 'T008', pointId: 'P019', sourceRow: '行19', sourceType: 'point_table', sourceContent: '主梁涂层厚度: 测量值180μm, 标准值≥200μm, 判定不合格', note: '需重新涂装', processedAt: '2026-05-27T09:00:00Z', processedBy: '许姐' },
]

export const SAMPLE_CONFLICTS: ConflictEvidence[] = [
  {
    id: 'C001',
    traceId: 'T004',
    pointId: 'P010',
    side: 'photo',
    description: '巡检照片显示地脚螺栓无明显松动痕迹',
    evidence: '照片可见螺栓紧固状态正常，无位移迹象',
    suggestion: '建议重新现场核实螺栓扭矩值',
  },
  {
    id: 'C002',
    traceId: 'T004',
    pointId: 'P010',
    side: 'data',
    description: '点位表记录2个地脚螺栓松动',
    evidence: '测量值: 2个松动, 标准值: 0个, 判定不合格',
    suggestion: '如确认松动，需立即紧固处理',
  },
  {
    id: 'C003',
    traceId: 'T006',
    pointId: 'P013',
    side: 'photo',
    description: '巡检照片显示焊缝无明显裂纹',
    evidence: '照片可见焊缝表面完整，未见开裂',
    suggestion: '建议进行无损探伤复检',
  },
  {
    id: 'C004',
    traceId: 'T006',
    pointId: 'P013',
    side: 'data',
    description: '点位表记录焊缝裂纹0.3mm',
    evidence: '测量值: 0.3mm, 标准值: 0mm, 判定不合格',
    suggestion: '如确认裂纹，需打磨补焊处理',
  },
]

export const SAMPLE_PHOTOS: InspectionPhoto[] = [
  {
    id: 'PH001',
    fileName: '右立柱地脚螺栓_20260518.jpg',
    dataUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=industrial%20steel%20column%20base%20with%20anchor%20bolts%20tight%20and%20secure%2C%20close-up%20photography%2C%20dark%20metallic%20surface&image_size=landscape_4_3',
    capturedAt: '2026-05-18T10:30:00Z',
    pointId: 'P010',
    description: '地脚螺栓无明显松动痕迹',
  },
  {
    id: 'PH002',
    fileName: '前大梁焊缝_20260518.jpg',
    dataUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=crane%20beam%20weld%20seam%20surface%20intact%20no%20cracks%2C%20industrial%20inspection%20photography%2C%20steel%20structure&image_size=landscape_4_3',
    capturedAt: '2026-05-18T10:45:00Z',
    pointId: 'P013',
    description: '焊缝表面完整，未见开裂',
  },
  {
    id: 'PH003',
    fileName: '左立柱锈蚀_20260518.jpg',
    dataUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=steel%20column%20surface%20rust%20corrosion%20spot%2C%20industrial%20equipment%20deterioration%2C%20close-up&image_size=landscape_4_3',
    capturedAt: '2026-05-18T11:00:00Z',
    pointId: 'P006',
    description: '左立柱中段可见明显锈蚀',
  },
]

export const CSV_TEMPLATE = `序号,构件,检测项,测量值,标准值,判定,备注,X,Y,Z
1,主梁,焊缝裂纹,0mm,0mm,合格,,0,10,0
2,主梁,挠度测量,L/800,≤L/700,合格,,2,10,0
3,主梁,锈蚀检测,2.1mm,≤1.5mm,不合格,超标,-2,10,0
4,主梁,螺栓松动,0个,0个,合格,,-4,10,0
5,左立柱,垂直度,H/1200,≤H/1000,合格,,-6,5,0
6,左立柱,锈蚀检测,1.8mm,≤1.5mm,不合格,超标,-6,3,0
7,左立柱,焊缝裂纹,0mm,0mm,合格,,-6,7,0
8,右立柱,垂直度,H/950,≤H/1000,不合格,超差,6,5,0
9,右立柱,锈蚀检测,0.8mm,≤1.5mm,合格,,6,3,0
10,右立柱,地脚螺栓,2个松动,0个,不合格,,6,7,0
11,前大梁,挠度测量,L/650,≤L/700,不合格,超限,0,10,8
12,前大梁,锈蚀检测,0.5mm,≤1.5mm,合格,,2,10,8
13,前大梁,焊缝裂纹,0.3mm,0mm,不合格,,,-2,10,8
14,后大梁,挠度测量,L/900,≤L/700,合格,,0,10,-6
15,后大梁,锈蚀检测,1.2mm,≤1.5mm,合格,,2,10,-6
16,小车,车轮磨损,3mm,≤5mm,合格,,0,11,3
17,小车,钢丝绳,断丝6根,≤断丝5根,不合格,,2,11,3
18,小车,制动器,正常,正常,合格,,-2,11,3
19,主梁,涂层厚度,180μm,≥200μm,不合格,偏薄,4,10,0
20,左立柱,地脚螺栓,0个松动,0个,合格,,-6,1,0`
