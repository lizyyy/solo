export const DEFAULT_CONFIG = {
  room: {
    width: 20,
    depth: 15,
    height: 3
  },
  sensor: {
    radius: 5,
    minDistance: 2,
    maxDistance: 8,
    height: 2.5
  },
  heatmap: {
    resolution: 0.5,
    colors: [
      { value: 0, color: [0, 0, 0.3] },
      { value: 0.5, color: [0, 0.8, 1] },
      { value: 1, color: [1, 0, 0.5] }
    ]
  },
  camera: {
    initialPosition: { x: 15, y: 20, z: 20 },
    target: { x: 10, y: 0, z: 7.5 }
  }
};

export const COLORS = {
  background: 0x0a0a15,
  floor: 0x1a2a3a,
  wall: 0x2a3a4a,
  grid: 0x333355,
  sensor: 0x00d9ff,
  sensorSelected: 0xff00ff,
  coverageSphere: 0x00d9ff,
  heatmapLow: 0x000080,
  heatmapMid: 0x00ccff,
  heatmapHigh: 0xff0088,
  warning: 0xf59e0b,
  error: 0xef4444,
  success: 0x22c55e
};
