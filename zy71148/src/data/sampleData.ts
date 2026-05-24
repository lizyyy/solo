import { IceData, GridPoint, ThicknessSample, TemperatureProbe, RepairArea, EventPeriod, SampleStatus } from '../types';

const RINK_WIDTH = 60;
const RINK_HEIGHT = 30;
const GRID_SIZE = 3;
const THICKNESS_THRESHOLD = 30;
const TEMP_WARNING = -3;
const TEMP_CRITICAL = -2;

const baseTime = Date.now() - 7 * 24 * 60 * 60 * 1000;
const timeInterval = 4 * 60 * 60 * 1000;
const numSnapshots = 42;

const generateGridPoints = (): GridPoint[] => {
  const points: GridPoint[] = [];
  const cols = Math.floor(RINK_WIDTH / GRID_SIZE);
  const rows = Math.floor(RINK_HEIGHT / GRID_SIZE);

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      points.push({
        id: `grid-${row}-${col}`,
        x: (col + 0.5) * GRID_SIZE,
        y: (row + 0.5) * GRID_SIZE,
      });
    }
  }
  return points;
};

const getSampleStatus = (thickness: number): SampleStatus => {
  const ratio = thickness / THICKNESS_THRESHOLD;
  if (ratio < 0.7) return 'critical';
  if (ratio < 0.85) return 'warning';
  if (ratio < 1.0) return 'warning';
  return 'normal';
};

const generateThicknessSamples = (
  gridPoints: GridPoint[],
  snapshotIndex: number,
  timeFactor: number
): ThicknessSample[] => {
  return gridPoints.map((point) => {
    const centerDist = Math.sqrt(
      Math.pow(point.x - RINK_WIDTH / 2, 2) + Math.pow(point.y - RINK_HEIGHT / 2, 2)
    );
    const edgeFactor = 1 - centerDist / (RINK_WIDTH / 2) * 0.3;
    const timeVariation = Math.sin(timeFactor * 2 + point.x * 0.1 + point.y * 0.1) * 2;
    const randomVariation = (Math.random() - 0.5) * 3;

    let thickness = 32 * edgeFactor + timeVariation + randomVariation;

    if (snapshotIndex > 15 && snapshotIndex < 20) {
      if (point.x > 20 && point.x < 35 && point.y > 10 && point.y < 20) {
        thickness -= 8;
      }
    }

    if (snapshotIndex >= 20 && snapshotIndex < 25) {
      if (point.x > 20 && point.x < 35 && point.y > 10 && point.y < 20) {
        thickness += 12;
      }
    }

    const isMissing = Math.random() < 0.02 && snapshotIndex % 3 === 0;

    return {
      gridId: point.id,
      timestamp: baseTime + snapshotIndex * timeInterval,
      thickness: isMissing ? 0 : Math.max(15, Math.min(45, thickness)),
      status: isMissing ? 'missing' : getSampleStatus(thickness),
    };
  });
};

const generateProbes = (): TemperatureProbe[] => {
  return [
    { id: 'probe-1', x: 10, y: 8, depth: 20 },
    { id: 'probe-2', x: 30, y: 5, depth: 25 },
    { id: 'probe-3', x: 50, y: 10, depth: 20 },
    { id: 'probe-4', x: 15, y: 20, depth: 30 },
    { id: 'probe-5', x: 40, y: 22, depth: 25 },
    { id: 'probe-6', x: 55, y: 25, depth: 20 },
  ];
};

const generateTemperatureReadings = (
  probes: TemperatureProbe[],
  snapshotIndex: number
) => {
  return probes.map((probe) => {
    const baseTemp = -8;
    const timeVariation = Math.sin(snapshotIndex * 0.3 + probe.x * 0.05) * 2;
    const depthFactor = probe.depth * 0.05;
    const randomVariation = (Math.random() - 0.5) * 1;

    let temperature = baseTemp + timeVariation + depthFactor + randomVariation;

    if (snapshotIndex > 18 && snapshotIndex < 23) {
      if (probe.x > 20 && probe.x < 45) {
        temperature += 4;
      }
    }

    return {
      probeId: probe.id,
      timestamp: baseTime + snapshotIndex * timeInterval,
      temperature: Math.round(temperature * 10) / 10,
    };
  });
};

const generateRepairAreas = (): RepairArea[] => {
  return [
    {
      id: 'repair-1',
      points: [
        { x: 22, y: 12 },
        { x: 33, y: 12 },
        { x: 33, y: 18 },
        { x: 22, y: 18 },
      ],
      startTime: baseTime + 18 * timeInterval,
      endTime: baseTime + 20 * timeInterval,
      retested: true,
    },
    {
      id: 'repair-2',
      points: [
        { x: 45, y: 5 },
        { x: 52, y: 5 },
        { x: 52, y: 10 },
        { x: 45, y: 10 },
      ],
      startTime: baseTime + 25 * timeInterval,
      endTime: baseTime + 27 * timeInterval,
      retested: false,
    },
    {
      id: 'repair-3',
      points: [
        { x: 8, y: 22 },
        { x: 15, y: 22 },
        { x: 15, y: 27 },
        { x: 8, y: 27 },
      ],
      startTime: baseTime + 32 * timeInterval,
      endTime: baseTime + 34 * timeInterval,
      retested: false,
    },
  ];
};

const generateEvents = (): EventPeriod[] => {
  return [
    {
      id: 'event-1',
      name: '日常训练',
      startTime: baseTime + 6 * timeInterval,
      endTime: baseTime + 12 * timeInterval,
      type: 'training',
    },
    {
      id: 'event-2',
      name: '花样滑冰赛',
      startTime: baseTime + 14 * timeInterval,
      endTime: baseTime + 18 * timeInterval,
      type: 'competition',
    },
    {
      id: 'event-3',
      name: '冰面维护',
      startTime: baseTime + 18 * timeInterval,
      endTime: baseTime + 21 * timeInterval,
      type: 'maintenance',
    },
    {
      id: 'event-4',
      name: '冰球比赛',
      startTime: baseTime + 24 * timeInterval,
      endTime: baseTime + 28 * timeInterval,
      type: 'competition',
    },
    {
      id: 'event-5',
      name: '赛前准备',
      startTime: baseTime + 36 * timeInterval,
      endTime: baseTime + 38 * timeInterval,
      type: 'maintenance',
    },
    {
      id: 'event-6',
      name: '正式比赛',
      startTime: baseTime + 38 * timeInterval,
      endTime: baseTime + 42 * timeInterval,
      type: 'competition',
    },
  ];
};

export const generateSampleData = (): IceData => {
  const gridPoints = generateGridPoints();
  const probes = generateProbes();
  const repairAreas = generateRepairAreas();
  const events = generateEvents();

  const snapshots = Array.from({ length: numSnapshots }, (_, i) => {
    const timeFactor = i / numSnapshots;
    return {
      timestamp: baseTime + i * timeInterval,
      thicknessSamples: generateThicknessSamples(gridPoints, i, timeFactor),
      temperatureReadings: generateTemperatureReadings(probes, i),
    };
  });

  return {
    rink: {
      id: 'main-rink',
      name: '主冰场',
      width: RINK_WIDTH,
      height: RINK_HEIGHT,
      gridSize: GRID_SIZE,
      thicknessThreshold: THICKNESS_THRESHOLD,
      temperatureWarning: TEMP_WARNING,
      temperatureCritical: TEMP_CRITICAL,
    },
    gridPoints,
    probes,
    repairAreas,
    events,
    snapshots,
  };
};
