import type { Cargo, Level, PlacedCargo, Violation, Zone } from "@/types";

export const ADJACENT_FORBIDDEN_PAIRS: Array<[Zone, Zone]> = [
  ["frozen", "ambient"],
  ["ambient", "frozen"],
];

export const TEMP_RISE_LIMIT_SEC: Record<Zone, number> = {
  frozen: 60,
  chilled: 120,
  ambient: Infinity,
};

export const MAX_VIOLATIONS_TO_FAIL = 3;

export const PENALTIES = {
  zone_mismatch: 15,
  adjacent_zone: 10,
  unload_blocked: 25,
  temp_rise: 20,
  over_weight: 10,
  over_time: 30,
};

export function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function cellKey(x: number, y: number): string {
  return `${x},${y}`;
}

export function buildPlacedMap(placed: PlacedCargo[]): Map<string, PlacedCargo> {
  const m = new Map<string, PlacedCargo>();
  placed.forEach((p) => m.set(cellKey(p.x, p.y), p));
  return m;
}

export function getCargoById(level: Level, id: string): Cargo | undefined {
  return level.cargos.find((c) => c.id === id);
}

export interface PlaceCheckResult {
  allowed: boolean;
  violations: Violation[];
}

export function checkPlacement(
  level: Level,
  cargo: Cargo,
  x: number,
  y: number,
  placed: PlacedCargo[],
  nowMs: number
): PlaceCheckResult {
  const violations: Violation[] = [];
  const map = buildPlacedMap(placed);

  if (map.has(cellKey(x, y))) {
    return { allowed: false, violations: [{ id: uid(), type: "zone_mismatch", message: "该格已占用", penalty: 0, at: nowMs }] };
  }
  if (x < 0 || y < 0 || x >= level.gridW || y >= level.gridH) {
    return { allowed: false, violations: [] };
  }

  const targetZone = level.zoneLayout[y][x];
  if (targetZone !== cargo.zone) {
    violations.push({
      id: uid(),
      type: "zone_mismatch",
      cargoId: cargo.id,
      x,
      y,
      message: `${cargo.name}(${cargo.zone}) 放入 ${targetZone} 温区`,
      penalty: PENALTIES.zone_mismatch,
      at: nowMs,
    });
  }

  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  for (const [dx, dy] of dirs) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= level.gridW || ny >= level.gridH) continue;
    const neighbor = map.get(cellKey(nx, ny));
    if (!neighbor) continue;
    const nCargo = getCargoById(level, neighbor.cargoId);
    if (!nCargo) continue;
    const pair: [Zone, Zone] = [cargo.zone, nCargo.zone];
    const forbid = ADJACENT_FORBIDDEN_PAIRS.some(([a, b]) => a === pair[0] && b === pair[1]);
    if (forbid) {
      violations.push({
        id: uid(),
        type: "adjacent_zone",
        cargoId: cargo.id,
        x,
        y,
        message: `${cargo.name} 与 ${nCargo.name} 温层不兼容相邻`,
        penalty: PENALTIES.adjacent_zone,
        at: nowMs,
      });
    }
  }

  if (level.maxWeightPerRow) {
    const rowLoad = placed
      .filter((p) => p.y === y)
      .reduce((sum, p) => sum + (getCargoById(level, p.cargoId)?.weight ?? 0), 0) + cargo.weight;
    if (rowLoad > level.maxWeightPerRow) {
      violations.push({
        id: uid(),
        type: "over_weight",
        cargoId: cargo.id,
        x,
        y,
        message: `第 ${y + 1} 排超重 ${rowLoad - level.maxWeightPerRow}kg`,
        penalty: PENALTIES.over_weight,
        at: nowMs,
      });
    }
  }

  return { allowed: violations.length === 0 || violations.every((v) => v.penalty >= 0), violations };
}

export function checkUnloadBlocked(level: Level, placed: PlacedCargo[], nowMs: number): Violation[] {
  const violations: Violation[] = [];
  const map = buildPlacedMap(placed);
  const doorSide = level.doorSide ?? "right";
  const sortedByOrder = [...placed].sort((a, b) => {
    const ca = getCargoById(level, a.cargoId);
    const cb = getCargoById(level, b.cargoId);
    return (ca?.destOrder ?? 999) - (cb?.destOrder ?? 999);
  });
  sortedByOrder.forEach((p, i) => {
    const cargo = getCargoById(level, p.cargoId);
    if (!cargo) return;
    for (let j = i + 1; j < sortedByOrder.length; j++) {
      const other = sortedByOrder[j];
      const oCargo = getCargoById(level, other.cargoId);
      if (!oCargo) continue;
      if (oCargo.destOrder <= cargo.destOrder) continue;
      if (other.y !== p.y) continue;
      const doorX = doorSide === "right" ? level.gridW - 1 : 0;
      const myDist = Math.abs(p.x - doorX);
      const otherDist = Math.abs(other.x - doorX);
      if (otherDist < myDist) {
        violations.push({
          id: uid(),
          type: "unload_blocked",
          cargoId: cargo.id,
          x: p.x,
          y: p.y,
          message: `先卸货 ${cargo.name}(#${cargo.destOrder}) 被 ${oCargo.name}(#${oCargo.destOrder}) 挡住`,
          penalty: PENALTIES.unload_blocked,
          at: nowMs,
        });
        break;
      }
    }
  });
  return violations;
}

export function checkTempRise(
  level: Level,
  placed: PlacedCargo[],
  timeConsumedSec: number,
  doorOpen: boolean,
  nowMs: number
): Violation[] {
  if (!doorOpen) return [];
  const violations: Violation[] = [];
  placed.forEach((p) => {
    const c = getCargoById(level, p.cargoId);
    if (!c) return;
    const limit = TEMP_RISE_LIMIT_SEC[c.zone];
    if (timeConsumedSec > limit) {
      violations.push({
        id: uid(),
        type: "temp_rise",
        cargoId: c.id,
        x: p.x,
        y: p.y,
        message: `${c.name} 温层 ${c.zone} 开门超时 ${timeConsumedSec - Math.floor(limit)}s，货物升温`,
        penalty: PENALTIES.temp_rise,
        at: nowMs,
      });
    }
  });
  return violations;
}

export interface FinalResult {
  won: boolean;
  reason?: string;
  violations: Violation[];
  score: number;
  baseScore: number;
  timeBonus: number;
  penaltyTotal: number;
}

export function finalize(
  level: Level,
  placed: PlacedCargo[],
  runtimeViolations: Violation[],
  timeLeftSec: number,
  timedOut: boolean,
  nowMs: number,
  doorOpen: boolean,
  elapsedSec: number
): FinalResult {
  const unloadV = checkUnloadBlocked(level, placed, nowMs);
  const tempV = checkTempRise(level, placed, elapsedSec, doorOpen, nowMs);
  const allV = [...runtimeViolations, ...unloadV, ...tempV];
  const placedCount = placed.length;
  const totalCount = level.cargos.length;
  const baseScore = placedCount === totalCount ? 100 : Math.round((placedCount / totalCount) * 80);
  const penaltyTotal = allV.reduce((s, v) => s + v.penalty, 0);
  const timeBonus = timedOut ? 0 : Math.max(0, Math.round(timeLeftSec / 2));
  const score = Math.max(0, baseScore + timeBonus - penaltyTotal);

  if (timedOut) {
    return {
      won: false,
      reason: "超时未完成",
      violations: allV,
      score,
      baseScore,
      timeBonus,
      penaltyTotal,
    };
  }

  if (placedCount < totalCount) {
    return {
      won: false,
      reason: `还有 ${totalCount - placedCount} 件未装车`,
      violations: allV,
      score,
      baseScore,
      timeBonus,
      penaltyTotal,
    };
  }

  const criticalTypes: Violation["type"][] = ["unload_blocked", "zone_mismatch", "temp_rise"];
  const criticalCount = allV.filter((v) => criticalTypes.includes(v.type)).length;
  if (criticalCount >= MAX_VIOLATIONS_TO_FAIL) {
    return {
      won: false,
      reason: `严重违规累计 ${criticalCount} 次，判定失败`,
      violations: allV,
      score,
      baseScore,
      timeBonus,
      penaltyTotal,
    };
  }

  if (tempV.length > 0) {
    const frozenDamaged = tempV.filter((v) => {
      const c = getCargoById(level, v.cargoId ?? "");
      return c?.zone === "frozen";
    }).length;
    if (frozenDamaged >= 2) {
      return {
        won: false,
        reason: `冻品升温判损 ${frozenDamaged} 件，判定失败`,
        violations: allV,
        score,
        baseScore,
        timeBonus,
        penaltyTotal,
      };
    }
  }

  return { won: true, violations: allV, score, baseScore, timeBonus, penaltyTotal };
}
