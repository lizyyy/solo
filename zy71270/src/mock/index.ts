import warehouse, { floors, allShelves, allChargingStations, allZones } from './warehouse';
import robots, { workingRobots, chargingRobots, errorRobots } from './robots';
import trajectoryPoints, { getTrajectoriesByRobot, getTrajectoriesByTimeRange, getBreakpointCount, getFloorConfusionCount } from './trajectories';
import shelves, { getShelvesByFloor, getShelvesByZone, getHighCongestionShelves, getMissingDataShelves, getShelvesBySku } from './shelves';
import orderWaves, { getActiveWave, getWavesByPriority, getIncompleteWaves, getWaveBySku } from './orderWaves';
import chargingStations, { getStationsByFloor, getAvailableStations, getQueueLengthByStation, getDuplicateQueueCount, getTotalWaitTime } from './chargingStations';
import congestionReports, { getReportsByShelf, getReportsByTimeRange, getActiveReports, getModifiedReports, getReportsByReason, getAvgWaitTimeByShelf } from './congestionReports';
import dataSourceStatuses, { allQualityIssues, getIssuesBySeverity, getIssuesByType, getFixableIssues, getOverallQualityScore, getDisconnectedSources } from './dataSources';
import type { PathSegment, TrajectoryPoint } from '../types';

export * from '../types';

function buildPathSegments(points: TrajectoryPoint[]): PathSegment[] {
  const byRobot = new Map<string, TrajectoryPoint[]>();
  for (const p of points) {
    if (!byRobot.has(p.robotId)) byRobot.set(p.robotId, []);
    byRobot.get(p.robotId)!.push(p);
  }
  const segments: PathSegment[] = [];
  let segId = 0;
  for (const [, pts] of byRobot) {
    const sorted = pts.sort((a, b) => a.timestamp - b.timestamp);
    for (let i = 0; i < sorted.length - 1; i++) {
      const sp = sorted[i];
      const ep = sorted[i + 1];
      const timeDiff = ep.timestamp - sp.timestamp;
      const isBroken = timeDiff > 30000;
      const dist = Math.sqrt(
        (ep.position.x - sp.position.x) ** 2 +
        (ep.position.y - sp.position.y) ** 2 +
        (ep.position.z - sp.position.z) ** 2
      );
      const timeSec = timeDiff / 1000;
      const avgSpeed = timeSec > 0 ? dist / timeSec : 0;
      segments.push({
        id: `seg-${String(++segId).padStart(4, '0')}`,
        robotId: sp.robotId,
        startPoint: sp,
        endPoint: ep,
        density: Math.round(Math.random() * 20 + 1),
        avgSpeed: Math.round(avgSpeed * 100) / 100,
        isBroken,
      });
    }
  }
  return segments;
}

export const mockPathSegments = buildPathSegments(trajectoryPoints);

export {
  warehouse as mockWarehouse,
  robots as mockRobots,
  trajectoryPoints as mockTrajectories,
  orderWaves as mockOrderWaves,
  congestionReports as mockCongestionReports,
  warehouse,
  floors,
  allShelves,
  allChargingStations,
  allZones,
  robots,
  workingRobots,
  chargingRobots,
  errorRobots,
  trajectoryPoints,
  getTrajectoriesByRobot,
  getTrajectoriesByTimeRange,
  getBreakpointCount,
  getFloorConfusionCount,
  shelves,
  getShelvesByFloor,
  getShelvesByZone,
  getHighCongestionShelves,
  getMissingDataShelves,
  getShelvesBySku,
  orderWaves,
  getActiveWave,
  getWavesByPriority,
  getIncompleteWaves,
  getWaveBySku,
  chargingStations,
  getStationsByFloor,
  getAvailableStations,
  getQueueLengthByStation,
  getDuplicateQueueCount,
  getTotalWaitTime,
  congestionReports,
  getReportsByShelf,
  getReportsByTimeRange,
  getActiveReports,
  getModifiedReports,
  getReportsByReason,
  getAvgWaitTimeByShelf,
  dataSourceStatuses,
  allQualityIssues,
  getIssuesBySeverity,
  getIssuesByType,
  getFixableIssues,
  getOverallQualityScore,
  getDisconnectedSources,
};

export const getAllMockData = () => ({
  warehouse,
  floors,
  robots,
  trajectoryPoints,
  mockPathSegments,
  shelves,
  orderWaves,
  chargingStations,
  congestionReports,
  dataSourceStatuses,
  qualityIssues: allQualityIssues,
});

export default getAllMockData;
