import * as THREE from 'three';
import { SimulationScheme } from '../types';

const generateCircularTrajectory = (radius: number, points: number) => {
  const trajectory = [];
  for (let i = 0; i < points; i++) {
    const angle = (i / points) * Math.PI * 2;
    trajectory.push({
      position: new THREE.Vector3(
        Math.cos(angle) * radius + 5,
        Math.sin(angle) * radius * 0.5,
        0
      ),
      velocity: new THREE.Vector3(),
      timestamp: i * 0.1,
    });
  }
  return trajectory;
};

const generateSpiralTrajectory = (startRadius: number, endRadius: number, points: number) => {
  const trajectory = [];
  for (let i = 0; i < points; i++) {
    const t = i / points;
    const radius = startRadius + (endRadius - startRadius) * t;
    const angle = t * Math.PI * 4;
    trajectory.push({
      position: new THREE.Vector3(
        Math.cos(angle) * radius + 5,
        Math.sin(angle) * radius * 0.5,
        t * 2 - 1
      ),
      velocity: new THREE.Vector3(),
      timestamp: i * 0.1,
    });
  }
  return trajectory;
};

const generateDivergentTrajectory = (points: number) => {
  const trajectory = [];
  let x = 5, y = 0, z = 0;
  for (let i = 0; i < points; i++) {
    const t = i / points;
    const divergence = t > 0.3 ? (t - 0.3) * 2 : 0;
    x += (Math.random() - 0.3) * 0.1 + divergence * 0.5;
    y += (Math.random() - 0.5) * 0.1;
    z += (Math.random() - 0.5) * 0.1 + divergence * 0.3;
    trajectory.push({
      position: new THREE.Vector3(x, y, z),
      velocity: new THREE.Vector3(),
      timestamp: i * 0.1,
    });
  }
  return trajectory;
};

export const presetSchemes: Omit<SimulationScheme, 'id' | 'createdAt'>[] = [
  {
    name: '样例1: 基准姿态 - 圆形轨道',
    attitude: {
      alpha: 0,
      beta: 0,
      gamma: 0,
      unit: 'deg',
    },
    radiationPressure: {
      direction: new THREE.Vector3(-1, 0, 0),
      magnitude: 0.008,
      isReversed: false,
    },
    trajectory: generateCircularTrajectory(3, 200),
    conclusion: 'consistent',
    evidenceLog: [
      {
        timestamp: 0,
        type: 'conclusion',
        description: '初始姿态设置完成，光压方向正确',
        data: { attitude: { alpha: 0, beta: 0, gamma: 0 }, pressureReversed: false },
      },
      {
        timestamp: 5,
        type: 'trajectory-event',
        description: '轨迹稳定，符合预期圆形轨道',
        data: { stability: 0.95 },
      },
    ],
  },
  {
    name: '样例2: 30°倾角 - 螺旋推进',
    attitude: {
      alpha: 30,
      beta: 15,
      gamma: 0,
      unit: 'deg',
    },
    radiationPressure: {
      direction: new THREE.Vector3(-1, 0, 0),
      magnitude: 0.006,
      isReversed: false,
    },
    trajectory: generateSpiralTrajectory(2, 6, 300),
    conclusion: 'consistent',
    evidenceLog: [
      {
        timestamp: 0,
        type: 'attitude-change',
        description: '设置俯仰角30°，偏航角15°',
        data: { old: { alpha: 0 }, new: { alpha: 30, beta: 15 } },
      },
      {
        timestamp: 10,
        type: 'trajectory-event',
        description: '轨迹呈螺旋状向外扩展，符合光压推进预期',
        data: { expansionRate: 0.8 },
      },
    ],
    hasUnitError: false,
    hasPressureReverse: false,
  },
  {
    name: '样例3: 角度混淆 + 光压反向 - 发散延迟',
    attitude: {
      alpha: 180,
      beta: 90,
      gamma: 45,
      unit: 'rad',
    },
    radiationPressure: {
      direction: new THREE.Vector3(1, 0, 0),
      magnitude: 0.01,
      isReversed: true,
    },
    trajectory: generateDivergentTrajectory(250),
    conclusion: 'inconsistent',
    evidenceLog: [
      {
        timestamp: 0,
        type: 'attitude-change',
        description: '⚠️ 角度单位设置异常：使用弧度但数值过大',
        data: { attitude: { alpha: 180, unit: 'rad' }, warning: '可能混淆了角度单位' },
      },
      {
        timestamp: 0,
        type: 'pressure-calc',
        description: '⚠️ 光压方向已反向设置',
        data: { isReversed: true, warning: '光压推力方向与预期相反' },
      },
      {
        timestamp: 8,
        type: 'trajectory-event',
        description: '检测到轨迹开始发散，到达目标延迟',
        data: { divergenceStart: 8, expectedArrival: 15, actualArrival: '未到达' },
      },
    ],
    hasUnitError: true,
    hasPressureReverse: true,
    divergenceTime: 8,
    arrivalDelay: 999,
  },
];

export const guideSteps = [
  {
    title: '第一步：加载样例',
    description: '点击右侧方案列表中的样例，或直接开始调节参数。建议先加载"样例1"了解基本操作。',
    icon: 'play',
  },
  {
    title: '第二步：调节姿态',
    description: '使用左侧控制面板的滑块调节太阳帆的俯仰角(α)、偏航角(β)、滚转角(γ)。注意观察3D视图中太阳帆的变化。',
    icon: 'sliders',
  },
  {
    title: '第三步：运行模拟',
    description: '点击"开始模拟"按钮，观察航天器在光压作用下的轨迹变化。可以调节时间速度来快进或慢放。',
    icon: 'rocket',
  },
  {
    title: '第四步：保存方案',
    description: '点击"保存方案"将当前设置保存到本地。你可以保存多组方案进行对比分析。',
    icon: 'save',
  },
  {
    title: '第五步：查看详情',
    description: '点击方案卡片查看详细证据链，包括姿态变更记录、光压计算、轨迹事件时序。导出截图用于报告。',
    icon: 'search',
  },
];
