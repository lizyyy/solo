import * as THREE from 'three';
import { DeviceTypes } from '../models/Device.js';

export const ProblemTypes = {
  OVERLOAD: 'overload',
  LOAD_IMBALANCE: 'load_imbalance',
  COLLISION: 'collision',
  LIGHT_OCCLUSION: 'light_occlusion',
  CLEARANCE_VIOLATION: 'clearance_violation',
  WALKING_HEIGHT: 'walking_height',
  UNSUPPORTED_DEVICE: 'unsupported_device'
};

export class CollisionDetector {
  constructor(stage) {
    this.stage = stage;
    this.problems = [];
  }
  
  checkAll(loadData) {
    this.problems = [];
    
    this.checkOverloads(loadData);
    this.checkLoadImbalance(loadData);
    this.checkDeviceCollisions();
    this.checkLightOcclusions();
    this.checkClearanceViolations();
    this.checkWalkingHeight();
    this.checkUnsupportedDevices();
    
    return this.problems;
  }
  
  checkOverloads(loadData) {
    for (const hoistId in loadData.hoistPoints) {
      const hoistData = loadData.hoistPoints[hoistId];
      const ratio = hoistData.load / hoistData.maxLoad;
      
      if (ratio > 1) {
        this.problems.push({
          type: ProblemTypes.OVERLOAD,
          severity: 'danger',
          objectId: hoistId,
          objectType: 'hoistPoint',
          position: this.getHoistPointPosition(hoistId),
          currentLoad: hoistData.load,
          maxLoad: hoistData.maxLoad,
          ratio: ratio,
          message: `吊点超载: ${hoistData.load.toFixed(1)}kg / ${hoistData.maxLoad}kg`,
          recommendation: '建议：移除此吊点上的部分设备，或分散载荷到其他吊点'
        });
      } else if (ratio > 0.85) {
        this.problems.push({
          type: ProblemTypes.OVERLOAD,
          severity: 'warning',
          objectId: hoistId,
          objectType: 'hoistPoint',
          position: this.getHoistPointPosition(hoistId),
          currentLoad: hoistData.load,
          maxLoad: hoistData.maxLoad,
          ratio: ratio,
          message: `吊点载荷接近上限: ${hoistData.load.toFixed(1)}kg / ${hoistData.maxLoad}kg`,
          recommendation: '建议：考虑增加额外的支撑点或重新分配载荷'
        });
      }
    }
  }
  
  checkLoadImbalance(loadData) {
    const hoistPoints = Object.values(loadData.hoistPoints);
    const loadedHoists = hoistPoints.filter(hp => hp.load > 0);
    
    if (loadedHoists.length < 2) return;
    
    const totalLoad = loadedHoists.reduce((sum, hp) => sum + hp.load, 0);
    const averageLoad = totalLoad / loadedHoists.length;
    
    for (const hp of loadedHoists) {
      const deviation = Math.abs(hp.load - averageLoad) / averageLoad;
      
      if (deviation > 0.5) {
        const hoistId = Object.keys(loadData.hoistPoints).find(
          key => loadData.hoistPoints[key] === hp
        );
        
        this.problems.push({
          type: ProblemTypes.LOAD_IMBALANCE,
          severity: 'warning',
          objectId: hoistId,
          objectType: 'hoistPoint',
          position: this.getHoistPointPosition(hoistId),
          load: hp.load,
          averageLoad: averageLoad,
          deviation: deviation,
          message: `吊点载荷分布不均: 偏差${(deviation * 100).toFixed(0)}%`,
          recommendation: '建议：重新分配设备位置，使载荷更均匀分布'
        });
      }
    }
  }
  
  checkDeviceCollisions() {
    const devices = this.stage.devices;
    
    for (let i = 0; i < devices.length; i++) {
      for (let j = i + 1; j < devices.length; j++) {
        const device1 = devices[i];
        const device2 = devices[j];
        
        const box1 = device1.getSafetyBoundingBox();
        const box2 = device2.getSafetyBoundingBox();
        
        if (box1.intersectsBox(box2)) {
          const actualBox1 = device1.getBoundingBox();
          const actualBox2 = device2.getBoundingBox();
          
          const isActualCollision = actualBox1.intersectsBox(actualBox2);
          
          this.problems.push({
            type: ProblemTypes.COLLISION,
            severity: isActualCollision ? 'danger' : 'warning',
            objectId: device1.userData.id,
            objectType: 'device',
            relatedObjectId: device2.userData.id,
            position: {
              x: (device1.userData.position.x + device2.userData.position.x) / 2,
              y: (device1.userData.position.y + device2.userData.position.y) / 2,
              z: (device1.userData.position.z + device2.userData.position.z) / 2
            },
            device1: {
              id: device1.userData.id,
              name: device1.userData.name,
              position: { ...device1.userData.position }
            },
            device2: {
              id: device2.userData.id,
              name: device2.userData.name,
              position: { ...device2.userData.position }
            },
            isActualCollision: isActualCollision,
            message: isActualCollision 
              ? `设备碰撞: ${device1.userData.name} 与 ${device2.userData.name}`
              : `安全间距不足: ${device1.userData.name} 与 ${device2.userData.name}`,
            recommendation: '建议：调整设备位置，确保有足够的安全间距'
          });
        }
      }
    }
  }
  
  checkLightOcclusions() {
    const lights = this.stage.devices.filter(
      d => d.userData.deviceType === DeviceTypes.LIGHT
    );
    const screens = this.stage.devices.filter(
      d => d.userData.deviceType === DeviceTypes.SCREEN
    );
    
    for (const light of lights) {
      const lightPos = new THREE.Vector3(
        light.userData.position.x,
        light.userData.position.y,
        light.userData.position.z
      );
      
      const lightDirection = new THREE.Vector3(
        0, -1, 0
      );
      lightDirection.applyQuaternion(light.quaternion);
      
      for (const screen of screens) {
        const screenPos = new THREE.Vector3(
          screen.userData.position.x,
          screen.userData.position.y,
          screen.userData.position.z
        );
        
        const toScreen = screenPos.clone().sub(lightPos);
        const dot = toScreen.dot(lightDirection);
        
        if (dot > 0) {
          const screenBox = screen.getBoundingBox();
          const lightRay = new THREE.Ray(lightPos, lightDirection);
          
          if (lightRay.intersectsBox(screenBox)) {
            this.problems.push({
              type: ProblemTypes.LIGHT_OCCLUSION,
              severity: 'warning',
              objectId: light.userData.id,
              objectType: 'device',
              relatedObjectId: screen.userData.id,
              position: { ...light.userData.position },
              light: {
                id: light.userData.id,
                name: light.userData.name
              },
              screen: {
                id: screen.userData.id,
                name: screen.userData.name
              },
              message: `灯光照射路径被幕布遮挡: ${light.userData.name} 照射 ${screen.userData.name}`,
              recommendation: '建议：调整灯光角度或位置，避免直接照射幕布'
            });
          }
        }
      }
    }
  }
  
  checkClearanceViolations() {
    const settings = this.stage.userData.settings;
    const stageWidth = settings.width;
    const stageDepth = settings.depth;
    const stageHeight = settings.height;
    
    for (const device of this.stage.devices) {
      const box = device.getSafetyBoundingBox();
      
      const halfWidth = stageWidth / 2;
      const halfDepth = stageDepth / 2;
      
      if (box.min.x < -halfWidth || box.max.x > halfWidth ||
          box.min.z < -halfDepth || box.max.z > halfDepth ||
          box.max.y > stageHeight) {
        
        this.problems.push({
          type: ProblemTypes.CLEARANCE_VIOLATION,
          severity: 'warning',
          objectId: device.userData.id,
          objectType: 'device',
          position: { ...device.userData.position },
          device: {
            id: device.userData.id,
            name: device.userData.name
          },
          message: `设备超出舞台边界: ${device.userData.name}`,
          recommendation: '建议：将设备移至舞台范围内'
        });
      }
    }
  }
  
  checkWalkingHeight() {
    const minWalkingHeight = 2.0;
    const settings = this.stage.userData.settings;
    
    for (const device of this.stage.devices) {
      if (device.userData.mountingMode !== 'floor_standing') continue;
      
      const box = device.getSafetyBoundingBox();
      
      if (box.max.y > minWalkingHeight) {
        continue;
      }
      
      if (Math.abs(device.userData.position.x) > settings.width * 0.4 &&
          Math.abs(device.userData.position.z) > settings.depth * 0.3) {
        continue;
      }
      
      this.problems.push({
        type: ProblemTypes.WALKING_HEIGHT,
        severity: 'warning',
        objectId: device.userData.id,
        objectType: 'device',
        position: { ...device.userData.position },
        device: {
          id: device.userData.id,
          name: device.userData.name
        },
        currentHeight: box.max.y,
        requiredHeight: minWalkingHeight,
        message: `人员通道净空不足: ${device.userData.name} 高度仅 ${box.max.y.toFixed(1)}m`,
        recommendation: '建议：抬高设备或移至非通道区域，确保人员通行高度不低于2米'
      });
    }
  }
  
  checkUnsupportedDevices() {
    for (const device of this.stage.devices) {
      if (!device.userData.attachedTo && 
          device.userData.mountingMode !== 'floor_standing') {
        
        this.problems.push({
          type: ProblemTypes.UNSUPPORTED_DEVICE,
          severity: 'warning',
          objectId: device.userData.id,
          objectType: 'device',
          position: { ...device.userData.position },
          device: {
            id: device.userData.id,
            name: device.userData.name
          },
          message: `设备未挂载到任何支撑点: ${device.userData.name}`,
          recommendation: '建议：将设备挂载到吊点或横杆上，或设置为地面放置'
        });
      }
    }
  }
  
  getHoistPointPosition(hoistId) {
    const hoistPoint = this.stage.getHoistPointById(hoistId);
    if (hoistPoint) {
      return {
        x: hoistPoint.userData.x,
        y: hoistPoint.position.y,
        z: hoistPoint.userData.z
      };
    }
    return { x: 0, y: 0, z: 0 };
  }
  
  getProblems() {
    return [...this.problems];
  }
  
  getProblemsBySeverity(severity) {
    return this.problems.filter(p => p.severity === severity);
  }
  
  getProblemsByType(type) {
    return this.problems.filter(p => p.type === type);
  }
  
  getProblemsForObject(objectId) {
    return this.problems.filter(
      p => p.objectId === objectId || p.relatedObjectId === objectId
    );
  }
}
