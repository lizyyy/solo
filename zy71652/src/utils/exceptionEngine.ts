import type {
  Location,
  RouteStop,
  OrderItem,
  PathException,
  ExceptionType,
} from "@/types";
import { calcDistance } from "./pathEngine";

export function detectDuplicateLocations(
  locations: Location[],
  routeId: string
): PathException[] {
  const exceptions: PathException[] = [];
  const coordMap = new Map<string, Location[]>();

  for (const loc of locations) {
    const key = `${loc.x},${loc.y}`;
    const arr = coordMap.get(key) ?? [];
    arr.push(loc);
    coordMap.set(key, arr);
  }

  let idx = 0;
  for (const [key, group] of coordMap) {
    if (group.length > 1) {
      const sorted = [...group].sort((a, b) => a.code.localeCompare(b.code));
      for (let i = 0; i < sorted.length - 1; i++) {
        for (let j = i + 1; j < sorted.length; j++) {
          exceptions.push({
            id: `${routeId}-duplicate_location-${idx}`,
            routeId,
            type: "duplicate_location",
            message: `库位 ${sorted[i].code} 和 ${sorted[j].code} 坐标相同 (${sorted[i].x},${sorted[i].y})，可能导致拣货员遗漏`,
            detail: JSON.stringify({
              duplicateCodes: [sorted[i].code, sorted[j].code],
              coordinate: { x: sorted[i].x, y: sorted[i].y },
              locationIds: [sorted[i].id, sorted[j].id],
            }),
            resolved: false,
            createdAt: Date.now(),
          });
          idx++;
        }
      }
    }
  }

  return exceptions;
}

export function detectColdChainTimeouts(
  stops: RouteStop[],
  orderItems: OrderItem[],
  locations: Location[],
  routeId: string,
  pickSpeedMinPerUnit: number = 0.5
): PathException[] {
  const exceptions: PathException[] = [];
  const locMap = new Map(locations.map((l) => [l.id, l]));
  const itemMap = new Map(orderItems.map((i) => [i.id, i]));
  const sortedStops = [...stops].sort((a, b) => a.sequence - b.sequence);

  let elapsed = 0;
  const start = { x: 0, y: 0 };
  let prev = start;

  for (const stop of sortedStops) {
    const loc = locMap.get(stop.locationId);
    if (loc) {
      elapsed += calcDistance(prev, loc) * pickSpeedMinPerUnit;
    }

    const item = itemMap.get(stop.orderItemId);
    if (item && item.coldChain) {
      const actual = Math.round(elapsed * 10) / 10;
      const limit = item.coldChainMaxMin;
      if (actual > limit) {
        exceptions.push({
          id: `${routeId}-cold_chain_timeout-${stop.sequence}`,
          routeId,
          type: "cold_chain_timeout",
          message: `冷链商品 ${item.sku} 预计耗时 ${actual}分钟，超过时限 ${limit}分钟`,
          detail: JSON.stringify({
            sku: item.sku,
            location: loc?.code,
            actualMinutes: actual,
            limitMinutes: limit,
          }),
          resolved: false,
          createdAt: Date.now(),
        });
      }
    }

    if (loc) prev = { x: loc.x, y: loc.y };
    elapsed += 0.3;
  }

  return exceptions;
}

export function detectPathBacktrack(
  stops: RouteStop[],
  locations: Location[],
  routeId: string,
  threshold: number = 3
): PathException[] {
  const exceptions: PathException[] = [];
  const locMap = new Map(locations.map((l) => [l.id, l]));
  const sortedStops = [...stops].sort((a, b) => a.sequence - b.sequence);

  const vectors: { dx: number; dy: number; locCode: string }[] = [];
  for (let i = 0; i < sortedStops.length - 1; i++) {
    const from = locMap.get(sortedStops[i].locationId);
    const to = locMap.get(sortedStops[i + 1].locationId);
    if (from && to) {
      vectors.push({
        dx: to.x - from.x,
        dy: to.y - from.y,
        locCode: to.code,
      });
    }
  }

  let consecutiveBacktracks = 0;
  let backtrackCount = 0;

  for (let i = 1; i < vectors.length; i++) {
    const prev = vectors[i - 1];
    const curr = vectors[i];
    const dot = prev.dx * curr.dx + prev.dy * curr.dy;

    if (dot < 0) {
      consecutiveBacktracks++;
      backtrackCount++;

      if (consecutiveBacktracks >= threshold) {
        const stop1 = sortedStops[i - 1];
        const stop2 = sortedStops[i];
        const stop3 = sortedStops[i + 1];
        const loc1 = locMap.get(stop1?.locationId)?.code ?? "";
        const loc2 = locMap.get(stop2?.locationId)?.code ?? "";
        const loc3 = locMap.get(stop3?.locationId)?.code ?? "";

        exceptions.push({
          id: `${routeId}-path_backtrack-${i}`,
          routeId,
          type: "path_backtrack",
          message: `路径在库位 ${loc1}→${loc2}→${loc3} 处出现第 ${backtrackCount} 次回头，建议重新排列`,
          detail: JSON.stringify({
            backtrackIndex: i,
            consecutiveCount: consecutiveBacktracks,
            totalBacktracks: backtrackCount,
            locations: [loc1, loc2, loc3],
          }),
          resolved: false,
          createdAt: Date.now(),
        });
      }
    } else {
      consecutiveBacktracks = 0;
    }
  }

  return exceptions;
}

export function detectAllExceptions(
  locations: Location[],
  stops: RouteStop[],
  orderItems: OrderItem[],
  routeId: string,
  pickSpeedMinPerUnit: number = 0.5
): PathException[] {
  const dupes = detectDuplicateLocations(locations, routeId);
  const cold = detectColdChainTimeouts(
    stops,
    orderItems,
    locations,
    routeId,
    pickSpeedMinPerUnit
  );
  const backtrack = detectPathBacktrack(stops, locations, routeId);
  return [...dupes, ...cold, ...backtrack];
}
