const { Conflict } = require('./models');
const { getErrorMessage } = require('./errorMessages');

class ConflictDetector {
  constructor() {
    this.conflicts = [];
  }

  detectAll(obstacles, cadLayers, rangefinderRecords) {
    const resolvedConflictIds = new Set(
      this.conflicts.filter(c => c.status === 'resolved').map(c => c.conflictId)
    );
    const resolvedMap = new Map();
    for (const c of this.conflicts) {
      if (c.status === 'resolved') {
        resolvedMap.set(c.conflictId, c);
      }
    }
    
    this.conflicts = [];
    
    this.detectDuplicateNames(obstacles);
    this.detectCADvsRangefinderConflict(cadLayers, rangefinderRecords);
    
    for (const conflict of this.conflicts) {
      if (resolvedMap.has(conflict.conflictId)) {
        const resolved = resolvedMap.get(conflict.conflictId);
        conflict.status = resolved.status;
        conflict.resolvedBy = resolved.resolvedBy;
        conflict.resolvedAt = resolved.resolvedAt;
        conflict.resolution = resolved.resolution;
      }
    }
    
    for (const [id, resolved] of resolvedMap) {
      if (!this.conflicts.find(c => c.conflictId === id)) {
        this.conflicts.push(resolved);
      }
    }
    
    return this.conflicts;
  }

  detectDuplicateNames(obstacles) {
    const conflicts = [];
    
    for (const obstacle of Object.values(obstacles)) {
      if (obstacle.hasMultipleNames()) {
        const evidence = obstacle.names.map(n => ({
          name: n.name,
          source: n.source,
          operator: n.operator,
          timestamp: n.timestamp
        }));
        
        const conflict = new Conflict(
          'duplicate_names',
          obstacle.id,
          evidence,
          getErrorMessage('DUPLICATE_NAMES', { 
            obstacleId: obstacle.id,
            count: obstacle.names.length,
            names: obstacle.names.map(n => n.name).join('、')
          })
        );
        conflicts.push(conflict);
        this.conflicts.push(conflict);
      }
    }
    
    return conflicts;
  }

  detectCADvsRangefinderConflict(cadLayers, rangefinderRecords) {
    const conflicts = [];
    const TOLERANCE = 0.5;
    
    const recordsByObstacle = {};
    for (const record of rangefinderRecords) {
      if (!recordsByObstacle[record.obstacleId]) {
        recordsByObstacle[record.obstacleId] = [];
      }
      recordsByObstacle[record.obstacleId].push(record);
    }
    
    for (const layer of cadLayers) {
      const records = recordsByObstacle[layer.obstacleId] || [];
      
      for (const record of records) {
        const cadDistance = this.calculateDistance(layer.position);
        const diff = Math.abs(cadDistance - record.distance);
        
        if (diff > TOLERANCE) {
          const evidence = {
            cadLayer: {
              name: layer.layerName,
              distance: cadDistance.toFixed(2),
              position: layer.position,
              source: layer.source
            },
            rangefinder: {
              distance: record.distance.toFixed(2),
              position: record.position,
              measuredBy: record.measuredBy,
              measuredAt: record.measuredAt,
              remark: record.remark
            },
            difference: diff.toFixed(2)
          };
          
          const conflict = new Conflict(
            'cad_vs_rangefinder',
            layer.obstacleId,
            evidence,
            getErrorMessage('CAD_RANGE_CONFLICT', {
              obstacleId: layer.obstacleId,
              cadDistance: cadDistance.toFixed(2),
              rangeDistance: record.distance.toFixed(2),
              difference: diff.toFixed(2)
            })
          );
          conflicts.push(conflict);
          this.conflicts.push(conflict);
        }
      }
    }
    
    return conflicts;
  }

  calculateDistance(position) {
    if (!position) return 0;
    const { x = 0, y = 0, z = 0 } = position;
    return Math.sqrt(x * x + y * y + z * z);
  }

  getConflictsByType(type) {
    return this.conflicts.filter(c => c.type === type);
  }

  getPendingConflicts() {
    return this.conflicts.filter(c => c.status === 'pending');
  }

  resolveConflict(conflictId, resolution, resolvedBy) {
    const conflict = this.conflicts.find(c => c.conflictId === conflictId);
    if (conflict) {
      conflict.status = 'resolved';
      conflict.resolvedBy = resolvedBy;
      conflict.resolvedAt = new Date();
      conflict.resolution = resolution;
      return JSON.parse(JSON.stringify(conflict));
    }
    return null;
  }
}

module.exports = ConflictDetector;
