import type { TrajectoryPoint } from '../types';

const FLOOR_HEIGHT = 4;
const TOTAL_POINTS = 500;
const BASE_TIMESTAMP = Date.now() - 3600000;

const pathPatterns = [
  { startX: 5, startY: 5, endX: 35, endY: 25, floor: 1 },
  { startX: 35, startY: 5, endX: 5, endY: 25, floor: 1 },
  { startX: 10, startY: 10, endX: 30, endY: 20, floor: 2 },
  { startX: 30, startY: 10, endX: 10, endY: 20, floor: 2 },
  { startX: 5, startY: 15, endX: 35, endY: 15, floor: 3 },
  { startX: 15, startY: 5, endX: 25, endY: 25, floor: 3 },
];

const breakpointIndices = [45, 120, 210, 290, 375, 440];
const floorConfusionIndices = [80, 165, 255, 340, 420, 480];

export const trajectoryPoints: TrajectoryPoint[] = [];

for (let i = 0; i < TOTAL_POINTS; i++) {
  const robotIndex = i % 20;
  const robotId = `robot-${String(robotIndex + 1).padStart(3, '0')}`;
  const pattern = pathPatterns[robotIndex % pathPatterns.length];
  const progress = ((i * 7) % 100) / 100;

  const t = progress;
  const x = pattern.startX + (pattern.endX - pattern.startX) * t + (Math.random() - 0.5) * 0.5;
  const y = pattern.startY + (pattern.endY - pattern.startY) * t + (Math.random() - 0.5) * 0.5;

  let floor = pattern.floor;
  let z = (floor - 1) * FLOOR_HEIGHT;
  let floorConfidence = 0.95;

  if (floorConfusionIndices.includes(i)) {
    floor = (floor % 3) + 1;
    z = (floor - 1) * FLOOR_HEIGHT + (Math.random() - 0.5) * 1.5;
    floorConfidence = 0.3 + Math.random() * 0.4;
  }

  const isBreakpoint = breakpointIndices.includes(i);
  const timestamp = BASE_TIMESTAMP + i * 5000 + (isBreakpoint ? 45000 : 0);

  const speed = isBreakpoint ? 0 : (0.5 + Math.random() * 2.5);

  let status: TrajectoryPoint['status'] = 'moving';
  if (speed < 0.1) status = 'waiting';
  else if (robotIndex % 7 === 0 && i % 25 < 5) status = 'picking';
  else if (robotIndex % 9 === 0 && i % 30 < 3) status = 'charging';

  trajectoryPoints.push({
    id: `traj-${String(i + 1).padStart(5, '0')}`,
    robotId,
    timestamp,
    position: { x, y, z },
    floor,
    speed,
    status,
    isBreakpoint,
    floorConfidence,
  });
}

trajectoryPoints[200].floor = 0;
trajectoryPoints[200].position.z = -1.2;
trajectoryPoints[200].floorConfidence = 0.1;

trajectoryPoints[310].floor = 99;
trajectoryPoints[310].position.z = 100;
trajectoryPoints[310].floorConfidence = 0.05;

export const getTrajectoriesByRobot = (robotId: string): TrajectoryPoint[] => {
  return trajectoryPoints.filter(t => t.robotId === robotId).sort((a, b) => a.timestamp - b.timestamp);
};

export const getTrajectoriesByTimeRange = (start: number, end: number): TrajectoryPoint[] => {
  return trajectoryPoints.filter(t => t.timestamp >= start && t.timestamp <= end);
};

export const getBreakpointCount = (): number => {
  return trajectoryPoints.filter(t => t.isBreakpoint).length;
};

export const getFloorConfusionCount = (): number => {
  return trajectoryPoints.filter(t => t.floorConfidence < 0.7).length;
};

export default trajectoryPoints;
