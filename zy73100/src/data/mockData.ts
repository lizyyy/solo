import type {
  MaterialItem,
  DrawingPoint,
  Anomaly,
  SupplementNote,
  ReviewAction,
} from "@/types";

export const initialMaterials: MaterialItem[] = [
  {
    id: "WL-001",
    code: "WL-001",
    name: "雨水斗",
    spec: "Φ110 侧排式",
    batch: "202605A",
    supplier: "宝狮塑业",
    qty: "12个",
    status: "已复核",
    sourceRowType: "标准行",
    remark: "A区、D区各6个，位置符合图纸",
    createdAt: "2026-05-22",
  },
  {
    id: "PS-003",
    code: "PS-003",
    name: "排水立管",
    spec: "De160 UPVC",
    batch: "202604C",
    supplier: "宝狮塑业",
    qty: "8根",
    status: "异常",
    sourceRowType: "标准行",
    remark: "现场安装位置向东偏移2.1m，未同步回模型",
    createdAt: "2026-06-02",
  },
  {
    id: "TG-007",
    code: "TG-007",
    name: "不锈钢天沟",
    spec: "200×150×2.0",
    batch: "202605B",
    supplier: "顺达金属",
    qty: "36米",
    status: "待复核",
    sourceRowType: "标准行",
    remark: "C区南段与新风机基础交叉，疑似碰撞",
    createdAt: "2026-06-05",
  },
  {
    id: "BZ-001",
    code: "BZ-001",
    name: "后补备注",
    spec: "—",
    batch: "—",
    supplier: "—",
    qty: "—",
    status: "待复核",
    sourceRowType: "后补备注行",
    remark:
      "D区屋面东侧坡度：实测2%，图纸标注1.5%；现场已按2%施工。请结构与建筑复核排水方向是否仍顺畅。",
    createdAt: "2026-06-08",
  },
];

export const initialDrawingPoints: DrawingPoint[] = [
  {
    id: "DP-A1",
    name: "A区雨水斗 A1",
    type: "雨水斗",
    x: 18,
    y: 28,
    materialItemId: "WL-001",
    zone: "A",
    description: "位置正确，无异常",
  },
  {
    id: "DP-A2",
    name: "A区雨水斗 A2",
    type: "雨水斗",
    x: 18,
    y: 72,
    materialItemId: "WL-001",
    zone: "A",
    description: "位置正确，无异常",
  },
  {
    id: "DP-B3",
    name: "B区排水立管 B3",
    type: "立管",
    x: 42,
    y: 55,
    materialItemId: "PS-003",
    zone: "B",
    description:
      "模型位置(X=42)与现场位置(X=49)不符，偏移2.1m，变更未同步",
  },
  {
    id: "DP-C7",
    name: "C区天沟 C7 南段",
    type: "天沟",
    x: 70,
    y: 45,
    materialItemId: "TG-007",
    zone: "C",
    description: "与#3新风机基础(68-74, 42-48)发生碰撞",
  },
  {
    id: "DP-D1",
    name: "D区坡度检测点",
    type: "坡度",
    x: 85,
    y: 72,
    materialItemId: "BZ-001",
    zone: "D",
    description: "图纸1.5% / 现场2%，后补备注待复核",
  },
  {
    id: "DP-D2",
    name: "D区雨水斗 D2",
    type: "雨水斗",
    x: 85,
    y: 28,
    materialItemId: "WL-001",
    zone: "D",
    description: "位置正确，无异常",
  },
];

export const initialAnomalies: Anomaly[] = [
  {
    id: "AN-001",
    type: "变更未同步",
    severity: "严重",
    drawingPointId: "DP-B3",
    materialItemId: "PS-003",
    status: "待确认",
    description:
      "B3立管模型位置X=42 / 现场实际X=49，向东偏移2.1m。现场变更单CN-2026-058已下发，但模型未同步更新。",
  },
  {
    id: "AN-002",
    type: "碰撞",
    severity: "严重",
    drawingPointId: "DP-C7",
    materialItemId: "TG-007",
    status: "待确认",
    description:
      "C区南段天沟(68-74, 42-48)与暖通#3新风机基础重叠，碰撞深度约320mm。需天沟绕行或设备改位。",
  },
  {
    id: "AN-003",
    type: "坡度异常",
    severity: "一般",
    drawingPointId: "DP-D1",
    materialItemId: "BZ-001",
    status: "待确认",
    description:
      "D区东侧图纸标注坡度1.5%，现场按2%施工（后补备注）。排水方向更顺畅，但需确认找坡层厚度是否影响防水构造。",
  },
];

export const initialSupplementNotes: SupplementNote[] = [
  {
    id: "SN-001",
    materialItemId: "BZ-001",
    content:
      "D区屋面东侧坡度：实测2%，图纸标注1.5%；现场已按2%施工。请结构与建筑复核排水方向是否仍顺畅。补录依据：现场测量记录单 MR-2026-0608-03，测量人：王工。",
    author: "老叶",
    createdAt: "2026-06-08 16:42",
  },
];

export const initialReviewActions: ReviewAction[] = [
  {
    id: "RA-000",
    type: "状态修改",
    targetType: "材料行",
    targetId: "WL-001",
    before: { status: "待复核" },
    after: { status: "已复核" },
    operator: "老叶",
    timestamp: "2026-06-09 10:15",
  },
];

export const OPERATORS = ["老叶", "张经理", "王工"];
