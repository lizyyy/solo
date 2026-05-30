import type { Location, OrderItem, RouteStop, ColdChainStatus } from "@/types";

export function calcDistance(
  a: { x: number; y: number },
  b: { x: number; y: number }
): number {
  return Math.sqrt(Math.pow(b.x - a.x, 2) + Math.pow(b.y - a.y, 2));
}

export function greedyNearestNeighbor(
  locations: Location[],
  start: { x: number; y: number } = { x: 0, y: 0 }
): string[] {
  const unvisited = new Map(locations.map((l) => [l.id, l]));
  const result: string[] = [];
  let current = start;

  while (unvisited.size > 0) {
    let bestId = "";
    let bestDist = Infinity;
    let bestCode = "";

    for (const [id, loc] of unvisited) {
      const dist = calcDistance(current, loc);
      if (dist < bestDist || (dist === bestDist && loc.code < bestCode)) {
        bestDist = dist;
        bestId = id;
        bestCode = loc.code;
      }
    }

    result.push(bestId);
    const bestLoc = unvisited.get(bestId)!;
    current = { x: bestLoc.x, y: bestLoc.y };
    unvisited.delete(bestId);
  }

  return result;
}

function calcTotalDistance(
  order: string[],
  locationMap: Map<string, Location>
): number {
  if (order.length < 2) return 0;
  let dist = 0;
  const start = { x: 0, y: 0 };
  let prev = start;
  for (const id of order) {
    const loc = locationMap.get(id)!;
    dist += calcDistance(prev, loc);
    prev = loc;
  }
  dist += calcDistance(prev, start);
  return dist;
}

export function twoOptOptimize(
  locationIds: string[],
  locationMap: Map<string, Location>
): string[] {
  let best = [...locationIds];
  let bestDist = calcTotalDistance(best, locationMap);
  const n = best.length;
  let improved = true;
  let iterations = 0;
  const maxIter = 100;

  while (improved && iterations < maxIter) {
    improved = false;
    iterations++;
    for (let i = 0; i < n - 1; i++) {
      for (let j = i + 1; j < n; j++) {
        const candidate = [
          ...best.slice(0, i),
          ...best.slice(i, j + 1).reverse(),
          ...best.slice(j + 1),
        ];
        const candidateDist = calcTotalDistance(candidate, locationMap);
        if (candidateDist < bestDist) {
          best = candidate;
          bestDist = candidateDist;
          improved = true;
        }
      }
    }
  }

  return best;
}

export function calculateRouteMetrics(
  locationIds: string[],
  locationMap: Map<string, Location>,
  pickSpeedMinPerUnit: number = 0.5
): { totalDistance: number; estimatedMinutes: number } {
  const totalDistance = calcTotalDistance(locationIds, locationMap);
  const estimatedMinutes =
    totalDistance * pickSpeedMinPerUnit + locationIds.length * 0.3;
  return { totalDistance, estimatedMinutes };
}

export function checkColdChainStatus(
  locationIds: string[],
  locationMap: Map<string, Location>,
  orderItems: OrderItem[],
  pickSpeedMinPerUnit: number = 0.5
): Map<string, ColdChainStatus> {
  const result = new Map<string, ColdChainStatus>();
  const itemMap = new Map(orderItems.map((i) => [i.locationId, i]));

  let elapsed = 0;
  const start = { x: 0, y: 0 };
  let prev = start;

  for (const locId of locationIds) {
    const loc = locationMap.get(locId);
    if (!loc) continue;

    const dist = calcDistance(prev, loc);
    elapsed += dist * pickSpeedMinPerUnit;

    const item = itemMap.get(locId);
    if (item && item.coldChain) {
      const ratio = elapsed / item.coldChainMaxMin;
      let status: ColdChainStatus;
      if (ratio >= 1) {
        status = "timeout";
      } else if (ratio >= 0.8) {
        status = "warning";
      } else {
        status = "ok";
      }
      result.set(item.id, status);
    }

    prev = loc;
    elapsed += 0.3;
  }

  return result;
}

export function findBestInsertion(
  newLocationIds: string[],
  existingLocationIds: string[],
  locationMap: Map<string, Location>
): {
  insertIndex: number;
  insertedIds: string[];
  totalDistanceDelta: number;
} {
  if (existingLocationIds.length === 0) {
    return {
      insertIndex: 0,
      insertedIds: newLocationIds,
      totalDistanceDelta: calcTotalDistance(newLocationIds, locationMap),
    };
  }

  let bestIdx = 0;
  let bestDelta = Infinity;

  const start = { x: 0, y: 0 };

  for (let i = 0; i <= existingLocationIds.length; i++) {
    const prevLoc =
      i === 0
        ? start
        : locationMap.get(existingLocationIds[i - 1])!;
    const nextLoc =
      i === existingLocationIds.length
        ? start
        : locationMap.get(existingLocationIds[i])!;

    const originalGap = calcDistance(prevLoc, nextLoc);

    let insertDist = 0;
    let prevInsert = prevLoc;
    for (const id of newLocationIds) {
      const loc = locationMap.get(id)!;
      insertDist += calcDistance(prevInsert, loc);
      prevInsert = loc;
    }
    insertDist += calcDistance(prevInsert, nextLoc);

    const delta = insertDist - originalGap;

    if (delta < bestDelta) {
      bestDelta = delta;
      bestIdx = i;
    }
  }

  return {
    insertIndex: bestIdx,
    insertedIds: newLocationIds,
    totalDistanceDelta: bestDelta,
  };
}

export function buildRouteStops(
  routeId: string,
  locationIds: string[],
  orderItems: OrderItem[],
  locationMap: Map<string, Location>,
  insertedIds: Set<string> = new Set(),
  pickSpeedMinPerUnit: number = 0.5
): RouteStop[] {
  const stops: RouteStop[] = [];
  const coldStatuses = checkColdChainStatus(
    locationIds,
    locationMap,
    orderItems,
    pickSpeedMinPerUnit
  );
  const itemByLoc = new Map(orderItems.map((i) => [i.locationId, i]));

  locationIds.forEach((locId, idx) => {
    const item = itemByLoc.get(locId);
    if (item) {
      stops.push({
        id: `${routeId}-stop-${idx}`,
        routeId,
        orderItemId: item.id,
        locationId: locId,
        sequence: idx + 1,
        isInsertion: insertedIds.has(locId),
        coldChainStatus: coldStatuses.get(item.id) ?? "ok",
      });
    }
  });

  return stops;
}
