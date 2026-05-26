export type ColorSet =
  | "K"
  | "CM"
  | "MY"
  | "CY"
  | "CMY"
  | "CMYK"
  | "PANTONE";

export type SheetFormat = "FULL" | "HALF" | "QUARTER";

export const SHEET_SIZES: Record<SheetFormat, { w: number; h: number; label: string }> = {
  FULL: { w: 880, h: 1230, label: "大对开" },
  HALF: { w: 615, h: 880, label: "四开" },
  QUARTER: { w: 440, h: 615, label: "八开" },
};

export const COLOR_LABELS: Record<ColorSet, { label: string; css: string }> = {
  K: { label: "单黑", css: "#111111" },
  CM: { label: "双色青品", css: "#2a6bbd" },
  MY: { label: "双色品黄", css: "#d9a33c" },
  CY: { label: "双色青黄", css: "#4a9d6d" },
  CMY: { label: "三色", css: "#a463c7" },
  CMYK: { label: "四色", css: "#222a66" },
  PANTONE: { label: "专色", css: "#c0392b" },
};

export type OrderStatus = "queued" | "imposed" | "printing" | "printed" | "failed";

export interface Order {
  id: string;
  name: string;
  sizeW: number;
  sizeH: number;
  copies: number;
  colors: ColorSet;
  deadline: number;
  price: number;
  quality: number;
  status: OrderStatus;
  placedOn?: string; // sheet id
  failedReason?: string;
}

export interface PlacedOrder {
  orderId: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rotated: boolean;
}

export interface Sheet {
  id: string;
  format: SheetFormat;
  placed: PlacedOrder[];
  ink: ColorSet | null;
  used: boolean;
}

export type LogKind =
  | "day_start"
  | "impose"
  | "ink"
  | "print"
  | "fail"
  | "day_end"
  | "cancel";

export interface LogEntry {
  day: number;
  kind: LogKind;
  message: string;
  at: number;
}

export interface LevelConfig {
  id: 1 | 2 | 3;
  name: string;
  description: string;
  maxDays: number;
  maxOrders: number;
  formats: SheetFormat[];
  allowedColors: ColorSet[];
  inkSwitchCost: number;
  missDeadlinePenalty: number;
  wastePenaltyPer: number;
  paperCost: Record<SheetFormat, number>;
  minQuality: number;
  targetScore: number;
}

export const LEVELS: LevelConfig[] = [
  {
    id: 1,
    name: "学徒班",
    description: "大对开单色黑，认识拼版占用与交期。",
    maxDays: 8,
    maxOrders: 4,
    formats: ["FULL"],
    allowedColors: ["K"],
    inkSwitchCost: 0,
    missDeadlinePenalty: 80,
    wastePenaltyPer: 0.02,
    paperCost: { FULL: 8, HALF: 5, QUARTER: 3 },
    minQuality: 70,
    targetScore: 600,
  },
  {
    id: 2,
    name: "领机班",
    description: "加入四开与双色，色组切换有成本。",
    maxDays: 12,
    maxOrders: 6,
    formats: ["FULL", "HALF"],
    allowedColors: ["K", "CM", "MY", "CY"],
    inkSwitchCost: 60,
    missDeadlinePenalty: 120,
    wastePenaltyPer: 0.03,
    paperCost: { FULL: 10, HALF: 6, QUARTER: 4 },
    minQuality: 75,
    targetScore: 1200,
  },
  {
    id: 3,
    name: "车间主任",
    description: "三种开数、CMYK+专色、质量门槛。",
    maxDays: 16,
    maxOrders: 8,
    formats: ["FULL", "HALF", "QUARTER"],
    allowedColors: ["K", "CMYK", "PANTONE"],
    inkSwitchCost: 120,
    missDeadlinePenalty: 180,
    wastePenaltyPer: 0.04,
    paperCost: { FULL: 12, HALF: 8, QUARTER: 5 },
    minQuality: 80,
    targetScore: 2000,
  },
];
