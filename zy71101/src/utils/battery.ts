import { Point3D, Waypoint, BatteryPoint, unitConversion } from '@/types';

export interface BatteryConfig {
  baseConsumptionPerMeter: number;
  climbConsumptionPerMeter: number;
  descendConsumptionPerMeter: number;
  hoverConsumptionPerSecond: number;
  safetyMargin: number;
}

const DEFAULT_CONFIG: BatteryConfig = {
  baseConsumptionPerMeter: 0.05,
  climbConsumptionPerMeter: 0.15,
  descendConsumptionPerMeter: 0.02,
  hoverConsumptionPerSecond: 0.03,
  safetyMargin: 1.2
};

const toMeters = (point: Point3D): number => {
  return unitConversion.toMeters(point.y, point.unit);
};

const distance3D = (a: Point3D, b: Point3D): number => {
  const dx = b.x - a.x;
  const dy = toMeters(b) - toMeters(a);
  const dz = b.z - a.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
};

export const calculateSegmentConsumption = (
  start: Point3D,
  end: Point3D,
  speed: number,
  config: BatteryConfig = DEFAULT_CONFIG
): { distance: number; time: number; consumption: number } => {
  const distance = distance3D(start, end);
  const time = distance / speed;
  const heightChange = toMeters(end) - toMeters(start);
  
  let consumption = distance * config.baseConsumptionPerMeter;
  
  if (heightChange > 0) {
    consumption += heightChange * config.climbConsumptionPerMeter;
  } else if (heightChange < 0) {
    consumption += Math.abs(heightChange) * config.descendConsumptionPerMeter;
  }
  
  return { distance, time, consumption };
};

export const calculateFullMissionConsumption = (
  waypoints: Waypoint[],
  config: BatteryConfig = DEFAULT_CONFIG
): {
  totalDistance: number;
  totalTime: number;
  totalConsumption: number;
  curve: BatteryPoint[];
  returnBatteryRequired: number;
  criticalPoints: number[];
} => {
  let totalDistance = 0;
  let totalTime = 0;
  let totalConsumption = 0;
  const curve: BatteryPoint[] = [];
  const criticalPoints: number[] = [];

  curve.push({
    time: 0,
    percentage: 100,
    distance: 0,
    altitude: toMeters(waypoints[0].position)
  });

  for (let i = 0; i < waypoints.length - 1; i++) {
    const current = waypoints[i];
    const next = waypoints[i + 1];
    
    const segment = calculateSegmentConsumption(
      current.position,
      next.position,
      current.speed,
      config
    );

    totalDistance += segment.distance;
    totalTime += segment.time;
    totalConsumption += segment.consumption;

    const hoverConsumption = current.stayTime * config.hoverConsumptionPerSecond;
    totalConsumption += hoverConsumption;
    totalTime += current.stayTime;

    curve.push({
      time: totalTime,
      percentage: Math.max(0, 100 - totalConsumption),
      distance: totalDistance,
      altitude: toMeters(next.position)
    });

    if (100 - totalConsumption < 30) {
      criticalPoints.push(i);
    }
  }

  const returnDistance = totalDistance * 0.5;
  const returnBatteryRequired = returnDistance * config.baseConsumptionPerMeter * config.safetyMargin;

  return {
    totalDistance,
    totalTime,
    totalConsumption,
    curve,
    returnBatteryRequired,
    criticalPoints
  };
};

export const estimateBatteryAtTime = (
  curve: BatteryPoint[],
  currentTime: number
): number => {
  if (curve.length === 0) return 100;
  if (currentTime <= curve[0].time) return curve[0].percentage;
  if (currentTime >= curve[curve.length - 1].time) return curve[curve.length - 1].percentage;

  for (let i = 1; i < curve.length; i++) {
    if (curve[i].time >= currentTime) {
      const prev = curve[i - 1];
      const next = curve[i];
      const t = (currentTime - prev.time) / (next.time - prev.time);
      return prev.percentage + (next.percentage - prev.percentage) * t;
    }
  }

  return curve[curve.length - 1].percentage;
};

export const getBatteryStatus = (
  percentage: number,
  returnRequired: number = 20
): { status: 'safe' | 'warning' | 'danger'; message: string } => {
  const effectiveReturn = returnRequired + 5;
  
  if (percentage <= effectiveReturn + 10) {
    return {
      status: 'danger',
      message: `电量严重不足！请立即返航。返航需要约${returnRequired.toFixed(1)}%电量`
    };
  }
  
  if (percentage <= effectiveReturn + 25) {
    return {
      status: 'warning',
      message: `电量偏低。返航需要约${returnRequired.toFixed(1)}%电量，请规划返航点`
    };
  }
  
  return {
    status: 'safe',
    message: '电量充足'
  };
};

export const interpolatePosition = (
  waypoints: Waypoint[],
  currentTime: number
): { position: Point3D; waypointIndex: number; progress: number } | null => {
  if (waypoints.length < 2) return null;

  let elapsedTime = 0;
  
  for (let i = 0; i < waypoints.length - 1; i++) {
    const current = waypoints[i];
    const next = waypoints[i + 1];
    
    const distance = distance3D(current.position, next.position);
    const flightTime = distance / current.speed;
    const segmentTotalTime = flightTime + current.stayTime;

    if (elapsedTime + segmentTotalTime >= currentTime) {
      const timeInSegment = currentTime - elapsedTime;
      
      if (timeInSegment < current.stayTime) {
        return {
          position: { ...current.position },
          waypointIndex: i,
          progress: 0
        };
      }
      
      const flightProgress = (timeInSegment - current.stayTime) / flightTime;
      const clampedProgress = Math.max(0, Math.min(1, flightProgress));
      
      return {
        position: {
          x: current.position.x + (next.position.x - current.position.x) * clampedProgress,
          y: current.position.y + (next.position.y - current.position.y) * clampedProgress,
          z: current.position.z + (next.position.z - current.position.z) * clampedProgress,
          unit: current.position.unit
        },
        waypointIndex: i,
        progress: clampedProgress
      };
    }
    
    elapsedTime += segmentTotalTime;
  }

  const lastWp = waypoints[waypoints.length - 1];
  return {
    position: { ...lastWp.position },
    waypointIndex: waypoints.length - 1,
    progress: 1
  };
};
