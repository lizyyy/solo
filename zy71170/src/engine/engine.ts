import type {
  Level,
  Broadcast,
  Building,
  CoverageReport,
  ComplaintReport,
  ScoreReport,
  Failure,
} from "./types";

export function distance(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

export function pointInBuilding(bx: number, by: number, b: Building): boolean {
  return bx >= b.x && bx <= b.x + b.w && by >= b.y && by <= b.y + b.h;
}

export function broadcastCoversBuilding(broadcast: Broadcast, building: Building): boolean {
  const cx = building.x + building.w / 2;
  const cy = building.y + building.h / 2;
  return distance(broadcast.x, broadcast.y, cx, cy) <= broadcast.radius;
}

export function computeCoverage(
  level: Level,
  broadcasts: Broadcast[]
): CoverageReport {
  let covered = 0;
  const uncovered: string[] = [];
  const total = level.buildings.reduce((sum, b) => sum + b.population, 0);
  for (const b of level.buildings) {
    const coveredBy = broadcasts.some((bc) => broadcastCoversBuilding(bc, b));
    if (coveredBy) covered += b.population;
    else uncovered.push(b.name);
  }
  return {
    totalPopulation: total,
    coveredPopulation: covered,
    coverageRatio: total === 0 ? 1 : covered / total,
    uncoveredBuildings: uncovered,
  };
}

export function noiseAtPoint(
  broadcasts: Broadcast[],
  px: number,
  py: number
): number {
  let noise = 0;
  for (const bc of broadcasts) {
    const d = distance(bc.x, bc.y, px, py);
    if (d <= bc.radius) {
      const factor = 1 - d / Math.max(bc.radius, 1);
      noise += 0.3 + 0.7 * factor;
    }
  }
  return noise;
}

export function computeComplaints(
  level: Level,
  broadcasts: Broadcast[]
): ComplaintReport {
  const perZone = level.noisyZones.map((z) => {
    const n = noiseAtPoint(broadcasts, z.x, z.y);
    return { zoneId: z.id, noise: n, overThreshold: n > z.threshold };
  });
  const count = perZone.filter((p) => p.overThreshold).length;
  return { count, perZone };
}

export function broadcastCost(level: Level, bc: Broadcast): number {
  return level.unitCost + Math.round(bc.radius * level.radiusCostPerPx);
}

export function totalCost(level: Level, broadcasts: Broadcast[]): number {
  return broadcasts.reduce((sum, bc) => sum + broadcastCost(level, bc), 0);
}

export function computeScore(
  level: Level,
  broadcasts: Broadcast[]
): ScoreReport {
  const coverage = computeCoverage(level, broadcasts);
  const complaints = computeComplaints(level, broadcasts);
  const cost = totalCost(level, broadcasts);

  const coverageScore = Math.round(coverage.coverageRatio * 60);
  const complaintPenalty = complaints.count * 15;
  const budgetOver = Math.max(0, cost - level.budget);
  const budgetPenalty = Math.round(budgetOver / Math.max(level.unitCost, 1)) * 5;

  const score = Math.max(0, coverageScore - complaintPenalty - budgetPenalty);

  let success = true;
  let failure: Failure | undefined;
  if (coverage.coverageRatio < level.minCoverage) {
    success = false;
    failure = {
      type: "coverage",
      reason: `覆盖率 ${(coverage.coverageRatio * 100).toFixed(
        0
      )}% 低于目标 ${(level.minCoverage * 100).toFixed(0)}%`,
    };
  } else if (complaints.count > level.maxComplaints) {
    success = false;
    failure = {
      type: "complaints",
      reason: `噪声投诉 ${complaints.count} 起，超过可容忍上限 ${level.maxComplaints} 起`,
    };
  } else if (cost > level.budget) {
    success = false;
    failure = {
      type: "budget",
      reason: `花费 ${cost} 超过预算 ${level.budget}`,
    };
  }

  let stars = 0;
  if (success) {
    stars = 1;
    if (coverage.coverageRatio >= Math.min(1, level.minCoverage + 0.15)) stars = 2;
    if (
      coverage.coverageRatio >= Math.min(1, level.minCoverage + 0.25) &&
      complaints.count === 0 &&
      cost <= level.budget * 0.8
    )
      stars = 3;
  }

  return {
    score,
    stars,
    coverageScore,
    complaintPenalty,
    budgetPenalty,
    success,
    failure,
  };
}
