import {
  Project,
  createProject,
  createTruss,
  createHoistPoint,
  createEquipment,
  createStageBoundary,
  createVector3,
} from '../models';

export function createBasicExample(): Project {
  const truss1 = createTruss({
    name: '主桁架 6m',
    type: 'box',
    length: 6,
    width: 0.5,
    height: 0.5,
    weightPerMeter: 12,
    position: createVector3(0, 5, 0),
    color: '#4a90d9',
  });

  const hoistPoint1 = createHoistPoint({
    name: '吊点 A (左)',
    position: createVector3(-2.5, 7, 0),
    maxLoad: 500,
    trussId: truss1.id,
    trussLocalPosition: createVector3(0.5, 0.25, 0),
    color: '#ff9800',
  });

  const hoistPoint2 = createHoistPoint({
    name: '吊点 B (右)',
    position: createVector3(2.5, 7, 0),
    maxLoad: 500,
    trussId: truss1.id,
    trussLocalPosition: createVector3(5.5, 0.25, 0),
    color: '#ff9800',
  });

  const equipment1 = createEquipment({
    name: 'LED Par 64 #1',
    type: 'light',
    weight: 8,
    dimensions: createVector3(0.3, 0.4, 0.3),
    position: createVector3(-1.5, 5.5, 0),
    trussId: truss1.id,
    trussLocalPosition: createVector3(1.5, 0.5, 0),
    color: '#ffeb3b',
  });

  const equipment2 = createEquipment({
    name: 'LED Par 64 #2',
    type: 'light',
    weight: 8,
    dimensions: createVector3(0.3, 0.4, 0.3),
    position: createVector3(1.5, 5.5, 0),
    trussId: truss1.id,
    trussLocalPosition: createVector3(4.5, 0.5, 0),
    color: '#ffeb3b',
  });

  const boundary1 = createStageBoundary({
    name: '舞台台口',
    type: 'proscenium',
    color: '#f44336',
  });

  const boundary2 = createStageBoundary({
    name: '地面',
    type: 'floor',
    color: '#4caf50',
  });

  return createProject({
    name: '基础桁架配置示例',
    description: '一个标准的6米双吊点桁架配置，两端各悬挂一个LED Par灯。',
    trusses: [truss1],
    hoistPoints: [hoistPoint1, hoistPoint2],
    equipment: [equipment1, equipment2],
    boundaries: [boundary1, boundary2],
  });
}

export function createUnbalanceExample(): Project {
  const truss1 = createTruss({
    name: '主桁架 8m',
    type: 'box',
    length: 8,
    width: 0.5,
    height: 0.5,
    weightPerMeter: 12,
    position: createVector3(0, 5, 0),
    color: '#4a90d9',
  });

  const hoistPoint1 = createHoistPoint({
    name: '吊点 A (左)',
    position: createVector3(-3.5, 7, 0),
    maxLoad: 500,
    trussId: truss1.id,
    trussLocalPosition: createVector3(0.5, 0.25, 0),
    color: '#ff9800',
  });

  const hoistPoint2 = createHoistPoint({
    name: '吊点 B (右)',
    position: createVector3(3.5, 7, 0),
    maxLoad: 500,
    trussId: truss1.id,
    trussLocalPosition: createVector3(7.5, 0.25, 0),
    color: '#ff9800',
  });

  const heavyEquipment = createEquipment({
    name: '大型线阵音箱组',
    type: 'speaker',
    weight: 150,
    dimensions: createVector3(1.2, 2.0, 0.6),
    position: createVector3(-2.5, 5.5, 0),
    trussId: truss1.id,
    trussLocalPosition: createVector3(1.5, 0.5, 0),
    color: '#9c27b0',
  });

  const lightEquipment = createEquipment({
    name: '小型摇头灯',
    type: 'light',
    weight: 15,
    dimensions: createVector3(0.35, 0.5, 0.4),
    position: createVector3(2.5, 5.5, 0),
    trussId: truss1.id,
    trussLocalPosition: createVector3(6.5, 0.5, 0),
    color: '#ffeb3b',
  });

  const boundary1 = createStageBoundary({
    name: '舞台台口',
    type: 'proscenium',
    color: '#f44336',
  });

  return createProject({
    name: '偏载警示示例',
    description: '此示例展示了严重偏载的情况 - 桁架左端悬挂重型音箱，右端只有轻量灯具。',
    trusses: [truss1],
    hoistPoints: [hoistPoint1, hoistPoint2],
    equipment: [heavyEquipment, lightEquipment],
    boundaries: [boundary1],
  });
}

export function createCollisionExample(): Project {
  const truss1 = createTruss({
    name: '背景桁架',
    type: 'box',
    length: 6,
    width: 0.5,
    height: 0.5,
    weightPerMeter: 12,
    position: createVector3(0, 4, 2),
    color: '#4a90d9',
  });

  const truss2 = createTruss({
    name: '面光桁架',
    type: 'box',
    length: 6,
    width: 0.5,
    height: 0.5,
    weightPerMeter: 12,
    position: createVector3(0, 5, -2),
    color: '#1976d2',
  });

  const hoistPoint1 = createHoistPoint({
    name: '背景桁架吊点左',
    position: createVector3(-2.5, 6, 2),
    maxLoad: 500,
    trussId: truss1.id,
    color: '#ff9800',
  });

  const hoistPoint2 = createHoistPoint({
    name: '背景桁架吊点右',
    position: createVector3(2.5, 6, 2),
    maxLoad: 500,
    trussId: truss1.id,
    color: '#ff9800',
  });

  const movingEquipment = createEquipment({
    name: '下降中的升降台',
    type: 'generic',
    weight: 100,
    dimensions: createVector3(2, 0.5, 2),
    position: createVector3(0, 0.5, 0),
    color: '#795548',
  });

  const boundary1 = createStageBoundary({
    name: '舞台台口',
    type: 'proscenium',
    color: '#f44336',
  });

  const boundary2 = createStageBoundary({
    name: '幕布位置',
    type: 'curtain',
    vertices: [
      createVector3(-5, 0, -0.5),
      createVector3(5, 0, -0.5),
      createVector3(5, 6, -0.5),
      createVector3(-5, 6, -0.5),
    ],
    color: '#e91e63',
  });

  return createProject({
    name: '碰撞检测示例',
    description: '此示例展示了设备与边界的潜在碰撞问题 - 升降台可能扫到幕布。',
    trusses: [truss1, truss2],
    hoistPoints: [hoistPoint1, hoistPoint2],
    equipment: [movingEquipment],
    boundaries: [boundary1, boundary2],
  });
}

export function createFullShowExample(): Project {
  const trussBack = createTruss({
    name: '背景桁架 (8m)',
    type: 'box',
    length: 8,
    width: 0.5,
    height: 0.5,
    weightPerMeter: 12,
    position: createVector3(0, 5, 4),
    color: '#4a90d9',
  });

  const trussFront = createTruss({
    name: '面光桁架 (8m)',
    type: 'box',
    length: 8,
    width: 0.5,
    height: 0.5,
    weightPerMeter: 12,
    position: createVector3(0, 6, -4),
    color: '#1976d2',
  });

  const trussSideLeft = createTruss({
    name: '侧光桁架 (5m)',
    type: 'triangular',
    length: 5,
    width: 0.3,
    height: 0.4,
    weightPerMeter: 8,
    position: createVector3(-5, 4.5, 0),
    color: '#0288d1',
  });

  const trussSideRight = createTruss({
    name: '侧光桁架 (5m)',
    type: 'triangular',
    length: 5,
    width: 0.3,
    height: 0.4,
    weightPerMeter: 8,
    position: createVector3(5, 4.5, 0),
    color: '#0288d1',
  });

  const hoistBackLeft = createHoistPoint({
    name: '背景左吊点',
    position: createVector3(-3.5, 7.5, 4),
    maxLoad: 1000,
    trussId: trussBack.id,
    color: '#ff9800',
  });

  const hoistBackRight = createHoistPoint({
    name: '背景右吊点',
    position: createVector3(3.5, 7.5, 4),
    maxLoad: 1000,
    trussId: trussBack.id,
    color: '#ff9800',
  });

  const hoistFrontLeft = createHoistPoint({
    name: '面光左吊点',
    position: createVector3(-3.5, 8, -4),
    maxLoad: 1000,
    trussId: trussFront.id,
    color: '#ff5722',
  });

  const hoistFrontRight = createHoistPoint({
    name: '面光右吊点',
    position: createVector3(3.5, 8, -4),
    maxLoad: 1000,
    trussId: trussFront.id,
    color: '#ff5722',
  });

  const ledPanel1 = createEquipment({
    name: 'LED屏 #1',
    type: 'led',
    weight: 80,
    dimensions: createVector3(3, 2, 0.15),
    position: createVector3(-1.25, 3.5, 4.5),
    trussId: trussBack.id,
    color: '#00bcd4',
  });

  const ledPanel2 = createEquipment({
    name: 'LED屏 #2',
    type: 'led',
    weight: 80,
    dimensions: createVector3(3, 2, 0.15),
    position: createVector3(1.25, 3.5, 4.5),
    trussId: trussBack.id,
    color: '#00bcd4',
  });

  const lights = [];
  for (let i = 0; i < 6; i++) {
    const x = -3 + i * 1.2;
    lights.push(
      createEquipment({
        name: `LED Par 64 #${i + 1}`,
        type: 'light',
        weight: 8,
        dimensions: createVector3(0.3, 0.4, 0.3),
        position: createVector3(x, 6.5, -4),
        trussId: trussFront.id,
        color: '#ffeb3b',
      })
    );
  }

  const movingHead1 = createEquipment({
    name: '摇头灯 #1',
    type: 'light',
    weight: 25,
    dimensions: createVector3(0.4, 0.6, 0.4),
    position: createVector3(-2, 5.5, 0),
    trussId: trussSideLeft.id,
    color: '#ffc107',
  });

  const movingHead2 = createEquipment({
    name: '摇头灯 #2',
    type: 'light',
    weight: 25,
    dimensions: createVector3(0.4, 0.6, 0.4),
    position: createVector3(2, 5.5, 0),
    trussId: trussSideRight.id,
    color: '#ffc107',
  });

  const boundaryProscenium = createStageBoundary({
    name: '舞台台口',
    type: 'proscenium',
    vertices: [
      createVector3(-7, 0, 0),
      createVector3(7, 0, 0),
      createVector3(7, 6.5, 0),
      createVector3(-7, 6.5, 0),
    ],
    color: '#f44336',
  });

  const boundaryFloor = createStageBoundary({
    name: '舞台地面',
    type: 'floor',
    vertices: [
      createVector3(-8, 0, -6),
      createVector3(8, 0, -6),
      createVector3(8, 0, 6),
      createVector3(-8, 0, 6),
    ],
    color: '#4caf50',
  });

  const boundaryCurtain = createStageBoundary({
    name: '大幕位置',
    type: 'curtain',
    vertices: [
      createVector3(-7, 0, 0.5),
      createVector3(7, 0, 0.5),
      createVector3(7, 7, 0.5),
      createVector3(-7, 7, 0.5),
    ],
    color: '#e91e63',
  });

  return createProject({
    name: '完整演出场景示例',
    description: '一个完整的演出场景配置，包含背景桁架、面光桁架、侧光桁架，以及LED屏、Par灯、摇头灯等设备。',
    trusses: [trussBack, trussFront, trussSideLeft, trussSideRight],
    hoistPoints: [hoistBackLeft, hoistBackRight, hoistFrontLeft, hoistFrontRight],
    equipment: [ledPanel1, ledPanel2, ...lights, movingHead1, movingHead2],
    boundaries: [boundaryProscenium, boundaryFloor, boundaryCurtain],
  });
}

export function createOverloadExample(): Project {
  const truss1 = createTruss({
    name: '重载桁架 6m',
    type: 'box',
    length: 6,
    width: 0.5,
    height: 0.5,
    weightPerMeter: 15,
    position: createVector3(0, 5, 0),
    color: '#4a90d9',
  });

  const hoistPoint1 = createHoistPoint({
    name: '吊点 A (额定300kg)',
    position: createVector3(-2.5, 7, 0),
    maxLoad: 300,
    trussId: truss1.id,
    color: '#ff9800',
  });

  const hoistPoint2 = createHoistPoint({
    name: '吊点 B (额定300kg)',
    position: createVector3(2.5, 7, 0),
    maxLoad: 300,
    trussId: truss1.id,
    color: '#ff9800',
  });

  const heavyArray = createEquipment({
    name: '大型线阵音箱组',
    type: 'speaker',
    weight: 400,
    dimensions: createVector3(2.5, 3, 0.8),
    position: createVector3(0, 5.5, 0),
    trussId: truss1.id,
    color: '#9c27b0',
  });

  return createProject({
    name: '超载警示示例',
    description: '此示例展示了吊点超载的情况 - 两个额定300kg的吊点悬挂了总重量超过600kg的设备。',
    trusses: [truss1],
    hoistPoints: [hoistPoint1, hoistPoint2],
    equipment: [heavyArray],
    boundaries: [],
  });
}

export const exampleProjects = [
  {
    id: 'basic',
    name: '基础桁架配置',
    description: '标准双吊点桁架配置',
    create: createBasicExample,
  },
  {
    id: 'unbalance',
    name: '偏载警示示例',
    description: '展示严重偏载的情况',
    create: createUnbalanceExample,
  },
  {
    id: 'collision',
    name: '碰撞检测示例',
    description: '设备与边界潜在碰撞',
    create: createCollisionExample,
  },
  {
    id: 'full',
    name: '完整演出场景',
    description: '多桁架多设备完整配置',
    create: createFullShowExample,
  },
  {
    id: 'overload',
    name: '超载警示示例',
    description: '吊点超载情况演示',
    create: createOverloadExample,
  },
];
