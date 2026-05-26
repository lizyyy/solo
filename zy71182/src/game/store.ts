import { create } from "zustand";
import {
  ColorSet,
  LEVELS,
  LogEntry,
  Order,
  Sheet,
  SheetFormat,
} from "./types";
import {
  createInitialState,
  endDay,
  GameState,
  log,
  makeSheet,
  tryPlace,
} from "./engine";

export interface HistoryEntry {
  id: string;
  levelId: 1 | 2 | 3;
  levelName: string;
  score: number;
  cash: number;
  result: "win" | "lose";
  days: number;
  finishedAt: number;
  logs: LogEntry[];
}

interface Store {
  state: GameState | null;
  history: HistoryEntry[];
  replayId: string | null;
  startGame: (levelId: 1 | 2 | 3) => void;
  resetGame: () => void;
  selectOrder: (id: string | null) => void;
  selectSheet: (id: string | null) => void;
  imposeSelectedOnSheet: (sheetId: string) => void;
  addSheet: (format: SheetFormat) => void;
  setInk: (sheetId: string, color: ColorSet) => void;
  cancelOrder: (orderId: string) => void;
  endDay: () => void;
  togglePause: () => void;
  quitGame: () => void;
  loadHistory: () => void;
  setReplay: (id: string | null) => void;
  exportReport: () => string;
}

function pushHistory(entry: HistoryEntry) {
  try {
    const raw = localStorage.getItem("impose_history");
    const list: HistoryEntry[] = raw ? JSON.parse(raw) : [];
    list.unshift(entry);
    const trimmed = list.slice(0, 20);
    localStorage.setItem("impose_history", JSON.stringify(trimmed));
  } catch {
    // ignore
  }
}

export const useGameStore = create<Store>((set, get) => ({
  state: null,
  history: [],
  replayId: null,
  startGame: (levelId) => {
    const state = createInitialState(levelId);
    set({ state });
  },
  resetGame: () => {
    const s = get().state;
    if (!s) return;
    set({ state: createInitialState(s.level.id) });
  },
  selectOrder: (id) => {
    const s = get().state;
    if (!s) return;
    s.selectedOrderId = id;
    set({ state: { ...s } });
  },
  selectSheet: (id) => {
    const s = get().state;
    if (!s) return;
    s.selectedSheetId = id;
    set({ state: { ...s } });
  },
  imposeSelectedOnSheet: (sheetId) => {
    const s = get().state;
    if (!s) return;
    const order = s.orders.find((o) => o.id === s.selectedOrderId);
    const sheet = s.sheets.find((sh) => sh.id === sheetId);
    if (!order || !sheet) return;
    if (sheet.used) return;
    const res = tryPlace(s, sheet, order);
    log(s, "impose", res.message);
    s.selectedOrderId = null;
    set({ state: { ...s } });
  },
  addSheet: (format) => {
    const s = get().state;
    if (!s) return;
    if (!s.level.formats.includes(format)) return;
    if (s.sheets.length >= 6) return;
    const sheet = makeSheet(format);
    s.sheets.push(sheet);
    s.selectedSheetId = sheet.id;
    log(s, "impose", `添加新 ${format} 版。`);
    set({ state: { ...s } });
  },
  setInk: (sheetId, color) => {
    const s = get().state;
    if (!s) return;
    const sheet = s.sheets.find((sh) => sh.id === sheetId);
    if (!sheet || sheet.used) return;
    if (sheet.ink && sheet.ink !== color) {
      s.cash -= s.level.inkSwitchCost;
      s.score -= s.level.inkSwitchCost;
      log(s, "ink", `${sheetId} 换色 ${color} -${s.level.inkSwitchCost}`);
    } else if (!sheet.ink) {
      log(s, "ink", `${sheetId} 上墨 ${color}`);
    }
    sheet.ink = color;
    set({ state: { ...s } });
  },
  cancelOrder: (orderId) => {
    const s = get().state;
    if (!s) return;
    const order = s.orders.find((o) => o.id === orderId);
    if (!order) return;
    order.status = "failed";
    order.failedReason = "主动放弃";
    s.cash -= 40;
    s.score -= 40;
    log(s, "cancel", `放弃 ${order.name} -40`);
    set({ state: { ...s } });
  },
  endDay: () => {
    const s = get().state;
    if (!s || s.finished) return;
    endDay(s);
    if (s.finished) {
      const entry: HistoryEntry = {
        id: `${Date.now()}`,
        levelId: s.level.id,
        levelName: s.level.name,
        score: s.score,
        cash: s.cash,
        result: s.result === "win" ? "win" : "lose",
        days: s.day,
        finishedAt: Date.now(),
        logs: s.logs,
      };
      pushHistory(entry);
      const raw = localStorage.getItem("impose_history");
      set({ history: raw ? JSON.parse(raw) : [] });
    }
    set({ state: { ...s } });
  },
  togglePause: () => {
    const s = get().state;
    if (!s) return;
    s.paused = !s.paused;
    set({ state: { ...s } });
  },
  quitGame: () => set({ state: null }),
  loadHistory: () => {
    try {
      const raw = localStorage.getItem("impose_history");
      set({ history: raw ? JSON.parse(raw) : [] });
    } catch {
      set({ history: [] });
    }
  },
  setReplay: (id) => set({ replayId: id }),
  exportReport: () => {
    const s = get().state;
    if (!s) return "";
    const rows = [
      ["项", "值"],
      ["关卡", s.level.name],
      ["分数", String(s.score)],
      ["现金", String(s.cash)],
      ["用时", `${s.day}/${s.level.maxDays}`],
      ["结果", s.result ?? "进行中"],
      ["失败原因", s.lossReason ?? "-"],
      ...s.orders.map((o) => [
        `订单 ${o.id} ${o.name}`,
        `${o.status} ${o.price} ${o.failedReason ?? ""}`,
      ]),
    ];
    return rows.map((r) => r.join(",")).join("\n");
  },
}));

export { LEVELS };
export type { Order, Sheet };
