import type { GameState, Stats, LevelDef } from './types';

export function computeStats(state: GameState, level: LevelDef): Stats {
  const totalStations = level.stations.length;
  const servedStops = new Set<string>();
  state.vehicles.forEach((v) => {
    const route = state.routes.find((r) => r.id === v.routeId);
    if (!route) return;
    const path = v.useAltPath && route.altStops ? route.altStops : route.stops;
    for (let i = 0; i <= v.stopIndex; i++) {
      if (path[i]) servedStops.add(path[i]);
    }
  });
  const coverage = totalStations > 0 ? servedStops.size / totalStations : 0;

  const complaintRatio = state.stats.complaints / Math.max(1, level.maxComplaints);
  const punctuality = Math.max(0, 1 - complaintRatio);

  const avgDelay = state.vehicles.length
    ? state.vehicles.reduce((s, v) => s + v.totalDelayMin, 0) / state.vehicles.length
    : 0;
  const delayRatio = Math.min(1, avgDelay / Math.max(1, level.maxDelayMin));
  const adjustedPunctuality = Math.max(0, punctuality - delayRatio * 0.5);

  const totalLoad = state.vehicles.reduce((s, v) => s + v.load, 0);
  const totalCap = state.vehicles.reduce((s, v) => s + v.capacity, 0) || 1;
  const loadFactor = totalLoad / totalCap;

  const arrivals: Record<string, number[]> = {};
  state.actions.forEach((a) => {
    if (a.type === 'arrive' && a.payload) {
      const { stopId, routeId, minute } = a.payload;
      const key = `${routeId}:${stopId}`;
      if (!arrivals[key]) arrivals[key] = [];
      arrivals[key].push(minute);
    }
  });
  let cvSum = 0;
  let cvCount = 0;
  Object.values(arrivals).forEach((times) => {
    if (times.length < 2) return;
    times.sort((a, b) => a - b);
    const intervals: number[] = [];
    for (let i = 1; i < times.length; i++) intervals.push(times[i] - times[i - 1]);
    const mean = intervals.reduce((s, v) => s + v, 0) / intervals.length;
    if (mean === 0) return;
    const variance = intervals.reduce((s, v) => s + (v - mean) ** 2, 0) / intervals.length;
    const std = Math.sqrt(variance);
    cvSum += std / mean;
    cvCount++;
  });
  const intervalCV = cvCount > 0 ? cvSum / cvCount : 0;

  return {
    punctuality: adjustedPunctuality,
    intervalCV,
    complaints: state.stats.complaints,
    loadFactor,
    coverage,
  };
}

export function computeScore(stats: Stats, level: LevelDef, failures: string[]): number {
  if (failures.length > 0) return 0;
  const punctualityScore = stats.punctuality * 30;
  const intervalScore = Math.max(0, 20 * (1 - Math.min(1, stats.intervalCV)));
  const complaintScore = Math.max(0, 25 * (1 - stats.complaints / Math.max(1, level.maxComplaints)));
  const loadScore = 15 * Math.min(1, stats.loadFactor * 1.5);
  const coverageScore = 10 * stats.coverage;
  return Math.round(punctualityScore + intervalScore + complaintScore + loadScore + coverageScore);
}

export function checkFailures(state: GameState, level: LevelDef): string[] {
  const f: string[] = [];
  if (state.stats.complaints > level.maxComplaints) {
    f.push(`投诉超过阈值（${state.stats.complaints} > ${level.maxComplaints}）`);
  }
  const maxDelay = state.vehicles.reduce((m, v) => Math.max(m, v.totalDelayMin), 0);
  if (maxDelay > level.maxDelayMin) {
    f.push(`单线路最大延误超过阈值（${maxDelay.toFixed(1)} > ${level.maxDelayMin} 分钟）`);
  }
  if (state.currentMinute >= level.durationMin) {
    const served = new Set<string>();
    state.vehicles.forEach((v) => {
      const route = state.routes.find((r) => r.id === v.routeId);
      if (!route) return;
      const path = v.useAltPath && route.altStops ? route.altStops : route.stops;
      for (let i = 0; i <= v.stopIndex; i++) if (path[i]) served.add(path[i]);
    });
    const coverage = served.size / level.stations.length;
    if (coverage < level.minCoverage) {
      f.push(`服务覆盖低于 ${(level.minCoverage * 100).toFixed(0)}%（仅 ${(coverage * 100).toFixed(0)}%）`);
    }
  }
  return f;
}
