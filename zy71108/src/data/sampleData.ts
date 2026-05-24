import { SceneData } from '../types';

type SceneDataWithoutValidation = Omit<SceneData, 'validation'>;

function generateHeightmap(width: number, depth: number): number[][] {
  const heightmap: number[][] = [];
  const centerX = width / 2;
  const centerZ = depth / 2;
  
  for (let z = 0; z < depth; z++) {
    heightmap[z] = [];
    for (let x = 0; x < width; x++) {
      const distFromTop = z / depth;
      const distFromCenter = Math.abs(x - centerX) / centerX;
      
      let height = distFromTop * 30;
      height += Math.sin(x * 0.3) * 3;
      height += Math.cos(z * 0.2) * 2;
      height -= distFromCenter * distFromCenter * 5;
      
      if (x > width * 0.3 && x < width * 0.4 && z > depth * 0.4 && z < depth * 0.6) {
        height += 5;
      }
      if (x > width * 0.6 && x < width * 0.7 && z > depth * 0.2 && z < depth * 0.4) {
        height -= 3;
      }
      
      heightmap[z][x] = Math.max(0, height);
    }
  }
  return heightmap;
}

function generateTrajectory(
  id: string,
  name: string,
  color: string,
  startX: number,
  startZ: number,
  endX: number,
  endZ: number,
  points: number
) {
  const trajectoryPoints = [];
  for (let i = 0; i < points; i++) {
    const t = i / (points - 1);
    const wobble = Math.sin(t * Math.PI * 3) * 8;
    trajectoryPoints.push({
      x: startX + (endX - startX) * t + wobble,
      y: 0,
      z: startZ + (endZ - startZ) * t,
      timestamp: i * 500,
      speed: 15 + Math.random() * 20
    });
  }
  return {
    id,
    skierName: name,
    points: trajectoryPoints,
    color
  };
}

const sampleSceneDataWithoutValidation: SceneDataWithoutValidation = {
  terrain: {
    heightmap: generateHeightmap(50, 80),
    width: 100,
    depth: 160,
    scale: 2,
    unit: 'meter'
  },
  trajectories: [
    generateTrajectory('t1', '张三', '#165DFF', 30, 10, 70, 150, 40),
    generateTrajectory('t2', '李四', '#722ED1', 50, 10, 20, 150, 35),
    generateTrajectory('t3', '王五', '#0FC6C2', 70, 10, 40, 150, 45)
  ],
  fallPoints: [
    {
      id: 'f1',
      position: { x: 45, y: 0, z: 80 },
      timestamp: '2024-01-15 10:32:15',
      severity: 'high',
      description: '高速转弯失控摔倒，疑似腿部受伤',
      skierName: '张三'
    },
    {
      id: 'f2',
      position: { x: 35, y: 0, z: 120 },
      timestamp: '2024-01-15 11:05:42',
      severity: 'medium',
      description: '与其他滑雪者轻微碰撞',
      skierName: '李四'
    },
    {
      id: 'f3',
      position: { x: 55, y: 0, z: 60 },
      timestamp: '2024-01-15 09:45:08',
      severity: 'low',
      description: '初级道减速摔倒，无大碍',
      skierName: '王五'
    }
  ],
  rescueStations: [
    {
      id: 'r1',
      name: '一号救援站',
      position: { x: 10, y: 0, z: 20 },
      responseTime: 3,
      personnel: 4
    },
    {
      id: 'r2',
      name: '二号救援站',
      position: { x: 90, y: 0, z: 100 },
      responseTime: 5,
      personnel: 3
    }
  ],
  riskZones: [
    {
      id: 'rz1',
      name: '高级道陡坡区',
      level: 'high',
      polygon: [
        { x: 35, y: 0, z: 30 },
        { x: 55, y: 0, z: 30 },
        { x: 60, y: 0, z: 70 },
        { x: 30, y: 0, z: 70 }
      ],
      isClosed: false,
      reason: '坡度超过35度，仅适合高级滑雪者'
    },
    {
      id: 'rz2',
      name: '冰面区域',
      level: 'high',
      polygon: [
        { x: 20, y: 0, z: 90 },
        { x: 45, y: 0, z: 90 },
        { x: 40, y: 0, z: 130 },
        { x: 15, y: 0, z: 130 }
      ],
      isClosed: true,
      reason: '气温骤降形成冰面，暂时关闭进行处理'
    },
    {
      id: 'rz3',
      name: '交汇区',
      level: 'medium',
      polygon: [
        { x: 60, y: 0, z: 50 },
        { x: 85, y: 0, z: 50 },
        { x: 80, y: 0, z: 90 },
        { x: 55, y: 0, z: 90 }
      ],
      isClosed: false,
      reason: '多条雪道交汇，人流量大'
    },
    {
      id: 'rz4',
      name: '初级练习区',
      level: 'low',
      polygon: [
        { x: 5, y: 0, z: 120 },
        { x: 25, y: 0, z: 120 },
        { x: 20, y: 0, z: 155 },
        { x: 0, y: 0, z: 155 }
      ],
      isClosed: false,
      reason: '坡度平缓，适合初学者'
    }
  ],
  rescueRoutes: [
    {
      id: 'route1',
      name: '救援路线A',
      points: [
        { x: 10, y: 0, z: 20 },
        { x: 25, y: 0, z: 50 },
        { x: 45, y: 0, z: 80 }
      ],
      fromStation: '一号救援站',
      toPoint: 'f1',
      estimatedTime: 4,
      color: '#F53F3F'
    },
    {
      id: 'route2',
      name: '救援路线B',
      points: [
        { x: 90, y: 0, z: 100 },
        { x: 70, y: 0, z: 110 },
        { x: 35, y: 0, z: 120 }
      ],
      fromStation: '二号救援站',
      toPoint: 'f2',
      estimatedTime: 6,
      color: '#FF7D00'
    }
  ],
  weather: {
    condition: 'cloudy',
    temperature: -5,
    windSpeed: 12,
    visibility: 800,
    timestamp: '2024-01-15 11:30:00'
  }
};

export const sampleSceneData: SceneData = {
  ...sampleSceneDataWithoutValidation,
  validation: {
    isValid: true,
    errors: []
  }
};

export default sampleSceneData;
