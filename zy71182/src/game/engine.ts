import {
  ColorSet,
  LEVELS,
  LevelConfig,
  LogEntry,
  Order,
  Sheet,
  SheetFormat,
  SHEET_SIZES,
} from "./types";

let orderCounter = 0;
let sheetCounter = 0;

export function newOrderId() {
  orderCounter += 1;
  return `O${orderCounter}`;
}
export function newSheetId() {
  sheetCounter += 1;
  return `S${sheetCounter}`;
}

export function resetCounters() {
  orderCounter = 0;
  sheetCounter = 0;
}

function randomChoice<T>(arr: T[], rand = Math.random): T {
  return arr[Math.floor(rand() * arr.length)];
}

const ORDER_NAMES = [
  "宣传单页",
  "名片",
  "海报",
  "包装盒",
  "手提袋",
  "书刊内页",
  "封套",
  "标签贴",
  "台历",
  "明信片",
];

export function generateOrder(level: LevelConfig, day: number): Order {
  const sizes: Array<[number, number]> = [
    [210, 148],
    [210, 297],
    [420, 297],
    [148, 210],
    [594, 420],
    [297, 210],
  ];
  const [w, h] = randomChoice(sizes);
  const colors = randomChoice(level.allowedColors);
  const deadline = day + 3 + Math.floor(Math.random() * 4);
  const copies = 500 + Math.floor(Math.random() * 2500);
  const basePrice = Math.round((w * h) / 500 + copies / 50 + colorCost(colors));
  return {
    id: newOrderId(),
    name: ORDER_NAMES[Math.floor(Math.random() * ORDER_NAMES.length)] + "-" + day,
    sizeW: w,
    sizeH: h,
    copies,
    colors,
    deadline,
    price: basePrice,
    quality: 85 + Math.floor(Math.random() * 15),
    status: "queued",
  };
}

export function colorCost(c: ColorSet): number {
  switch (c) {
    case "K":
      return 20;
    case "CM":
    case "MY":
    case "CY":
      return 40;
    case "CMY":
      return 60;
    case "CMYK":
      return 80;
    case "PANTONE":
      return 120;
  }
}

export function makeSheet(format: SheetFormat): Sheet {
  return {
    id: newSheetId(),
    format,
    placed: [],
    ink: null,
    used: false,
  };
}

export interface GameSnapshot {
  day: number;
  orders: Order[];
  sheets: Sheet[];
  inkStock: Record<ColorSet, number>;
  cash: number;
  score: number;
  finished: boolean;
  result: "win" | "lose" | null;
  lossReason: string | null;
  logs: LogEntry[];
}

export interface GameState extends GameSnapshot {
  level: LevelConfig;
  paused: boolean;
  selectedOrderId: string | null;
  selectedSheetId: string | null;
  pendingInk: ColorSet | null;
  dayLogs: LogEntry[];
}

export function createInitialState(levelId: 1 | 2 | 3): GameState {
  resetCounters();
  const level = LEVELS.find((l) => l.id === levelId)!;
  const orders: Order[] = [];
  for (let i = 0; i < Math.min(3, level.maxOrders); i++) {
    orders.push(generateOrder(level, 1));
  }
  const sheets: Sheet[] = [makeSheet(level.formats[0])];
  const inkStock = {
    K: 100,
    CM: 100,
    MY: 100,
    CY: 100,
    CMY: 100,
    CMYK: 100,
    PANTONE: 100,
  } as Record<ColorSet, number>;
  return {
    level,
    day: 1,
    orders,
    sheets,
    inkStock,
    cash: 500,
    score: 0,
    finished: false,
    result: null,
    lossReason: null,
    logs: [
      {
        day: 1,
        kind: "day_start",
        message: `开始第 1 天：${level.name}，目标分数 ${level.targetScore}。`,
        at: Date.now(),
      },
    ],
    paused: false,
    selectedOrderId: null,
    selectedSheetId: sheets[0].id,
    pendingInk: null,
    dayLogs: [],
  };
}

export function log(state: GameState, kind: LogEntry["kind"], message: string) {
  const entry: LogEntry = {
    day: state.day,
    kind,
    message,
    at: Date.now(),
  };
  state.logs.push(entry);
  state.dayLogs.push(entry);
}

export function canPlace(sheet: Sheet, w: number, h: number): { x: number; y: number; rotated: boolean } | null {
  const size = SHEET_SIZES[sheet.format];
  const margin = 6;
  const tryOrientations = [
    { w, h, rotated: false },
    { w: h, h: w, rotated: true },
  ];
  for (const o of tryOrientations) {
    if (o.w > size.w - margin * 2 || o.h > size.h - margin * 2) continue;
    // simplest packer: top-left scan
    for (let y = margin; y + o.h <= size.h - margin; y += 10) {
      for (let x = margin; x + o.w <= size.w - margin; x += 10) {
        const collide = sheet.placed.some((p) =>
          x < p.x + p.w && x + o.w > p.x && y < p.y + p.h && y + o.h > p.y,
        );
        if (!collide) {
          return { x, y, rotated: o.rotated };
        }
      }
    }
  }
  return null;
}

export function tryPlace(
  state: GameState,
  sheet: Sheet,
  order: Order,
): { ok: boolean; message: string } {
  if (order.status === "printed" || order.status === "failed") {
    return { ok: false, message: "订单已结束，不能再拼版。" };
  }
  const pos = canPlace(sheet, order.sizeW, order.sizeH);
  if (!pos) return { ok: false, message: "版面放不下，请换开数或清理已有拼版。" };
  sheet.placed.push({
    orderId: order.id,
    x: pos.x,
    y: pos.y,
    w: pos.rotated ? order.sizeH : order.sizeW,
    h: pos.rotated ? order.sizeW : order.sizeH,
    rotated: pos.rotated,
  });
  order.status = "imposed";
  order.placedOn = sheet.id;
  return { ok: true, message: `已拼版 ${order.name} 到 ${sheet.id}` };
}

export function endDay(state: GameState) {
  const level = state.level;
  // print all imposed orders on sheets that have ink
  for (const sheet of state.sheets) {
    if (sheet.ink && sheet.placed.length > 0 && !sheet.used) {
      for (const p of sheet.placed) {
        const order = state.orders.find((o) => o.id === p.orderId);
        if (!order) continue;
        if (sheet.ink !== order.colors) {
          order.status = "failed";
          order.failedReason = "色组不匹配，印废。";
          log(state, "fail", `${order.name} 色组不匹配，失败。`);
          state.score -= 30;
        } else if (order.quality < level.minQuality) {
          order.status = "failed";
          order.failedReason = "质量未达门槛。";
          log(state, "fail", `${order.name} 质量低于 ${level.minQuality}，失败。`);
          state.score -= 20;
        } else {
          order.status = "printed";
          state.cash += order.price;
          state.score += order.price;
          log(state, "print", `${order.name} 印刷完成，+${order.price}`);
        }
      }
      sheet.used = true;
    }
  }

  // deadline tick
  for (const order of state.orders) {
    if (order.status === "printed" || order.status === "failed") continue;
    if (state.day >= order.deadline) {
      if (order.status === "imposed" || order.status === "queued") {
        order.status = "failed";
        order.failedReason = "交期超时。";
        state.cash -= level.missDeadlinePenalty;
        state.score -= level.missDeadlinePenalty;
        log(state, "fail", `${order.name} 交期超时 -${level.missDeadlinePenalty}`);
      }
    }
  }

  // waste & paper cost
  for (const sheet of state.sheets) {
    if (sheet.used) {
      const size = SHEET_SIZES[sheet.format];
      const used = sheet.placed.reduce((s, p) => s + p.w * p.h, 0);
      const area = size.w * size.h;
      const wasteRatio = Math.max(0, 1 - used / area);
      const wastePenalty = Math.round(area * level.wastePenaltyPer * wasteRatio);
      state.cash -= level.paperCost[sheet.format] + wastePenalty;
      state.score -= level.paperCost[sheet.format] + wastePenalty;
      log(
        state,
        "day_end",
        `${sheet.id} ${SHEET_SIZES[sheet.format].label} 浪费 ${Math.round(
          wasteRatio * 100,
        )}%，-${level.paperCost[sheet.format] + wastePenalty}`,
      );
    }
  }

  if (state.day >= level.maxDays) {
    state.finished = true;
    if (state.score >= level.targetScore) {
      state.result = "win";
      state.lossReason = null;
    } else {
      state.result = "lose";
      state.lossReason = `累计分数 ${state.score} 未达到目标 ${level.targetScore}`;
    }
    return;
  }

  state.day += 1;
  // add new orders up to max
  const remaining = state.orders.filter(
    (o) => o.status === "queued" || o.status === "imposed",
  ).length;
  const add = Math.min(1 + (state.day % 2 === 0 ? 1 : 0), level.maxOrders - remaining);
  for (let i = 0; i < add; i++) {
    state.orders.push(generateOrder(level, state.day));
  }
  log(state, "day_start", `第 ${state.day} 天开始。`);
}
