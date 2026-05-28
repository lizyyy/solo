import type { ChargingStation, ChargingQueueItem } from '../types';

const FLOOR_HEIGHT = 4;
const BASE_TIME = Date.now() - 1800000;

const stationConfigs = [
  { floor: 1, x: 22, y: 24 },
  { floor: 1, x: 27, y: 24 },
  { floor: 1, x: 32, y: 24 },
  { floor: 1, x: 22, y: 27 },
  { floor: 2, x: 25, y: 8 },
  { floor: 2, x: 30, y: 8 },
  { floor: 2, x: 35, y: 8 },
  { floor: 3, x: 34, y: 8 },
  { floor: 3, x: 34, y: 15 },
  { floor: 3, x: 34, y: 22 },
];

const generateQueueItem = (
  id: string,
  stationId: string,
  robotId: string,
  startTimeOffset: number,
  waitDuration: number,
  isDuplicate: boolean = false,
  deduplicatedFrom?: string
): ChargingQueueItem => ({
  id,
  stationId,
  robotId,
  startTime: BASE_TIME + startTimeOffset,
  waitDuration,
  isDuplicate,
  deduplicatedFrom,
});

export const chargingStations: ChargingStation[] = stationConfigs.map((config, index) => {
  const stationId = `station-${String(index).padStart(3, '0')}`;
  const floorId = `floor-${config.floor}`;
  const zBase = (config.floor - 1) * FLOOR_HEIGHT;

  const status: ChargingStation['status'] = index === 2
    ? 'offline'
    : (index % 2 === 0 ? 'available' : 'occupied');

  const currentRobotId = status === 'occupied'
    ? `robot-${String((index * 2 + 1) % 20 + 1).padStart(3, '0')}`
    : undefined;

  const queue: ChargingQueueItem[] = [];

  if (index === 0) {
    queue.push(
      generateQueueItem('queue-001', stationId, 'robot-005', 0, 180, false),
      generateQueueItem('queue-002', stationId, 'robot-008', 60000, 120, false),
      generateQueueItem('queue-003', stationId, 'robot-005', 65000, 175, true, 'queue-001'),
      generateQueueItem('queue-004', stationId, 'robot-012', 120000, 90, false)
    );
  } else if (index === 4) {
    queue.push(
      generateQueueItem('queue-005', stationId, 'robot-003', 30000, 210, false),
      generateQueueItem('queue-006', stationId, 'robot-003', 35000, 205, true, 'queue-005'),
      generateQueueItem('queue-007', stationId, 'robot-003', 40000, 200, true, 'queue-005'),
      generateQueueItem('queue-008', stationId, 'robot-015', 90000, 150, false)
    );
  } else if (index === 7) {
    queue.push(
      generateQueueItem('queue-009', stationId, 'robot-007', 15000, 240, false),
      generateQueueItem('queue-010', stationId, 'robot-010', 45000, 180, false),
      generateQueueItem('queue-011', stationId, 'robot-014', 75000, 135, false)
    );
  } else if (index === 1) {
    queue.push(
      generateQueueItem('queue-012', stationId, 'robot-018', 20000, 165, false)
    );
  }

  return {
    id: stationId,
    floorId,
    position: { x: config.x, y: config.y, z: zBase },
    status,
    power: 22 + (index % 3) * 3,
    currentRobotId,
    queue,
  };
});

chargingStations[3].position.z = FLOOR_HEIGHT * 2.5;

chargingStations[5].queue = [
  generateQueueItem('queue-013', 'station-005', 'robot-002', 10000, 195, false),
  generateQueueItem('queue-014', 'station-005', 'robot-002', 12000, 193, true, 'queue-013'),
  generateQueueItem('queue-015', 'station-005', 'robot-009', 50000, 145, false),
  generateQueueItem('queue-016', 'station-005', 'robot-009', 52000, 143, true, 'queue-015'),
  generateQueueItem('queue-017', 'station-005', 'robot-009', 54000, 141, true, 'queue-015'),
];

export const getStationsByFloor = (floorLevel: number): ChargingStation[] => {
  const floorId = `floor-${floorLevel}`;
  return chargingStations.filter(s => s.floorId === floorId);
};

export const getAvailableStations = (): ChargingStation[] => {
  return chargingStations.filter(s => s.status === 'available');
};

export const getQueueLengthByStation = (stationId: string): number => {
  const station = chargingStations.find(s => s.id === stationId);
  return station ? station.queue.filter(q => !q.isDuplicate).length : 0;
};

export const getDuplicateQueueCount = (): number => {
  return chargingStations.reduce((count, station) =>
    count + station.queue.filter(q => q.isDuplicate).length, 0
  );
};

export const getTotalWaitTime = (stationId: string): number => {
  const station = chargingStations.find(s => s.id === stationId);
  if (!station) return 0;
  return station.queue
    .filter(q => !q.isDuplicate)
    .reduce((sum, q) => sum + q.waitDuration, 0);
};

export default chargingStations;
