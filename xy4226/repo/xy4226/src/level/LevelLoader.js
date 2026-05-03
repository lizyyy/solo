class LevelLoader {
  constructor() {
    this.cache = new Map();
  }

  async load(levelPath) {
    if (this.cache.has(levelPath)) {
      return this.cloneLevelData(this.cache.get(levelPath));
    }

    try {
      const response = await fetch(levelPath);
      if (!response.ok) {
        throw new Error(`无法加载关卡: ${levelPath}`);
      }
      
      const levelData = await response.json();
      const validatedData = this.validateAndTransform(levelData);
      
      this.cache.set(levelPath, validatedData);
      
      return this.cloneLevelData(validatedData);
    } catch (error) {
      console.error('关卡加载失败:', error);
      throw error;
    }
  }

  validateAndTransform(data) {
    const validated = {
      id: data.id || 'unknown',
      name: data.name || '未命名关卡',
      description: data.description || '',
      difficulty: data.difficulty || 1,
      timeLimit: data.timeLimit || 300,
      vehicle: this.validateVehicle(data.vehicle),
      racks: this.validateArray(data.racks, this.validateRack),
      pedestrianZones: this.validateArray(data.pedestrianZones, this.validatePedestrianZone),
      speedLimitZones: this.validateArray(data.speedLimitZones, this.validateSpeedLimitZone),
      loadingDocks: this.validateArray(data.loadingDocks, this.validateLoadingDock),
      pallets: this.validateArray(data.pallets, this.validatePallet),
      obstacles: this.validateArray(data.obstacles, this.validateObstacle),
      tasks: this.validateArray(data.tasks, this.validateTask),
      scoringRules: data.scoringRules || this.getDefaultScoringRules()
    };

    return validated;
  }

  validateVehicle(vehicle) {
    if (!vehicle) {
      return {
        startPosition: { x: 0, y: 0, z: 0 },
        startRotation: 0,
        maxSpeed: 5,
        turningRadius: 3
      };
    }

    return {
      startPosition: this.validatePosition(vehicle.startPosition),
      startRotation: vehicle.startRotation || 0,
      maxSpeed: vehicle.maxSpeed || 5,
      turningRadius: vehicle.turningRadius || 3
    };
  }

  validatePosition(pos) {
    if (!pos) {
      return { x: 0, y: 0, z: 0 };
    }
    return {
      x: pos.x || 0,
      y: pos.y || 0,
      z: pos.z || 0
    };
  }

  validateArray(arr, validator) {
    if (!Array.isArray(arr)) {
      return [];
    }
    return arr.map((item, index) => {
      const validated = validator.call(this, item);
      if (!validated.id) {
        validated.id = index;
      }
      return validated;
    });
  }

  validateRack(rack) {
    return {
      id: rack.id,
      position: this.validatePosition(rack.position),
      rotation: rack.rotation || 0,
      width: rack.width || 4,
      depth: rack.depth || 2,
      height: rack.height || 8
    };
  }

  validatePedestrianZone(zone) {
    return {
      id: zone.id,
      position: this.validatePosition(zone.position),
      width: zone.width || 5,
      depth: zone.depth || 5,
      hasPedestrians: zone.hasPedestrians !== false,
      pedestrianCount: zone.pedestrianCount || 2
    };
  }

  validateSpeedLimitZone(zone) {
    return {
      id: zone.id,
      position: this.validatePosition(zone.position),
      width: zone.width || 10,
      depth: zone.depth || 10,
      maxSpeed: zone.maxSpeed || 2
    };
  }

  validateLoadingDock(dock) {
    return {
      id: dock.id,
      position: this.validatePosition(dock.position),
      rotation: dock.rotation || 0,
      width: dock.width || 6,
      depth: dock.depth || 4
    };
  }

  validatePallet(pallet) {
    return {
      id: pallet.id,
      position: this.validatePosition(pallet.position),
      rotation: pallet.rotation || 0,
      hasCargo: pallet.hasCargo !== false,
      cargoHeight: pallet.cargoHeight || 1.5,
      cargoColor: pallet.cargoColor,
      targetDockId: pallet.targetDockId,
      sequence: pallet.sequence || 0
    };
  }

  validateObstacle(obstacle) {
    return {
      id: obstacle.id,
      position: this.validatePosition(obstacle.position),
      rotation: obstacle.rotation || 0,
      type: obstacle.type || 'box',
      width: obstacle.width || 2,
      height: obstacle.height || 2,
      depth: obstacle.depth || 2,
      radius: obstacle.radius || 1,
      color: obstacle.color
    };
  }

  validateTask(task) {
    return {
      id: task.id,
      type: task.type || 'pickup',
      description: task.description || '',
      targetId: task.targetId,
      sequence: task.sequence || 0,
      completed: false
    };
  }

  getDefaultScoringRules() {
    return {
      baseScore: 100,
      timeBonus: {
        perSecond: 0.5,
        maxBonus: 50
      },
      violations: {
        collision: -20,
        speeding: -10,
        turningRadius: -15,
        blindSpot: -25,
        wrongSequence: -30
      },
      tasks: {
        pickup: 20,
        delivery: 30,
        avoidPedestrian: 15
      }
    };
  }

  cloneLevelData(data) {
    return JSON.parse(JSON.stringify(data));
  }

  listAvailableLevels() {
    return [
      { id: 'level1', name: '新手入门', difficulty: 1 },
      { id: 'level2', name: '进阶训练', difficulty: 2 },
      { id: 'level3', name: '高级挑战', difficulty: 3 }
    ];
  }

  clearCache() {
    this.cache.clear();
  }
}

export default LevelLoader;
