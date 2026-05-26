import type { Level, Zone } from "@/types";

const mk = (w: number, h: number, z: (x: number, y: number) => Zone): Zone[][] =>
  Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => z(x, y)));

export const LEVELS: Level[] = [
  {
    id: "lvl-1",
    name: "第一关 · 常温城市快送",
    description: "小型冷链车，温层简单。熟悉操作：装车、检查卸货顺序、准时提交。",
    gridW: 6,
    gridH: 4,
    timeLimitSec: 120,
    doorSide: "right",
    difficulty: 1,
    zoneLayout: mk(6, 4, (_x, y) => (y < 2 ? "ambient" : "chilled")),
    cargos: [
      { id: "c1", name: "蔬菜箱 A", sku: "VEG-001", zone: "chilled", weight: 8, destOrder: 3 },
      { id: "c2", name: "水果箱 B", sku: "FRU-002", zone: "chilled", weight: 10, destOrder: 2 },
      { id: "c3", name: "饮料箱 C", sku: "BEV-101", zone: "ambient", weight: 12, destOrder: 4 },
      { id: "c4", name: "零食箱 D", sku: "SNK-221", zone: "ambient", weight: 6, destOrder: 1 },
      { id: "c5", name: "乳品箱 E", sku: "DAI-310", zone: "chilled", weight: 9, destOrder: 5 },
      { id: "c6", name: "面包箱 F", sku: "BAK-411", zone: "ambient", weight: 5, destOrder: 6 },
    ],
  },
  {
    id: "lvl-2",
    name: "第二关 · 三区混装挑战",
    description: "冻品 / 冷藏 / 常温三区同车，必须严格分区。注意冻品不能与常温相邻。",
    gridW: 8,
    gridH: 5,
    timeLimitSec: 180,
    doorSide: "right",
    difficulty: 2,
    zoneLayout: mk(8, 5, (_x, y) => (y < 1 ? "frozen" : y < 3 ? "chilled" : "ambient")),
    cargos: [
      { id: "c1", name: "冻肉 A", sku: "FRZ-M1", zone: "frozen", weight: 20, destOrder: 3 },
      { id: "c2", name: "冻海鲜 B", sku: "FRZ-S2", zone: "frozen", weight: 15, destOrder: 4 },
      { id: "c3", name: "蔬菜 C", sku: "VEG-003", zone: "chilled", weight: 8, destOrder: 2 },
      { id: "c4", name: "水果 D", sku: "FRU-004", zone: "chilled", weight: 10, destOrder: 5 },
      { id: "c5", name: "乳品 E", sku: "DAI-305", zone: "chilled", weight: 9, destOrder: 6 },
      { id: "c6", name: "饮料 F", sku: "BEV-106", zone: "ambient", weight: 12, destOrder: 7 },
      { id: "c7", name: "零食 G", sku: "SNK-227", zone: "ambient", weight: 6, destOrder: 1 },
      { id: "c8", name: "米面 H", sku: "GRA-508", zone: "ambient", weight: 14, destOrder: 8 },
    ],
  },
  {
    id: "lvl-3",
    name: "第三关 · 时效压力测试",
    description: "卸货顺序紧凑，超时即判损。合理规划先卸货必须靠近车门。",
    gridW: 10,
    gridH: 5,
    timeLimitSec: 150,
    doorSide: "right",
    difficulty: 3,
    zoneLayout: mk(10, 5, (_x, y) => (y < 2 ? "frozen" : y < 4 ? "chilled" : "ambient")),
    cargos: [
      { id: "c1", name: "冻鱼 A", sku: "FRZ-F1", zone: "frozen", weight: 22, destOrder: 2 },
      { id: "c2", name: "冻肉 B", sku: "FRZ-M2", zone: "frozen", weight: 20, destOrder: 5 },
      { id: "c3", name: "雪糕 C", sku: "FRZ-I3", zone: "frozen", weight: 8, destOrder: 1 },
      { id: "c4", name: "蔬菜 D", sku: "VEG-004", zone: "chilled", weight: 8, destOrder: 3 },
      { id: "c5", name: "水果 E", sku: "FRU-005", zone: "chilled", weight: 10, destOrder: 6 },
      { id: "c6", name: "鲜奶 F", sku: "DAI-306", zone: "chilled", weight: 9, destOrder: 4 },
      { id: "c7", name: "饮料 G", sku: "BEV-107", zone: "ambient", weight: 12, destOrder: 7 },
      { id: "c8", name: "零食 H", sku: "SNK-228", zone: "ambient", weight: 6, destOrder: 8 },
      { id: "c9", name: "米面 I", sku: "GRA-509", zone: "ambient", weight: 14, destOrder: 9 },
      { id: "c10", name: "纸巾 J", sku: "PCK-600", zone: "ambient", weight: 5, destOrder: 10 },
    ],
  },
];

export const getLevel = (id: string): Level | undefined => LEVELS.find((l) => l.id === id);
