import { ExhibitionHall, VisitorTrajectory, BatchData } from '../types';

const createHall = (): ExhibitionHall => ({
  id: 'hall-1',
  name: '古代文明展厅',
  dimensions: { width: 30, height: 5, depth: 20 },
  walls: [
    { id: 'w1', start: { x: -15, y: 0, z: -10 }, end: { x: 15, y: 0, z: -10 }, height: 3 },
    { id: 'w2', start: { x: 15, y: 0, z: -10 }, end: { x: 15, y: 0, z: 10 }, height: 3 },
    { id: 'w3', start: { x: 15, y: 0, z: 10 }, end: { x: -15, y: 0, z: 10 }, height: 3 },
    { id: 'w4', start: { x: -15, y: 0, z: 10 }, end: { x: -15, y: 0, z: -10 }, height: 3 },
  ],
  showcases: [
    { id: 's1', number: 'A01', name: '青铜器展区', position: { x: -10, y: 0, z: -5 }, size: { width: 2, height: 1.5, depth: 1.5 }, category: '青铜器' },
    { id: 's2', number: 'A02', name: '玉器展区', position: { x: -5, y: 0, z: -5 }, size: { width: 2, height: 1.5, depth: 1.5 }, category: '玉器' },
    { id: 's3', number: 'A03', name: '陶瓷展区', position: { x: 0, y: 0, z: -5 }, size: { width: 2, height: 1.5, depth: 1.5 }, category: '陶瓷' },
    { id: 's4', number: 'B01', name: '书画展区', position: { x: 5, y: 0, z: 0 }, size: { width: 2, height: 1.5, depth: 1.5 }, category: '书画' },
    { id: 's5', number: 'B02', name: '金银器展区', position: { x: 10, y: 0, z: 0 }, size: { width: 2, height: 1.5, depth: 1.5 }, category: '金银器' },
    { id: 's6', number: 'C01', name: '雕塑展区', position: { x: -10, y: 0, z: 5 }, size: { width: 2, height: 1.5, depth: 1.5 }, category: '雕塑' },
    { id: 's7', number: 'C02', name: '古籍展区', position: { x: -5, y: 0, z: 5 }, size: { width: 2, height: 1.5, depth: 1.5 }, category: '古籍' },
    { id: 's8', number: 'C03', name: '织绣展区', position: { x: 0, y: 0, z: 5 }, size: { width: 2, height: 1.5, depth: 1.5 }, category: '织绣' },
  ],
});

const generateTrajectory = (
  visitorId: string,
  batchId: string,
  path: Array<{ x: number; z: number }>,
  stayPoints: Array<{ showcaseId: string; startTime: number; duration: number; isCongestion: boolean }>,
  startTime: number,
  speed: number = 1
): VisitorTrajectory => {
  const points = [];
  let currentTime = startTime;
  
  for (let i = 0; i < path.length; i++) {
    const point = path[i];
    const nextPoint = path[i + 1] || path[i];
    
    const steps = 10;
    for (let j = 0; j <= steps; j++) {
      const t = j / steps;
      points.push({
        timestamp: currentTime,
        position: {
          x: point.x + (nextPoint.x - point.x) * t,
          y: 1.2,
          z: point.z + (nextPoint.z - point.z) * t,
        },
        confidence: 0.9,
      });
      currentTime += 500 / speed;
    }
  }
  
  return {
    visitorId,
    batchId,
    startTime,
    endTime: currentTime,
    points,
    stays: stayPoints,
  };
};

export const normalSample = {
  hall: createHall(),
  batches: [
    { id: 'b1', name: '上午场', startTime: 0, endTime: 180000, visitorCount: 8 },
    { id: 'b2', name: '下午场', startTime: 200000, endTime: 380000, visitorCount: 6 },
  ] as BatchData[],
  trajectories: [
    generateTrajectory('v1', 'b1',
      [{ x: -12, z: 8 }, { x: -10, z: 5 }, { x: -5, z: 5 }, { x: 0, z: 5 }, { x: 0, z: -5 }, { x: -5, z: -5 }, { x: 12, z: -8 }],
      [{ showcaseId: 's6', startTime: 10000, duration: 15000, isCongestion: false },
       { showcaseId: 's7', startTime: 35000, duration: 20000, isCongestion: false },
       { showcaseId: 's3', startTime: 70000, duration: 25000, isCongestion: false }],
      0
    ),
    generateTrajectory('v2', 'b1',
      [{ x: -12, z: 8 }, { x: -10, z: -5 }, { x: -5, z: -5 }, { x: 0, z: -5 }, { x: 5, z: 0 }, { x: 10, z: 0 }, { x: 12, z: -8 }],
      [{ showcaseId: 's1', startTime: 15000, duration: 30000, isCongestion: false },
       { showcaseId: 's2', startTime: 50000, duration: 10000, isCongestion: false },
       { showcaseId: 's4', startTime: 80000, duration: 45000, isCongestion: false },
       { showcaseId: 's5', startTime: 130000, duration: 20000, isCongestion: false }],
      5000
    ),
    generateTrajectory('v3', 'b1',
      [{ x: -12, z: 8 }, { x: 0, z: 5 }, { x: 10, z: 0 }, { x: 5, z: 0 }, { x: 0, z: -5 }, { x: 12, z: -8 }],
      [{ showcaseId: 's8', startTime: 20000, duration: 35000, isCongestion: true },
       { showcaseId: 's5', startTime: 70000, duration: 15000, isCongestion: false },
       { showcaseId: 's3', startTime: 100000, duration: 20000, isCongestion: true }],
      10000
    ),
    generateTrajectory('v4', 'b1',
      [{ x: 12, z: 8 }, { x: 10, z: 0 }, { x: 5, z: 0 }, { x: 0, z: -5 }, { x: -5, z: -5 }, { x: -12, z: -8 }],
      [{ showcaseId: 's5', startTime: 18000, duration: 25000, isCongestion: false },
       { showcaseId: 's4', startTime: 50000, duration: 18000, isCongestion: false }],
      15000
    ),
    generateTrajectory('v5', 'b1',
      [{ x: 12, z: 8 }, { x: 0, z: 5 }, { x: -5, z: 5 }, { x: -10, z: 5 }, { x: -10, z: -5 }, { x: -12, z: -8 }],
      [{ showcaseId: 's6', startTime: 25000, duration: 40000, isCongestion: true },
       { showcaseId: 's7', startTime: 70000, duration: 20000, isCongestion: true },
       { showcaseId: 's1', startTime: 100000, duration: 30000, isCongestion: false }],
      20000
    ),
    generateTrajectory('v6', 'b2',
      [{ x: -12, z: 8 }, { x: -10, z: -5 }, { x: -5, z: -5 }, { x: 0, z: -5 }, { x: 5, z: 0 }, { x: 12, z: -8 }],
      [{ showcaseId: 's1', startTime: 210000, duration: 20000, isCongestion: false },
       { showcaseId: 's4', startTime: 250000, duration: 35000, isCongestion: false }],
      200000
    ),
    generateTrajectory('v7', 'b2',
      [{ x: 12, z: 8 }, { x: 10, z: 0 }, { x: 0, z: 5 }, { x: -10, z: 5 }, { x: -12, z: -8 }],
      [{ showcaseId: 's5', startTime: 215000, duration: 25000, isCongestion: false },
       { showcaseId: 's8', startTime: 250000, duration: 30000, isCongestion: false },
       { showcaseId: 's6', startTime: 290000, duration: 15000, isCongestion: false }],
      205000
    ),
    generateTrajectory('v8', 'b2',
      [{ x: -12, z: 8 }, { x: 0, z: 5 }, { x: 0, z: -5 }, { x: 10, z: 0 }, { x: 12, z: -8 }],
      [{ showcaseId: 's7', startTime: 220000, duration: 40000, isCongestion: true },
       { showcaseId: 's3', startTime: 270000, duration: 20000, isCongestion: false },
       { showcaseId: 's5', startTime: 300000, duration: 25000, isCongestion: true }],
      210000
    ),
  ] as VisitorTrajectory[],
};

export const conflictSample = {
  hall: createHall(),
  batches: [
    { id: 'b1', name: '测试场次', startTime: 0, endTime: 150000, visitorCount: 5 },
  ] as BatchData[],
  trajectories: [
    {
      ...generateTrajectory('v1', 'b1',
        [{ x: -12, z: 8 }, { x: -10, z: 5 }, { x: -5, z: 5 }, { x: 0, z: 5 }, { x: 12, z: -8 }],
        [{ showcaseId: 's6', startTime: 10000, duration: 15000, isCongestion: false },
         { showcaseId: 's7', startTime: 35000, duration: 20000, isCongestion: false },
         { showcaseId: 'invalid_s99', startTime: 70000, duration: 25000, isCongestion: false }],
        0
      ),
      points: [
        ...generateTrajectory('v1', 'b1', [], [], 0).points.slice(0, 20),
        { timestamp: 50000, position: { x: 100, y: 1.2, z: 100 }, confidence: 0.9 },
        ...generateTrajectory('v1', 'b1', [], [], 0).points.slice(20),
      ],
    },
    {
      ...generateTrajectory('v2', 'b1',
        [{ x: -12, z: 8 }, { x: -10, z: -5 }, { x: -5, z: -5 }, { x: 12, z: -8 }],
        [{ showcaseId: 's1', startTime: 15000, duration: 30000, isCongestion: true },
         { showcaseId: 's2', startTime: 50000, duration: 10000, isCongestion: false }],
        5000
      ),
      points: generateTrajectory('v2', 'b1', [], [], 5000).points.map((p, i) => ({
        ...p,
        confidence: i % 5 === 0 ? 0.3 : 0.9,
      })),
    },
    generateTrajectory('v3', 'b1',
      [{ x: 12, z: 8 }, { x: 10, z: 0 }, { x: 5, z: 0 }, { x: 12, z: -8 }],
      [{ showcaseId: 's5', startTime: 18000, duration: 25000, isCongestion: true }],
      15000
    ),
    generateTrajectory('v4', 'b1',
      [{ x: -12, z: 8 }, { x: 0, z: 5 }, { x: -5, z: 5 }, { x: -12, z: -8 }],
      [{ showcaseId: 's8', startTime: 20000, duration: 35000, isCongestion: false },
       { showcaseId: 's7', startTime: 60000, duration: 20000, isCongestion: true }],
      20000
    ),
    generateTrajectory('v5', 'b1',
      [{ x: 12, z: 8 }, { x: 0, z: -5 }, { x: -5, z: -5 }, { x: -12, z: -8 }],
      [{ showcaseId: 's3', startTime: 25000, duration: 40000, isCongestion: false }],
      25000
    ),
  ] as VisitorTrajectory[],
};

export const emptySample = {
  hall: createHall(),
  batches: [] as BatchData[],
  trajectories: [] as VisitorTrajectory[],
};
