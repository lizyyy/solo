import * as THREE from 'three';

export class AnimationController {
  constructor(sceneManager, dataLoader) {
    this.sceneManager = sceneManager;
    this.dataLoader = dataLoader;
    this.activeLoads = new Map();
    
    this.cranePositions = {
      'crane_001': { x: 0, y: 0, z: 0 },
      'crane_002': { x: -25, y: 0, z: 0 }
    };
  }

  updateScene(timeData) {
    const { currentTime, progress, dateTime } = timeData;
    
    this.updateActiveLifts(dateTime);
  }

  updateActiveLifts(currentDateTime) {
    const liftPlan = this.dataLoader.liftPlan;
    if (!liftPlan) return;
    
    liftPlan.forEach(lift => {
      if (!lift.start_time || !lift.end_time) return;
      
      const isActive = currentDateTime >= lift.start_time && currentDateTime <= lift.end_time;
      const hasStarted = currentDateTime >= lift.start_time;
      const hasEnded = currentDateTime > lift.end_time;
      
      if (isActive) {
        const progress = this.calculateLiftProgress(lift, currentDateTime);
        this.animateLift(lift, progress);
      } else if (hasEnded && this.activeLoads.has(lift.lift_id)) {
        this.showLoadAtEndPosition(lift);
      } else if (!hasStarted && !this.activeLoads.has(lift.lift_id)) {
        this.showLoadAtStartPosition(lift);
      }
    });
  }

  calculateLiftProgress(lift, currentDateTime) {
    if (!lift.start_time || !lift.end_time) return 0;
    
    const totalDuration = lift.end_time.getTime() - lift.start_time.getTime();
    const elapsed = currentDateTime.getTime() - lift.start_time.getTime();
    
    return Math.max(0, Math.min(1, elapsed / totalDuration));
  }

  animateLift(lift, progress) {
    const craneId = lift.crane_id;
    const cranePos = this.cranePositions[craneId] || { x: 0, y: 0, z: 0 };
    
    const currentPos = this.lerpPosition(
      lift.start_position,
      lift.end_position,
      this.easeInOutQuad(progress)
    );
    
    const radius = Math.sqrt(
      Math.pow(currentPos.x - cranePos.x, 2) +
      Math.pow(currentPos.z - cranePos.z, 2)
    );
    
    const boomLength = lift.boom_length || 48;
    const maxHeight = boomLength * 0.8;
    const height = progress < 0.5 
      ? this.easeOutQuad(progress * 2) * maxHeight
      : (1 - this.easeInQuad((progress - 0.5) * 2)) * maxHeight + (currentPos.y || 0);
    
    const targetPos = {
      x: currentPos.x,
      y: Math.max(currentPos.y, height),
      z: currentPos.z
    };
    
    this.updateCrane(craneId, cranePos, targetPos, boomLength);
    this.updateLoad(lift, targetPos);
  }

  updateCrane(craneId, cranePos, targetPos, boomLength) {
    const crane = this.sceneManager.getObject(`crane_${craneId}`);
    if (!crane) return;
    
    const rotatingPlatform = crane.getObjectByName('rotatingPlatform');
    if (!rotatingPlatform) return;
    
    const dx = targetPos.x - cranePos.x;
    const dz = targetPos.z - cranePos.z;
    const horizontalDistance = Math.sqrt(dx * dx + dz * dz);
    const verticalDistance = targetPos.y - cranePos.y;
    
    const swingAngle = Math.atan2(dx, dz);
    rotatingPlatform.rotation.y = swingAngle;
    
    const boom = rotatingPlatform.getObjectByName('boom');
    if (boom) {
      const boomAngle = Math.atan2(verticalDistance, horizontalDistance);
      boom.rotation.z = Math.max(0.3, Math.min(Math.PI * 0.7, boomAngle));
    }
    
    const hookSystem = rotatingPlatform.getObjectByName('hookSystem');
    if (hookSystem && boom) {
      const currentBoomAngle = boom.rotation.z;
      const actualBoomLength = boomLength || 48;
      
      const hookX = Math.cos(currentBoomAngle) * actualBoomLength * 0.7;
      const hookY = Math.sin(currentBoomAngle) * actualBoomLength * 0.7;
      
      const targetHookX = horizontalDistance;
      const targetHookY = verticalDistance;
      
      hookSystem.position.set(
        targetHookX,
        targetHookY,
        0
      );
      
      const cables = hookSystem.getObjectByName('cables');
      if (cables) {
        const cableLength = targetHookY + 5;
        cables.children.forEach(cable => {
          if (cable.isMesh) {
            cable.position.y = -cableLength / 2;
            cable.scale.y = cableLength / 20;
          }
        });
      }
    }
  }

  updateLoad(lift, position) {
    const loadId = `load_${lift.lift_id}`;
    let load = this.sceneManager.getObject(loadId);
    
    if (!load) {
      const { ObjectFactory } = require('../scene/objectFactory.js');
      load = ObjectFactory.createLoadComponent(lift, position);
      this.sceneManager.addObject(loadId, load);
      this.activeLoads.set(lift.lift_id, loadId);
    } else {
      load.position.set(position.x, position.y, position.z);
    }
  }

  showLoadAtStartPosition(lift) {
    this.updateLoad(lift, lift.start_position);
  }

  showLoadAtEndPosition(lift) {
    this.updateLoad(lift, lift.end_position);
  }

  lerpPosition(start, end, t) {
    return {
      x: start.x + (end.x - start.x) * t,
      y: start.y + (end.y - start.y) * t,
      z: start.z + (end.z - start.z) * t
    };
  }

  easeInOutQuad(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  easeInQuad(t) {
    return t * t;
  }

  easeOutQuad(t) {
    return 1 - (1 - t) * (1 - t);
  }

  initializeCraneModels() {
    const { ObjectFactory } = require('../scene/objectFactory.js');
    
    if (this.dataLoader.craneSpecs && this.dataLoader.craneSpecs.cranes) {
      this.dataLoader.craneSpecs.cranes.forEach(craneSpec => {
        const pos = this.cranePositions[craneSpec.crane_id] || { x: 0, y: 0, z: 0 };
        const craneModel = ObjectFactory.createCrane(craneSpec, pos);
        this.sceneManager.addObject(`crane_${craneSpec.crane_id}`, craneModel);
      });
    }
  }

  initializeObstacles() {
    const { ObjectFactory } = require('../scene/objectFactory.js');
    
    if (this.dataLoader.siteLayout && this.dataLoader.siteLayout.obstacles) {
      this.dataLoader.siteLayout.obstacles.forEach(obstacle => {
        const obstacleModel = ObjectFactory.createObstacle(obstacle);
        this.sceneManager.addObject(`obstacle_${obstacle.id}`, obstacleModel);
      });
    }
  }

  initializeOutriggerZones() {
    const { ObjectFactory } = require('../scene/objectFactory.js');
    
    if (this.dataLoader.siteLayout && this.dataLoader.siteLayout.outrigger_zones) {
      this.dataLoader.siteLayout.outrigger_zones.forEach(zone => {
        const zoneModel = ObjectFactory.createOutriggerZone(zone);
        this.sceneManager.addObject(`outrigger_${zone.id}`, zoneModel);
      });
    }
  }

  initializeNoFlyZones() {
    const { ObjectFactory } = require('../scene/objectFactory.js');
    
    if (this.dataLoader.siteLayout && this.dataLoader.siteLayout.no_fly_zones) {
      this.dataLoader.siteLayout.no_fly_zones.forEach(zone => {
        const zoneModel = ObjectFactory.createNoFlyZone(zone);
        this.sceneManager.addObject(`nofly_${zone.id}`, zoneModel);
      });
    }
  }

  initializeLiftPaths() {
    const { ObjectFactory } = require('../scene/objectFactory.js');
    
    if (this.dataLoader.siteLayout && this.dataLoader.siteLayout.lift_paths) {
      this.dataLoader.siteLayout.lift_paths.forEach((path, index) => {
        const pathModel = ObjectFactory.createLiftPath(
          path.waypoints,
          0x00ffff + (index * 0x3333)
        );
        this.sceneManager.addObject(`path_${path.id}`, pathModel);
      });
    }
    
    if (this.dataLoader.liftPlan) {
      this.dataLoader.liftPlan.forEach((lift, index) => {
        const waypoints = [
          lift.start_position,
          { ...lift.start_position, y: (lift.start_position.y || 0) + 15 },
          { ...lift.end_position, y: (lift.end_position.y || 0) + 15 },
          lift.end_position
        ];
        
        const pathId = `lift_path_${lift.lift_id}`;
        if (!this.sceneManager.getObject(pathId)) {
          const { ObjectFactory } = require('../scene/objectFactory.js');
          const pathModel = ObjectFactory.createLiftPath(
            waypoints,
            0xff6b6b + (index * 0x222200)
          );
          this.sceneManager.addObject(pathId, pathModel);
        }
      });
    }
  }

  initializeAll() {
    this.initializeCraneModels();
    this.initializeObstacles();
    this.initializeOutriggerZones();
    this.initializeNoFlyZones();
    this.initializeLiftPaths();
  }
}
