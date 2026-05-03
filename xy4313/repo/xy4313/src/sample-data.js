export const sampleShelves = {
  version: "1.0",
  warehouseSize: { width: 60, depth: 40, height: 10 },
  shelves: [
    {
      id: "shelf_001",
      name: "A区货架-1",
      position: { x: 10, y: 0, z: 10 },
      size: { width: 8, depth: 2, height: 6 },
      isBlindSpot: true,
      blindSpotZone: { radius: 5, angle: 120 }
    },
    {
      id: "shelf_002",
      name: "A区货架-2",
      position: { x: 20, y: 0, z: 10 },
      size: { width: 8, depth: 2, height: 6 },
      isBlindSpot: false
    },
    {
      id: "shelf_003",
      name: "B区货架-1",
      position: { x: 10, y: 0, z: 25 },
      size: { width: 8, depth: 2, height: 6 },
      isBlindSpot: true,
      blindSpotZone: { radius: 6, angle: 90 }
    },
    {
      id: "shelf_004",
      name: "B区货架-2",
      position: { x: 20, y: 0, z: 25 },
      size: { width: 8, depth: 2, height: 6 },
      isBlindSpot: false
    },
    {
      id: "shelf_005",
      name: "C区货架-1",
      position: { x: 35, y: 0, z: 10 },
      size: { width: 10, depth: 2, height: 6 },
      isBlindSpot: true,
      blindSpotZone: { radius: 4, angle: 150 }
    },
    {
      id: "shelf_006",
      name: "C区货架-2",
      position: { x: 35, y: 0, z: 25 },
      size: { width: 10, depth: 2, height: 6 },
      isBlindSpot: false
    }
  ],
  noEntryZones: [
    {
      id: "zone_001",
      name: "消防通道",
      type: "rectangle",
      position: { x: 30, y: 0, z: 17.5 },
      width: 3,
      depth: 20
    },
    {
      id: "zone_002",
      name: "充电区域",
      type: "circle",
      center: { x: 50, y: 0, z: 35 },
      radius: 4
    }
  ],
  temporaryObstacles: [
    {
      id: "obstacle_001",
      name: "临时托盘占道",
      type: "pallet",
      position: { x: 25, y: 0, z: 18 },
      size: { width: 1.2, height: 1.1, depth: 1.2 }
    }
  ]
};

export function generateForkliftCSV() {
  const startTime = new Date();
  startTime.setHours(9, 0, 0, 0);
  
  const points = [];
  const pathPoints = [
    { x: 5, z: 5, speed: 0, isReversing: false },
    { x: 8, z: 10, speed: 4, isReversing: false },
    { x: 12, z: 15, speed: 3.5, isReversing: false },
    { x: 15, z: 18, speed: 2, isReversing: false },
    { x: 17, z: 18, speed: 0, isReversing: false },
    { x: 15, z: 18, speed: 1.5, isReversing: true },
    { x: 12, z: 15, speed: 2.5, isReversing: true },
    { x: 10, z: 12, speed: 3, isReversing: false },
    { x: 15, z: 10, speed: 4.5, isReversing: false },
    { x: 20, z: 10, speed: 5.5, isReversing: false },
    { x: 25, z: 12, speed: 6, isReversing: false },
    { x: 30, z: 15, speed: 4, isReversing: false },
    { x: 35, z: 15, speed: 3, isReversing: false },
    { x: 38, z: 18, speed: 2.5, isReversing: false },
    { x: 40, z: 22, speed: 3.5, isReversing: false },
    { x: 38, z: 25, speed: 2, isReversing: true },
    { x: 35, z: 26, speed: 1, isReversing: true },
    { x: 33, z: 25, speed: 0, isReversing: false },
    { x: 30, z: 22, speed: 3, isReversing: false },
    { x: 25, z: 20, speed: 4, isReversing: false },
    { x: 20, z: 18, speed: 5, isReversing: false },
    { x: 15, z: 15, speed: 3.5, isReversing: false },
    { x: 10, z: 12, speed: 2, isReversing: false },
    { x: 5, z: 8, speed: 1, isReversing: false },
    { x: 5, z: 5, speed: 0, isReversing: false }
  ];

  const timeStep = 500;
  let currentTime = startTime.getTime();

  for (let i = 0; i < pathPoints.length - 1; i++) {
    const start = pathPoints[i];
    const end = pathPoints[i + 1];
    
    const dx = end.x - start.x;
    const dz = end.z - start.z;
    const distance = Math.sqrt(dx * dx + dz * dz);
    const speed = (start.speed + end.speed) / 2;
    const steps = Math.max(1, Math.ceil(distance / 0.5));

    for (let step = 0; step <= steps; step++) {
      const alpha = step / steps;
      const x = start.x + dx * alpha;
      const z = start.z + dz * alpha;
      const currentSpeed = start.speed + (end.speed - start.speed) * alpha;
      const direction = Math.atan2(dz, dx) * (180 / Math.PI);

      points.push({
        timestamp: new Date(currentTime).toISOString(),
        forkliftId: 'FL-001',
        x: x.toFixed(2),
        y: '0',
        z: z.toFixed(2),
        speed: currentSpeed.toFixed(2),
        speedLimit: '5',
        direction: direction.toFixed(2),
        isReversing: start.isReversing ? 'true' : 'false',
        gear: start.isReversing ? 'reverse' : 'forward',
        steeringAngle: (Math.random() * 30 - 15).toFixed(2),
        loadWeight: (step % 5 === 0 ? '800' : '0')
      });

      currentTime += timeStep;
    }
  }

  const headers = [
    'timestamp', 'forkliftId', 'x', 'y', 'z', 'speed', 'speedLimit',
    'direction', 'isReversing', 'gear', 'steeringAngle', 'loadWeight'
  ];

  const csvLines = [
    headers.join(','),
    ...points.map(p => headers.map(h => p[h]).join(','))
  ];

  return csvLines.join('\n');
}

export const sampleNearMissEvents = {
  version: "1.0",
  events: [
    {
      id: "nm_001",
      type: "near-miss",
      timestamp: new Date(2024, 0, 15, 9, 2, 30).getTime(),
      severity: "high",
      description: "与行人险些碰撞 - 叉车在转弯盲区未及时发现行人",
      location: { x: 15, y: 0, z: 18 },
      involvedEntities: [
        { type: "forklift", id: "FL-001", name: "叉车-001" },
        { type: "pedestrian", id: "P-001", name: "仓储员-张三" }
      ],
      evidence: {
        cameraFeeds: [
          { cameraId: "CAM-03", description: "A区转弯处摄像头视频片段", timestampOffset: -5 },
          { cameraId: "CAM-04", description: "叉车前置摄像头记录", timestampOffset: -2 }
        ],
        sensorData: {
          proximityAlert: true,
          brakeActivated: true
        }
      }
    },
    {
      id: "nm_002",
      type: "near-miss",
      timestamp: new Date(2024, 0, 15, 9, 8, 15).getTime(),
      severity: "medium",
      description: "接近临时托盘障碍物",
      location: { x: 25, y: 0, z: 18 },
      involvedEntities: [
        { type: "forklift", id: "FL-001", name: "叉车-001" },
        { type: "obstacle", id: "OBS-001", name: "临时托盘" }
      ],
      evidence: {
        cameraFeeds: [
          { cameraId: "CAM-05", description: "C区通道监控", timestampOffset: -3 }
        ]
      }
    }
  ]
};

export const sampleCameraAnnotations = {
  version: "1.0",
  cameras: [
    {
      id: "CAM-01",
      name: "A区入口",
      position: { x: 0, y: 5, z: 10 },
      rotation: { pan: 0, tilt: -30, roll: 0 },
      fov: 90,
      coverageArea: { radius: 20, angle: 120 },
      annotations: [
        {
          timestamp: new Date(2024, 0, 15, 9, 0, 5).getTime(),
          type: "object",
          label: "forklift",
          confidence: 0.95,
          position: { x: 5, y: 0, z: 5 }
        }
      ]
    },
    {
      id: "CAM-03",
      name: "A区转弯处",
      position: { x: 10, y: 6, z: 15 },
      rotation: { pan: 90, tilt: -45, roll: 0 },
      fov: 120,
      coverageArea: { radius: 15, angle: 90 },
      annotations: [
        {
          timestamp: new Date(2024, 0, 15, 9, 2, 28).getTime(),
          type: "object",
          label: "pedestrian",
          confidence: 0.88,
          position: { x: 15, y: 0, z: 18 }
        },
        {
          timestamp: new Date(2024, 0, 15, 9, 2, 30).getTime(),
          type: "object",
          label: "forklift",
          confidence: 0.92,
          position: { x: 14, y: 0, z: 17 }
        }
      ]
    },
    {
      id: "CAM-05",
      name: "C区通道",
      position: { x: 30, y: 5, z: 20 },
      rotation: { pan: -45, tilt: -30, roll: 0 },
      fov: 90,
      coverageArea: { radius: 18, angle: 100 },
      annotations: [
        {
          timestamp: new Date(2024, 0, 15, 9, 8, 10).getTime(),
          type: "object",
          label: "pallet",
          confidence: 0.85,
          position: { x: 25, y: 0, z: 18 }
        }
      ]
    }
  ]
};

export function loadAllSampleData() {
  return {
    shelves: sampleShelves,
    forkliftCSV: generateForkliftCSV(),
    nearMissEvents: sampleNearMissEvents,
    cameraAnnotations: sampleCameraAnnotations
  };
}

export default {
  sampleShelves,
  generateForkliftCSV,
  sampleNearMissEvents,
  sampleCameraAnnotations,
  loadAllSampleData
};
