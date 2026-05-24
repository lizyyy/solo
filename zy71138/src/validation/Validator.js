export class Validator {
  constructor(sceneManager) {
    this.sceneManager = sceneManager;
    this.results = [];
  }

  validate() {
    this.results = [];

    this.validateFireDoors();
    this.validateFlowPaths();
    this.validateCrossFloorAccess();
    this.validateBarrierPlacement();

    this.updateUI();
    return this.results;
  }

  validateFireDoors() {
    const barriers = this.sceneManager.barriers;
    const fireDoors = this.sceneManager.fireDoors;

    fireDoors.forEach(fireDoor => {
      const doorData = fireDoor.data;
      const doorBounds = this.getFireDoorBounds(doorData);
      
      let blocked = false;
      let blockingBarrier = null;

      barriers.forEach(barrier => {
        const barrierData = barrier.data;
        if (barrierData.floor !== doorData.floor) return;

        const barrierBounds = this.getBarrierBounds(barrierData);
        
        if (this.checkOverlap(doorBounds, barrierBounds)) {
          blocked = true;
          blockingBarrier = barrierData;
        }
      });

      if (blocked) {
        this.results.push({
          type: 'error',
          category: '消防门',
          message: `${doorData.name} 被 ${blockingBarrier.name} 阻塞`,
          details: `位置: (${doorData.x}, ${doorData.z})`,
          data: { fireDoor: doorData, barrier: blockingBarrier }
        });
      } else {
        this.results.push({
          type: 'success',
          category: '消防门',
          message: `${doorData.name} 通道畅通`,
          data: { fireDoor: doorData }
        });
      }
    });
  }

  validateFlowPaths() {
    const barriers = this.sceneManager.barriers;
    const flowPaths = this.getFlowPaths();

    flowPaths.forEach(path => {
      const pathPoints = path.points;
      const floor = path.floor;
      
      for (let i = 0; i < pathPoints.length - 1; i++) {
        const start = pathPoints[i];
        const end = pathPoints[i + 1];
        
        barriers.forEach(barrier => {
          const barrierData = barrier.data;
          if (barrierData.floor !== floor) return;

          if (this.lineIntersectsBarrier(start, end, barrierData)) {
            this.results.push({
              type: 'warning',
              category: '导视动线',
              message: `${path.id} 动线在第 ${i + 1} 段被 ${barrierData.name} 阻断`,
              details: `强度: ${(path.intensity * 100).toFixed(0)}%`,
              data: { path, segment: i, barrier: barrierData }
            });
          }
        });
      }
    });
  }

  validateCrossFloorAccess() {
    const escalators = this.sceneManager.escalators;
    const barriers = this.sceneManager.barriers;

    escalators.forEach(escalator => {
      const escData = escalator.data;
      const escBounds = this.getEscalatorBounds(escData);
      
      let blocked = false;
      let blockingBarrier = null;

      barriers.forEach(barrier => {
        const barrierData = barrier.data;
        if (barrierData.floor !== escData.floor) return;

        const barrierBounds = this.getBarrierBounds(barrierData);
        
        if (this.checkOverlap(escBounds, barrierBounds)) {
          blocked = true;
          blockingBarrier = barrierData;
        }
      });

      if (blocked) {
        this.results.push({
          type: 'error',
          category: '跨层扶梯',
          message: `${escData.name} 入口被 ${blockingBarrier.name} 阻塞`,
          details: `楼层: ${escData.floor} → ${escData.targetFloor}`,
          data: { escalator: escData, barrier: blockingBarrier }
        });
      }
    });
  }

  validateBarrierPlacement() {
    const barriers = this.sceneManager.barriers;

    barriers.forEach(barrier => {
      const data = barrier.data;
      
      if (Math.abs(data.x) > 38 || Math.abs(data.z) > 28) {
        this.results.push({
          type: 'warning',
          category: '围挡位置',
          message: `${data.name} 位于商场边界外`,
          details: `位置: (${data.x}, ${data.z})`,
          data: { barrier: data }
        });
      }
    });

    for (let i = 0; i < barriers.length; i++) {
      for (let j = i + 1; j < barriers.length; j++) {
        const b1 = barriers[i].data;
        const b2 = barriers[j].data;
        
        if (b1.floor !== b2.floor) continue;

        const bounds1 = this.getBarrierBounds(b1);
        const bounds2 = this.getBarrierBounds(b2);

        if (this.checkOverlap(bounds1, bounds2)) {
          this.results.push({
            type: 'warning',
            category: '围挡重叠',
            message: `${b1.name} 与 ${b2.name} 重叠`,
            data: { barrier1: b1, barrier2: b2 }
          });
        }
      }
    }
  }

  getFireDoorBounds(door) {
    const halfWidth = door.width / 2 + 1;
    const halfDepth = door.depth / 2 + 2;
    
    if (door.direction === 'north' || door.direction === 'south') {
      return {
        minX: door.x - halfDepth,
        maxX: door.x + halfDepth,
        minZ: door.z - halfWidth,
        maxZ: door.z + halfWidth
      };
    }
    return {
      minX: door.x - halfWidth,
      maxX: door.x + halfWidth,
      minZ: door.z - halfDepth,
      maxZ: door.z + halfDepth
    };
  }

  getBarrierBounds(barrier) {
    const cos = Math.cos(barrier.rotation || 0);
    const sin = Math.sin(barrier.rotation || 0);
    
    const halfWidth = barrier.width / 2;
    const halfDepth = barrier.depth / 2;
    
    const corners = [
      { x: halfWidth * cos - halfDepth * sin, z: halfWidth * sin + halfDepth * cos },
      { x: -halfWidth * cos - halfDepth * sin, z: -halfWidth * sin + halfDepth * cos },
      { x: halfWidth * cos + halfDepth * sin, z: halfWidth * sin - halfDepth * cos },
      { x: -halfWidth * cos + halfDepth * sin, z: -halfWidth * sin - halfDepth * cos }
    ];

    let minX = Infinity, maxX = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    
    corners.forEach(c => {
      minX = Math.min(minX, barrier.x + c.x);
      maxX = Math.max(maxX, barrier.x + c.x);
      minZ = Math.min(minZ, barrier.z + c.z);
      maxZ = Math.max(maxZ, barrier.z + c.z);
    });

    return { minX, maxX, minZ, maxZ };
  }

  getEscalatorBounds(escalator) {
    return {
      minX: escalator.x - escalator.width / 2 - 2,
      maxX: escalator.x + escalator.width / 2 + 2,
      minZ: escalator.z - escalator.length / 2 - 2,
      maxZ: escalator.z + escalator.length / 2 + 2
    };
  }

  checkOverlap(bounds1, bounds2) {
    return !(
      bounds1.maxX < bounds2.minX ||
      bounds1.minX > bounds2.maxX ||
      bounds1.maxZ < bounds2.minZ ||
      bounds1.minZ > bounds2.maxZ
    );
  }

  lineIntersectsBarrier(start, end, barrier) {
    const bounds = this.getBarrierBounds(barrier);
    
    const lineMinX = Math.min(start.x, end.x);
    const lineMaxX = Math.max(start.x, end.x);
    const lineMinZ = Math.min(start.z, end.z);
    const lineMaxZ = Math.max(start.z, end.z);

    if (lineMaxX < bounds.minX || lineMinX > bounds.maxX) return false;
    if (lineMaxZ < bounds.minZ || lineMinZ > bounds.maxZ) return false;

    return true;
  }

  getFlowPaths() {
    return window.flowPaths || [
      { id: '主通道-东向', floor: '1F', points: [{ x: -30, z: 0 }, { x: 30, z: 0 }], intensity: 0.9 },
      { id: '主通道-南北', floor: '1F', points: [{ x: 0, z: -20 }, { x: 0, z: 20 }], intensity: 0.7 },
      { id: '扶梯连接', floor: '1F', points: [{ x: -15, z: -10 }, { x: -15, z: 10 }], intensity: 0.6 }
    ];
  }

  updateUI() {
    const container = document.getElementById('validation-results');
    if (!container) return;

    container.innerHTML = '';

    const errors = this.results.filter(r => r.type === 'error');
    const warnings = this.results.filter(r => r.type === 'warning');
    const successes = this.results.filter(r => r.type === 'success');

    if (errors.length === 0 && warnings.length === 0) {
      const item = document.createElement('div');
      item.className = 'validation-item success';
      item.innerHTML = '<strong>✅ 全部通过</strong><br>所有校验项均符合要求';
      container.appendChild(item);
    }

    this.results.forEach(result => {
      const item = document.createElement('div');
      item.className = `validation-item ${result.type}`;
      
      const icon = result.type === 'error' ? '❌' : result.type === 'warning' ? '⚠️' : '✅';
      item.innerHTML = `
        <strong>${icon} ${result.category}</strong><br>
        ${result.message}
        ${result.details ? `<br><small>${result.details}</small>` : ''}
      `;
      container.appendChild(item);
    });
  }

  getSummary() {
    const errors = this.results.filter(r => r.type === 'error').length;
    const warnings = this.results.filter(r => r.type === 'warning').length;
    const successes = this.results.filter(r => r.type === 'success').length;

    return {
      total: this.results.length,
      errors,
      warnings,
      successes,
      passed: errors === 0,
      results: [...this.results]
    };
  }
}
