import type { GameState, LevelDef, Vehicle, EventLog, RouteDef } from './types';

const SEGMENT_BASE_MIN = 1.2;
const STOP_WAIT_MIN = 0.4;
const ALT_DETOUR_MIN = 0.8;
const WAIT_COMPLAINT_THRESHOLD = 10;

function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2);
}

export function makeInitialState(level: LevelDef): GameState {
  const waiting: Record<string, number> = {};
  level.stations.forEach((s) => (waiting[s.id] = 0));
  const vehicles: Vehicle[] = [];
  for (let i = 0; i < level.initialFleet; i++) {
    const route = level.routes[i % level.routes.length];
    vehicles.push({
      id: `V${i + 1}`,
      routeId: route.id,
      stopIndex: 0,
      progress: 0,
      load: 0,
      capacity: 30,
      status: 'idle',
      delayMin: 0,
      useAltPath: false,
      nextDispatchMin: i * Math.max(1, Math.floor(route.headwayMin / 2)),
      totalDelayMin: 0,
      skippedStops: new Set(),
    });
  }
  return {
    phase: 'ready',
    levelId: level.id,
    level,
    currentMinute: 0,
    speed: 1,
    routes: level.routes,
    vehicles,
    waitingPassengers: waiting,
    closures: level.closures.slice(),
    logs: [
      {
        minute: 0,
        level: 'info',
        message: `${level.name} 开始运营，时长 ${level.durationMin} 分钟。`,
      },
    ],
    stats: { punctuality: 1, intervalCV: 0, complaints: 0, loadFactor: 0, coverage: 0 },
    failures: [],
    score: 0,
    history: [],
    historyIndex: 0,
    actions: [],
  };
}

function pushLog(state: GameState, log: EventLog) {
  state.logs.push(log);
  if (state.logs.length > 500) state.logs.shift();
}

function currentStopIds(vehicle: Vehicle, route: RouteDef): string[] {
  return vehicle.useAltPath && route.altStops ? route.altStops : route.stops;
}

function isSegmentClosed(state: GameState, routeId: string, from: string, to: string): boolean {
  const m = state.currentMinute;
  return state.closures.some(
    (c) =>
      (!c.routeId || c.routeId === routeId) &&
      ((c.fromStop === from && c.toStop === to) || (c.fromStop === to && c.toStop === from)) &&
      m >= c.startMinute &&
      m <= c.endMinute
  );
}

function stationPos(level: LevelDef, id: string) {
  const s = level.stations.find((x) => x.id === id);
  return s ? { x: s.x, y: s.y } : null;
}

export function tick(state: GameState, dtMin: number): GameState {
  if (state.phase !== 'running' || !state.level) return state;
  const level = state.level;
  const newMinute = state.currentMinute + dtMin;

  level.passengerEvents.forEach((ev) => {
    if (
      ev.minute >= state.currentMinute &&
      ev.minute < newMinute &&
      state.waitingPassengers[ev.stopId] !== undefined
    ) {
      state.waitingPassengers[ev.stopId] += ev.count;
      pushLog(state, {
        minute: newMinute,
        level: 'info',
        message: `到达客流高峰：站点 ${ev.stopId} 新增 ${ev.count} 名乘客等候。`,
      });
    }
  });

  state.closures.forEach((c) => {
    if (
      c.startMinute >= state.currentMinute &&
      c.startMinute < newMinute
    ) {
      pushLog(state, {
        minute: newMinute,
        level: 'warn',
        message: `施工封路开始：${c.fromStop} → ${c.toStop}，持续至第 ${c.endMinute} 分钟。`,
      });
    }
    if (c.endMinute >= state.currentMinute && c.endMinute < newMinute) {
      pushLog(state, {
        minute: newMinute,
        level: 'info',
        message: `施工封路结束：${c.fromStop} → ${c.toStop} 恢复通行。`,
      });
    }
  });

  state.vehicles.forEach((v) => {
    const route = state.routes.find((r) => r.id === v.routeId);
    if (!route) return;
    const path = currentStopIds(v, route);

    if (v.status === 'idle') {
      if (newMinute >= v.nextDispatchMin) {
        v.status = 'stopped';
        v.stopIndex = 0;
        v.progress = 0;
        pushLog(state, {
          minute: newMinute,
          level: 'info',
          message: `${v.id} 从车库发车投入线路 ${route.name}。`,
        });
      }
      return;
    }

    if (v.status === 'stopped') {
      const stopId = path[v.stopIndex];
      const boarding = Math.min(v.capacity - v.load, state.waitingPassengers[stopId] || 0);
      v.load += boarding;
      state.waitingPassengers[stopId] = (state.waitingPassengers[stopId] || 0) - boarding;
      if (state.waitingPassengers[stopId] < 0) state.waitingPassengers[stopId] = 0;

      if (boarding > 0) {
        pushLog(state, {
          minute: newMinute,
          level: 'info',
          message: `${v.id} 在 ${stopId} 上客 ${boarding} 人，当前载客 ${v.load}/${v.capacity}。`,
        });
      }

      if (v.stopIndex >= path.length - 1) {
        v.status = 'finished';
        pushLog(state, {
          minute: newMinute,
          level: 'info',
          message: `${v.id} 完成线路 ${route.name} 全程运营。`,
        });
        return;
      }

      const nextStopId = path[v.stopIndex + 1];
      if (isSegmentClosed(state, route.id, stopId, nextStopId)) {
        if (route.altStops && !v.useAltPath) {
          v.useAltPath = true;
          v.totalDelayMin += ALT_DETOUR_MIN;
          pushLog(state, {
            minute: newMinute,
            level: 'warn',
            message: `${v.id} 遇封路，切换至备用线路，预计延误 ${ALT_DETOUR_MIN} 分钟。`,
          });
        } else {
          v.totalDelayMin += 0.5;
          pushLog(state, {
            minute: newMinute,
            level: 'error',
            message: `${v.id} 在 ${stopId} → ${nextStopId} 遇封路且无备用线路，严重延误。`,
          });
        }
        return;
      }

      v.status = 'moving';
      return;
    }

    if (v.status === 'moving') {
      const from = path[v.stopIndex];
      const to = path[v.stopIndex + 1];
      if (!from || !to) {
        v.status = 'finished';
        return;
      }
      const a = stationPos(level, from);
      const b = stationPos(level, to);
      if (!a || !b) return;
      const segLen = dist(a.x, a.y, b.x, b.y);
      const segDuration = SEGMENT_BASE_MIN + segLen / 300;
      v.progress += dtMin / segDuration;
      if (v.progress >= 1) {
        v.progress = 0;
        v.stopIndex += 1;
        v.status = 'stopped';
        state.actions.push({
          minute: newMinute,
          type: 'arrive',
          payload: { stopId: path[v.stopIndex], routeId: route.id, minute: newMinute },
        });
      }
      return;
    }
  });

  Object.entries(state.waitingPassengers).forEach(([stopId, count]) => {
    if (count <= 0) return;
    const nearestArrival = state.vehicles
      .filter((v) => {
        const route = state.routes.find((r) => r.id === v.routeId);
        if (!route) return false;
        const path = currentStopIds(v, route);
        return path.includes(stopId) && !v.skippedStops.has(stopId);
      })
      .map((v) => {
        const route = state.routes.find((r) => r.id === v.routeId)!;
        const path = currentStopIds(v, route);
        const idx = path.indexOf(stopId);
        if (idx <= v.stopIndex) return 999;
        return (idx - v.stopIndex) * (SEGMENT_BASE_MIN + 0.5);
      })
      .reduce((m, x) => Math.min(m, x), 999);
    if (nearestArrival > WAIT_COMPLAINT_THRESHOLD) {
      state.stats.complaints += 1;
      pushLog(state, {
        minute: newMinute,
        level: 'error',
        message: `站点 ${stopId} 乘客等待超过 ${WAIT_COMPLAINT_THRESHOLD} 分钟，产生投诉（累计 ${state.stats.complaints}）。`,
      });
      state.waitingPassengers[stopId] = Math.max(0, count - 1);
    }
  });

  state.currentMinute = newMinute;
  return state;
}

export function dispatchVehicle(state: GameState, vehicleId: string, routeId: string): GameState {
  const v = state.vehicles.find((x) => x.id === vehicleId);
  if (!v) return state;
  if (v.status !== 'finished' && v.status !== 'idle') return state;
  v.routeId = routeId;
  v.status = 'idle';
  v.stopIndex = 0;
  v.progress = 0;
  v.useAltPath = false;
  v.skippedStops = new Set();
  v.nextDispatchMin = state.currentMinute;
  const route = state.routes.find((r) => r.id === routeId);
  pushLog(state, {
    minute: state.currentMinute,
    level: 'info',
    message: `调度：${vehicleId} 重新投入线路 ${route?.name || routeId}。`,
  });
  state.actions.push({
    minute: state.currentMinute,
    type: 'dispatch',
    payload: { vehicleId, routeId },
  });
  return state;
}

export function skipStop(state: GameState, vehicleId: string, stopId: string): GameState {
  const v = state.vehicles.find((x) => x.id === vehicleId);
  if (!v) return state;
  v.skippedStops.add(stopId);
  state.stats.complaints += 1;
  pushLog(state, {
    minute: state.currentMinute,
    level: 'warn',
    message: `${vehicleId} 跳站 ${stopId}，该站乘客投诉 +1（累计 ${state.stats.complaints}）。`,
  });
  state.actions.push({
    minute: state.currentMinute,
    type: 'skip',
    payload: { vehicleId, stopId },
  });
  return state;
}

export function toggleAltPath(state: GameState, routeId: string, enable: boolean): GameState {
  state.vehicles.forEach((v) => {
    if (v.routeId === routeId && (v.status === 'moving' || v.status === 'stopped')) {
      v.useAltPath = enable;
    }
  });
  const route = state.routes.find((r) => r.id === routeId);
  pushLog(state, {
    minute: state.currentMinute,
    level: 'warn',
    message: `线路 ${route?.name || routeId} ${enable ? '切换' : '取消'}备用路径。`,
  });
  state.actions.push({
    minute: state.currentMinute,
    type: 'altPath',
    payload: { routeId, enable },
  });
  return state;
}

export function setHeadway(state: GameState, routeId: string, headwayMin: number): GameState {
  const route = state.routes.find((r) => r.id === routeId);
  if (route) route.headwayMin = Math.max(1, Math.round(headwayMin));
  pushLog(state, {
    minute: state.currentMinute,
    level: 'info',
    message: `线路 ${route?.name || routeId} 发车间隔调整为 ${route?.headwayMin} 分钟。`,
  });
  return state;
}
