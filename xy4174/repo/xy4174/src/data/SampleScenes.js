import { 
  Vector3, 
  HangingPoint, 
  Truss, 
  Device, 
  Obstacle, 
  Counterweight,
  SceneModel 
} from '../models/SceneModel.js';

class SampleScenes {
  constructor() {
  }

  createBasicStageScene() {
    const scene = new SceneModel();
    scene.name = '基础舞台场景';
    scene.description = '一个简单的舞台灯光吊装示例场景，包含主桁架和6台摇头灯';

    scene.stage.width = 16;
    scene.stage.depth = 12;
    scene.stage.position = new Vector3(0, 0, 0);

    const point1 = new HangingPoint();
    point1.name = '吊点A-左';
    point1.position = new Vector3(-4, 8, 0);
    point1.maxLoad = 1000;
    point1.safetyFactor = 5;
    point1.motorType = '1t';
    scene.addHangingPoint(point1);

    const point2 = new HangingPoint();
    point2.name = '吊点A-右';
    point2.position = new Vector3(4, 8, 0);
    point2.maxLoad = 1000;
    point2.safetyFactor = 5;
    point2.motorType = '1t';
    scene.addHangingPoint(point2);

    const truss1 = new Truss();
    truss1.name = '主桁架-A';
    truss1.position = new Vector3(0, 7, 0);
    truss1.length = 9;
    truss1.type = 'square';
    truss1.weightPerMeter = 18;
    scene.addTruss(truss1);

    scene.connectTrussToHangingPoint(truss1.id, point1.id);
    scene.connectTrussToHangingPoint(truss1.id, point2.id);

    const lightTypes = [
      { name: '摇头灯-1', subType: 'spot', weight: 15, power: 700, color: '#ffcc00' },
      { name: '摇头灯-2', subType: 'spot', weight: 15, power: 700, color: '#ffcc00' },
      { name: '摇头灯-3', subType: 'beam', weight: 12, power: 350, color: '#00ccff' },
      { name: '摇头灯-4', subType: 'beam', weight: 12, power: 350, color: '#00ccff' },
      { name: '摇头灯-5', subType: 'wash', weight: 18, power: 1000, color: '#ff66cc' },
      { name: '摇头灯-6', subType: 'wash', weight: 18, power: 1000, color: '#ff66cc' }
    ];

    const positions = [-3.5, -2.1, -0.7, 0.7, 2.1, 3.5];

    lightTypes.forEach((lightInfo, index) => {
      const device = new Device();
      device.name = lightInfo.name;
      device.type = 'light';
      device.subType = lightInfo.subType;
      device.weight = lightInfo.weight;
      device.power = lightInfo.power;
      device.color = lightInfo.color;
      device.dimensions = new Vector3(0.35, 0.6, 0.45);
      device.position = new Vector3(positions[index], 7.3, 0);
      scene.addDevice(device);
      scene.attachDeviceToTruss(device.id, truss1.id);
    });

    const curtain = new Obstacle();
    curtain.name = '背景幕布';
    curtain.type = 'curtain';
    curtain.position = new Vector3(0, 4, -5);
    curtain.dimensions = new Vector3(12, 8, 0.3);
    curtain.color = '#8844aa';
    curtain.clearanceRequired = 0.5;
    scene.addObstacle(curtain);

    return scene;
  }

  createComplexConcertScene() {
    const scene = new SceneModel();
    scene.name = '演唱会复杂场景';
    scene.description = '包含多个桁架、吊点、设备和障碍物的复杂演唱会吊装场景';

    scene.stage.width = 20;
    scene.stage.depth = 15;
    scene.stage.position = new Vector3(0, 0, 0);

    const hangingPointsData = [
      { name: '吊点-左前', pos: [-6, 9, 4], maxLoad: 1000, type: '1t' },
      { name: '吊点-左后', pos: [-6, 9, -4], maxLoad: 1000, type: '1t' },
      { name: '吊点-右前', pos: [6, 9, 4], maxLoad: 1000, type: '1t' },
      { name: '吊点-右后', pos: [6, 9, -4], maxLoad: 1000, type: '1t' },
      { name: '吊点-中前', pos: [0, 9, 5], maxLoad: 2000, type: '2t' },
      { name: '吊点-中后', pos: [0, 9, -5], maxLoad: 2000, type: '2t' }
    ];

    const hangingPoints = [];
    for (const hpData of hangingPointsData) {
      const point = new HangingPoint();
      point.name = hpData.name;
      point.position = new Vector3(hpData.pos[0], hpData.pos[1], hpData.pos[2]);
      point.maxLoad = hpData.maxLoad;
      point.motorType = hpData.type;
      scene.addHangingPoint(point);
      hangingPoints.push(point);
    }

    const trussesData = [
      { name: '前桁架', pos: [0, 8, 4], length: 12, points: [0, 2, 4] },
      { name: '后桁架', pos: [0, 8, -4], length: 12, points: [1, 3, 5] },
      { name: '左桁架', pos: [-5, 8, 0], length: 6, points: [0, 1] },
      { name: '右桁架', pos: [5, 8, 0], length: 6, points: [2, 3] }
    ];

    const trusses = [];
    for (const trussData of trussesData) {
      const truss = new Truss();
      truss.name = trussData.name;
      truss.position = new Vector3(trussData.pos[0], trussData.pos[1], trussData.pos[2]);
      truss.length = trussData.length;
      truss.weightPerMeter = 22;
      scene.addTruss(truss);
      
      for (const pointIdx of trussData.points) {
        scene.connectTrussToHangingPoint(truss.id, hangingPoints[pointIdx].id);
      }
      
      trusses.push(truss);
    }

    const lightPresets = [
      { name: 'LED摇头灯', type: 'spot', weight: 12, power: 500, color: '#ffdd00' },
      { name: '光束灯', type: 'beam', weight: 10, power: 300, color: '#00ddff' },
      { name: '染色灯', type: 'wash', weight: 15, power: 800, color: '#ff44dd' }
    ];

    const trussDevices = [
      { trussIdx: 0, count: 8, presetIdx: 0, spacing: 1.2 },
      { trussIdx: 1, count: 8, presetIdx: 1, spacing: 1.2 },
      { trussIdx: 2, count: 4, presetIdx: 2, spacing: 1.5 },
      { trussIdx: 3, count: 4, presetIdx: 2, spacing: 1.5 }
    ];

    let deviceNum = 1;
    for (const td of trussDevices) {
      const truss = trusses[td.trussIdx];
      const preset = lightPresets[td.presetIdx];
      const startPos = -truss.length / 2 + td.spacing / 2;
      
      for (let i = 0; i < td.count; i++) {
        const device = new Device();
        device.name = `${preset.name}-${deviceNum++}`;
        device.type = 'light';
        device.subType = preset.type;
        device.weight = preset.weight;
        device.power = preset.power;
        device.color = preset.color;
        device.dimensions = new Vector3(0.3, 0.55, 0.4);
        
        if (td.trussIdx === 0 || td.trussIdx === 1) {
          device.position = new Vector3(
            startPos + i * td.spacing,
            truss.position.y + 0.3,
            truss.position.z
          );
        } else {
          device.position = new Vector3(
            truss.position.x,
            truss.position.y + 0.3,
            startPos + i * td.spacing
          );
        }
        
        scene.addDevice(device);
        scene.attachDeviceToTruss(device.id, truss.id);
      }
    }

    const obstaclesData = [
      { name: '背景LED屏', type: 'screen', pos: [0, 3.5, -7], dim: [14, 7, 0.5], color: '#333333', clearance: 0.8 },
      { name: '左声道线阵列', type: 'speaker', pos: [-8.5, 5, 0], dim: [0.8, 2.5, 0.6], color: '#222222', clearance: 0.5 },
      { name: '右声道线阵列', type: 'speaker', pos: [8.5, 5, 0], dim: [0.8, 2.5, 0.6], color: '#222222', clearance: 0.5 },
      { name: '前排喷淋管', type: 'sprinkler', pos: [0, 9.5, 3], dim: [18, 0.1, 0.1], color: '#cc4444', clearance: 0.3 }
    ];

    for (const obsData of obstaclesData) {
      const obstacle = new Obstacle();
      obstacle.name = obsData.name;
      obstacle.type = obsData.type;
      obstacle.position = new Vector3(obsData.pos[0], obsData.pos[1], obsData.pos[2]);
      obstacle.dimensions = new Vector3(obsData.dim[0], obsData.dim[1], obsData.dim[2]);
      obstacle.color = obsData.color;
      obstacle.clearanceRequired = obsData.clearance;
      scene.addObstacle(obstacle);
    }

    return scene;
  }

  createOverloadWarningScene() {
    const scene = new SceneModel();
    scene.name = '超载警告示例';
    scene.description = '演示吊点超载和重心偏移的警告场景';

    scene.stage.width = 12;
    scene.stage.depth = 10;
    scene.stage.position = new Vector3(0, 0, 0);

    const point1 = new HangingPoint();
    point1.name = '吊点-左';
    point1.position = new Vector3(-3, 8, 0);
    point1.maxLoad = 200;
    point1.safetyFactor = 5;
    point1.motorType = '0.5t';
    scene.addHangingPoint(point1);

    const point2 = new HangingPoint();
    point2.name = '吊点-右';
    point2.position = new Vector3(3, 8, 0);
    point2.maxLoad = 500;
    point2.safetyFactor = 5;
    point2.motorType = '1t';
    scene.addHangingPoint(point2);

    const truss1 = new Truss();
    truss1.name = '测试桁架';
    truss1.position = new Vector3(0, 7, 0);
    truss1.length = 8;
    truss1.weightPerMeter = 15;
    scene.addTruss(truss1);

    scene.connectTrussToHangingPoint(truss1.id, point1.id);
    scene.connectTrussToHangingPoint(truss1.id, point2.id);

    for (let i = 0; i < 8; i++) {
      const device = new Device();
      device.name = `重设备-${i + 1}`;
      device.type = 'light';
      device.weight = 30;
      device.power = 1500;
      device.color = i < 5 ? '#ff4444' : '#ffaa00';
      device.dimensions = new Vector3(0.4, 0.6, 0.5);
      
      const posX = -3 + i * 0.85;
      device.position = new Vector3(posX, 7.3, 0);
      
      scene.addDevice(device);
      scene.attachDeviceToTruss(device.id, truss1.id);
    }

    return scene;
  }

  createCollisionTestScene() {
    const scene = new SceneModel();
    scene.name = '碰撞测试场景';
    scene.description = '演示设备碰撞和净空不足的测试场景';

    scene.stage.width = 14;
    scene.stage.depth = 10;
    scene.stage.position = new Vector3(0, 0, 0);

    const point1 = new HangingPoint();
    point1.name = '吊点-1';
    point1.position = new Vector3(-2, 8, 0);
    point1.maxLoad = 500;
    scene.addHangingPoint(point1);

    const point2 = new HangingPoint();
    point2.name = '吊点-2';
    point2.position = new Vector3(2, 8, 0);
    point2.maxLoad = 500;
    scene.addHangingPoint(point2);

    const truss1 = new Truss();
    truss1.name = '前桁架';
    truss1.position = new Vector3(0, 7, 2);
    truss1.length = 6;
    scene.addTruss(truss1);
    scene.connectTrussToHangingPoint(truss1.id, point1.id);
    scene.connectTrussToHangingPoint(truss1.id, point2.id);

    const truss2 = new Truss();
    truss2.name = '后桁架';
    truss2.position = new Vector3(0, 7, 1.5);
    truss2.length = 5;
    truss2.color = '#ff6666';
    scene.addTruss(truss2);

    for (let i = 0; i < 4; i++) {
      const device = new Device();
      device.name = `密集设备-${i + 1}`;
      device.type = 'light';
      device.weight = 15;
      device.color = '#ffcc00';
      device.dimensions = new Vector3(0.3, 0.5, 0.4);
      
      const posX = -1.5 + i * 0.9;
      device.position = new Vector3(posX, 7.3, 2);
      
      scene.addDevice(device);
      scene.attachDeviceToTruss(device.id, truss1.id);
    }

    const curtain = new Obstacle();
    curtain.name = '侧幕布';
    curtain.type = 'curtain';
    curtain.position = new Vector3(-3.5, 4, 2);
    curtain.dimensions = new Vector3(0.3, 8, 6);
    curtain.color = '#4488aa';
    curtain.clearanceRequired = 0.5;
    scene.addObstacle(curtain);

    const closeDevice = new Device();
    closeDevice.name = '靠近幕布的设备';
    closeDevice.type = 'light';
    closeDevice.weight = 20;
    closeDevice.color = '#ff44cc';
    closeDevice.dimensions = new Vector3(0.4, 0.6, 0.5);
    closeDevice.position = new Vector3(-3.2, 7.3, 2);
    scene.addDevice(closeDevice);
    scene.attachDeviceToTruss(closeDevice.id, truss1.id);

    const highDevice = new Device();
    highDevice.name = '超高设备';
    highDevice.type = 'light';
    highDevice.weight = 25;
    highDevice.color = '#ff4444';
    highDevice.dimensions = new Vector3(0.5, 2.5, 0.5);
    highDevice.position = new Vector3(2.5, 7.25, 2);
    scene.addDevice(highDevice);
    scene.attachDeviceToTruss(highDevice.id, truss1.id);

    return scene;
  }

  getSampleSceneList() {
    return [
      {
        id: 'basic',
        name: '基础舞台场景',
        description: '简单的舞台灯光吊装示例，适合入门学习',
        createFn: () => this.createBasicStageScene()
      },
      {
        id: 'complex',
        name: '演唱会复杂场景',
        description: '包含多个桁架和设备的真实演唱会配置',
        createFn: () => this.createComplexConcertScene()
      },
      {
        id: 'overload',
        name: '超载警告示例',
        description: '演示吊点超载和重心偏移的警告效果',
        createFn: () => this.createOverloadWarningScene()
      },
      {
        id: 'collision',
        name: '碰撞测试场景',
        description: '演示设备碰撞和净空不足的检测效果',
        createFn: () => this.createCollisionTestScene()
      }
    ];
  }

  getSampleSceneById(id) {
    const list = this.getSampleSceneList();
    const found = list.find(s => s.id === id);
    return found ? found.createFn() : null;
  }
}

const sampleScenes = new SampleScenes();

export {
  SampleScenes,
  sampleScenes
};
