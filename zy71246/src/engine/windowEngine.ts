import type { VisibilityWindow, ScheduleBlock, ErrorDetail } from '../types/mission';
import { getProbePositionAtTime } from '../utils/orbit';

export function detectWindowStart(
  windows: VisibilityWindow[],
  currentTime: number
): VisibilityWindow | null {
  return (
    windows.find(
      w => w.status === 'predicted' && w.startTime <= currentTime && w.endTime > currentTime
    ) || null
  );
}

export function detectWindowEnd(
  windows: VisibilityWindow[],
  currentTime: number
): VisibilityWindow | null {
  return (
    windows.find(
      w => w.status === 'active' && w.endTime <= currentTime
    ) || null
  );
}

export function detectMissedWindow(
  window: VisibilityWindow,
  scheduledBlocks: ScheduleBlock[],
  currentTime: number,
  previousBlock?: ScheduleBlock
): ErrorDetail | null {
  if (window.status !== 'predicted') return null;
  if (currentTime < window.endTime) return null;

  const hasTasks = scheduledBlocks.some(b => b.windowId === window.id);
  if (!hasTasks) return null;

  const executedTasks = scheduledBlocks.filter(
    b => b.windowId === window.id && b.startTime < window.endTime
  );

  if (executedTasks.length === 0) {
    return {
      errorType: 'window_missed',
      windowMissed: {
        windowId: window.id,
        reason: determineMissReason(window, scheduledBlocks, previousBlock),
        scheduledTasks: scheduledBlocks.filter(b => b.windowId === window.id).map(b => b.id),
      },
    };
  }

  return null;
}

function determineMissReason(
  window: VisibilityWindow,
  blocks: ScheduleBlock[],
  previousBlock?: ScheduleBlock
): 'wrong_station' | 'previous_overrun' | 'insufficient_slew_time' | 'prediction_error' {
  const windowBlocks = blocks.filter(b => b.windowId === window.id);
  if (windowBlocks.length === 0) return 'prediction_error';

  const firstBlock = windowBlocks[0];
  
  if (firstBlock.stationId !== window.groundStationId) {
    return 'wrong_station';
  }

  if (previousBlock && previousBlock.endTime > window.startTime) {
    return 'previous_overrun';
  }

  const otherBlocks = blocks
    .filter(b => b.stationId === window.groundStationId && b.windowId !== window.id)
    .sort((a, b) => a.endTime - b.startTime);

  if (otherBlocks.length > 0) {
    const lastOtherBlock = otherBlocks[otherBlocks.length - 1];
    if (lastOtherBlock.endTime > firstBlock.startTime - 30000) {
      return 'insufficient_slew_time';
    }
  }

  return 'prediction_error';
}

export function getCurrentWindow(
  windows: VisibilityWindow[],
  currentTime: number
): VisibilityWindow | null {
  return windows.find(w => w.status === 'active') || null;
}

export function getNextWindow(
  windows: VisibilityWindow[],
  currentTime: number
): VisibilityWindow | null {
  const futureWindows = windows
    .filter(w => w.startTime > currentTime && w.status === 'predicted')
    .sort((a, b) => a.startTime - b.startTime);
  
  return futureWindows[0] || null;
}

export function getTimeUntilNextWindow(
  windows: VisibilityWindow[],
  currentTime: number
): number {
  const next = getNextWindow(windows, currentTime);
  return next ? next.startTime - currentTime : -1;
}

export function getWindowProgress(
  window: VisibilityWindow,
  currentTime: number
): number {
  if (currentTime < window.startTime) return 0;
  if (currentTime > window.endTime) return 1;
  
  const total = window.endTime - window.startTime;
  const elapsed = currentTime - window.startTime;
  return elapsed / total;
}

export function getRemainingTimeInWindow(
  window: VisibilityWindow,
  currentTime: number
): number {
  if (currentTime >= window.endTime) return 0;
  return window.endTime - currentTime;
}

export function predictWindows(
  orbitParams: { semiMajorAxis: number; eccentricity: number; inclination: number; raan: number },
  stationLocation: { lat: number; lng: number },
  startTime: number,
  duration: number,
  minElevation: number = 5
): Array<{ startTime: number; endTime: number; maxElevation: number }> {
  const windows: Array<{ startTime: number; endTime: number; maxElevation: number }> = [];
  const step = 5000;
  let currentTime = startTime;
  const endTime = startTime + duration;

  while (currentTime < endTime) {
    const pos = getProbePositionAtTime(orbitParams, currentTime, startTime);
    
    const elevation = calculateElevation(pos, stationLocation);
    
    if (elevation >= minElevation) {
      let windowStart = currentTime;
      let maxElev = elevation;
      
      while (currentTime < endTime) {
        currentTime += step;
        const pos2 = getProbePositionAtTime(orbitParams, currentTime, startTime);
        const elev2 = calculateElevation(pos2, stationLocation);
        maxElev = Math.max(maxElev, elev2);
        
        if (elev2 < minElevation) break;
      }
      
      windows.push({
        startTime: windowStart,
        endTime: currentTime,
        maxElevation: maxElev,
      });
    }
    
    currentTime += step;
  }
  
  return windows;
}

function calculateElevation(
  probePos: { x: number; y: number; z: number },
  station: { lat: number; lng: number }
): number {
  const earthRadius = 6371;
  const latRad = station.lat * (Math.PI / 180);
  const lngRad = station.lng * (Math.PI / 180);
  
  const stationX = earthRadius * Math.cos(latRad) * Math.cos(lngRad);
  const stationY = earthRadius * Math.cos(latRad) * Math.sin(lngRad);
  const stationZ = earthRadius * Math.sin(latRad);
  
  const dx = probePos.x - stationX;
  const dy = probePos.y - stationY;
  const dz = probePos.z - stationZ;
  const range = Math.sqrt(dx * dx + dy * dy + dz * dz);
  
  const upX = Math.cos(latRad) * Math.cos(lngRad);
  const upY = Math.cos(latRad) * Math.sin(lngRad);
  const upZ = Math.sin(latRad);
  
  const dot = dx * upX + dy * upY + dz * upZ;
  return Math.asin(dot / range) * (180 / Math.PI);
}
