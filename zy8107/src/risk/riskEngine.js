import * as THREE from 'three';

export class RiskEngine {
  constructor(dataLoader, sceneManager) {
    this.dataLoader = dataLoader;
    this.sceneManager = sceneManager;
    this.risks = [];
    this.highlightedObjects = new Set();
    
    this.riskCategories = {
      collision: { name: '碰撞风险', severity: 'danger' },
      radius_exceeded: { name: '超作业半径', severity: 'danger' },
      weight_exceeded: { name: '超重风险', severity: 'danger' },
      outrigger_conflict: { name: '支腿区冲突', severity: 'warning' },
      no_fly_zone_violation: { name: '禁飞区侵入', severity: 'danger' },
      height_limit: { name: '高度限制', severity: 'warning' }
    };
  }

  evaluateAllRisks() {
    this.risks = [];
    
    this.evaluateCollisionRisks();
    this.evaluateRadiusRisks();
    this.evaluateWeightRisks();
    this.evaluateOutriggerRisks();
    this.evaluateNoFlyZoneRisks();
    
    return this.risks;
  }

  evaluateCollisionRisks() {
    const liftPlan = this.dataLoader.liftPlan;
    const obstacles = this.dataLoader.siteLayout?.obstacles || [];
    const cranePositions = {
      'crane_001': { x: 0, y: 0, z: 0 },
      'crane_002': { x: -25, y: 0, z: 0 }
    };
    
    if (!liftPlan) return;
    
    liftPlan.forEach(lift => {
      const cranePos = cranePositions[lift.crane_id] || { x: 0, y: 0, z: 0 };
      
      const pathPoints = this.generatePathPoints(lift);
      
      pathPoints.forEach((point, pointIndex) => {
        const boomLength = lift.boom_length || 48;
        const boomRadius = Math.sqrt(
          Math.pow(point.x - cranePos.x, 2) +
          Math.pow(point.z - cranePos.z, 2)
        );
        
        const boomHeight = point.y;
        
        obstacles.forEach(obstacle => {
          const obstacleMinX = obstacle.position.x - (obstacle.dimensions.width || obstacle.dimensions.radius * 2) / 2;
          const obstacleMaxX = obstacle.position.x + (obstacle.dimensions.width || obstacle.dimensions.radius * 2) / 2;
          const obstacleMinZ = obstacle.position.z - (obstacle.dimensions.depth || obstacle.dimensions.radius * 2) / 2;
          const obstacleMaxZ = obstacle.position.z + (obstacle.dimensions.depth || obstacle.dimensions.radius * 2) / 2;
          const obstacleMinY = obstacle.position.y;
          const obstacleMaxY = obstacle.position.y + obstacle.dimensions.height;
          
          const pointMinX = point.x - 3;
          const pointMaxX = point.x + 3;
          const pointMinZ = point.z - 3;
          const pointMaxZ = point.z + 3;
          const pointMinY = point.y - 5;
          const pointMaxY = point.y + 5;
          
          const hasCollision = this.boxesIntersect(
            pointMinX, pointMaxX, pointMinY, pointMaxY, pointMinZ, pointMaxZ,
            obstacleMinX, obstacleMaxX, obstacleMinY, obstacleMaxY, obstacleMinZ, obstacleMaxZ
          );
          
          if (hasCollision) {
            const clearance = this.calculateClearance(point, obstacle);
            const progress = pointIndex / pathPoints.length;
            
            this.risks.push({
              id: `collision_${lift.lift_id}_${obstacle.id}_${pointIndex}`,
              type: 'collision',
              category: this.riskCategories.collision.name,
              severity: this.riskCategories.collision.severity,
              lift_id: lift.lift_id,
              lift_name: lift.lift_name,
              obstacle_id: obstacle.id,
              obstacle_name: obstacle.name,
              title: `吊臂/载荷与障碍物碰撞风险`,
              message: `吊装 "${lift.lift_name}" 过程中可能与 "${obstacle.name}" 发生碰撞`,
              details: {
                clearance: clearance,
                progress: progress,
                point: point,
                obstacle_position: obstacle.position,
                obstacle_dimensions: obstacle.dimensions
              },
              suggestion: obstacle.critical 
                ? `建议调整吊装路径或吊装时间，${obstacle.name} 为关键障碍物`
                : `建议调整吊装路径，保持安全距离`,
              time_range: {
                start: lift.start_time,
                end: lift.end_time
              }
            });
          }
        });
      });
    });
  }

  evaluateRadiusRisks() {
    const liftPlan = this.dataLoader.liftPlan;
    const cranePositions = {
      'crane_001': { x: 0, y: 0, z: 0 },
      'crane_002': { x: -25, y: 0, z: 0 }
    };
    
    if (!liftPlan) return;
    
    liftPlan.forEach(lift => {
      const cranePos = cranePositions[lift.crane_id] || { x: 0, y: 0, z: 0 };
      const boomLength = lift.boom_length || 48;
      
      const maxSafeRadius = boomLength * 0.9;
      
      const startRadius = this.calculateHorizontalDistance(lift.start_position, cranePos);
      const endRadius = this.calculateHorizontalDistance(lift.end_position, cranePos);
      
      const pathPoints = this.generatePathPoints(lift);
      const maxRadius = Math.max(...pathPoints.map(p => this.calculateHorizontalDistance(p, cranePos)));
      
      if (maxRadius > maxSafeRadius) {
        this.risks.push({
          id: `radius_${lift.lift_id}`,
          type: 'radius_exceeded',
          category: this.riskCategories.radius_exceeded.name,
          severity: this.riskCategories.radius_exceeded.severity,
          lift_id: lift.lift_id,
          lift_name: lift.lift_name,
          title: `超作业半径风险`,
          message: `吊装 "${lift.lift_name}" 的作业半径超过安全范围`,
          details: {
            boom_length: boomLength,
            max_safe_radius: maxSafeRadius.toFixed(2),
            actual_max_radius: maxRadius.toFixed(2),
            start_radius: startRadius.toFixed(2),
            end_radius: endRadius.toFixed(2)
          },
          suggestion: `建议重新评估吊机站位位置或使用更长的吊臂配置`,
          time_range: {
            start: lift.start_time,
            end: lift.end_time
          }
        });
      }
    });
  }

  evaluateWeightRisks() {
    const liftPlan = this.dataLoader.liftPlan;
    const craneSpecs = this.dataLoader.craneSpecs;
    
    if (!liftPlan || !craneSpecs?.cranes) return;
    
    liftPlan.forEach(lift => {
      const crane = this.dataLoader.getCraneById(lift.crane_id);
      if (!crane || !crane.boom?.load_chart) return;
      
      const boomLength = lift.boom_length || 48;
      const loadWeight = lift.weight || 0;
      
      const loadChart = crane.boom.load_chart.find(c => c.boom_length >= boomLength);
      
      if (loadChart && loadChart.radius_data) {
        const minCapacity = Math.min(...loadChart.radius_data.map(r => r.capacity));
        
        if (loadWeight > minCapacity * 0.9) {
          this.risks.push({
            id: `weight_${lift.lift_id}`,
            type: 'weight_exceeded',
            category: this.riskCategories.weight_exceeded.name,
            severity: loadWeight > minCapacity ? 'danger' : 'warning',
            lift_id: lift.lift_id,
            lift_name: lift.lift_name,
            title: `超重风险`,
            message: `吊装 "${lift.lift_name}" 的重量接近或超过吊机额定载荷`,
            details: {
              load_weight: loadWeight,
              boom_length: boomLength,
              min_rated_capacity: minCapacity,
              load_ratio: ((loadWeight / minCapacity) * 100).toFixed(1) + '%'
            },
            suggestion: loadWeight > minCapacity
              ? `严重警告：实际重量 ${loadWeight}t 超过额定载荷 ${minCapacity}t，必须更换更大吊机或调整方案`
              : `警告：载荷率超过90%，建议复核载荷表并考虑额外安全措施`,
            time_range: {
              start: lift.start_time,
              end: lift.end_time
            }
          });
        }
      }
    });
  }

  evaluateOutriggerRisks() {
    const outriggerZones = this.dataLoader.siteLayout?.outrigger_zones || [];
    const obstacles = this.dataLoader.siteLayout?.obstacles || [];
    const liftPlan = this.dataLoader.liftPlan;
    
    outriggerZones.forEach(zone => {
      obstacles.forEach(obstacle => {
        const zoneMinX = zone.position.x - zone.size.left;
        const zoneMaxX = zone.position.x + zone.size.right;
        const zoneMinZ = zone.position.z - zone.size.back;
        const zoneMaxZ = zone.position.z + zone.size.front;
        
        const obstacleMinX = obstacle.position.x - (obstacle.dimensions.width || obstacle.dimensions.radius * 2) / 2;
        const obstacleMaxX = obstacle.position.x + (obstacle.dimensions.width || obstacle.dimensions.radius * 2) / 2;
        const obstacleMinZ = obstacle.position.z - (obstacle.dimensions.depth || obstacle.dimensions.radius * 2) / 2;
        const obstacleMaxZ = obstacle.position.z + (obstacle.dimensions.depth || obstacle.dimensions.radius * 2) / 2;
        
        const hasOverlap = this.rectanglesOverlap(
          zoneMinX, zoneMaxX, zoneMinZ, zoneMaxZ,
          obstacleMinX, obstacleMaxX, obstacleMinZ, obstacleMaxZ
        );
        
        if (hasOverlap) {
          this.risks.push({
            id: `outrigger_${zone.id}_${obstacle.id}`,
            type: 'outrigger_conflict',
            category: this.riskCategories.outrigger_conflict.name,
            severity: this.riskCategories.outrigger_conflict.severity,
            zone_id: zone.id,
            zone_name: zone.name,
            obstacle_id: obstacle.id,
            obstacle_name: obstacle.name,
            title: `支腿区冲突`,
            message: `支腿区 "${zone.name}" 与障碍物 "${obstacle.name}" 空间重叠`,
            details: {
              zone_position: zone.position,
              zone_size: zone.size,
              obstacle_position: obstacle.position,
              obstacle_dimensions: obstacle.dimensions
            },
            suggestion: `建议重新评估吊机站位位置或移除/迁移障碍物`,
            time_range: null
          });
        }
      });
    });
  }

  evaluateNoFlyZoneRisks() {
    const noFlyZones = this.dataLoader.siteLayout?.no_fly_zones || [];
    const liftPlan = this.dataLoader.liftPlan;
    
    if (!liftPlan) return;
    
    liftPlan.forEach(lift => {
      const pathPoints = this.generatePathPoints(lift);
      
      noFlyZones.forEach(zone => {
        pathPoints.forEach((point, pointIndex) => {
          const inZone = this.isPointInBox(
            point,
            zone.bounds.x_min, zone.bounds.x_max,
            zone.min_height, zone.max_height,
            zone.bounds.z_min, zone.bounds.z_max
          );
          
          if (inZone) {
            const progress = pointIndex / pathPoints.length;
            
            this.risks.push({
              id: `nofly_${zone.id}_${lift.lift_id}_${pointIndex}`,
              type: 'no_fly_zone_violation',
              category: this.riskCategories.no_fly_zone_violation.name,
              severity: this.riskCategories.no_fly_zone_violation.severity,
              zone_id: zone.id,
              zone_name: zone.name,
              lift_id: lift.lift_id,
              lift_name: lift.lift_name,
              title: `禁飞区侵入`,
              message: `吊装 "${lift.lift_name}" 路径侵入禁飞区 "${zone.name}"`,
              details: {
                zone_bounds: zone.bounds,
                point: point,
                progress: progress
              },
              suggestion: `必须调整吊装路径以避开禁飞区 "${zone.name}"`,
              time_range: {
                start: lift.start_time,
                end: lift.end_time
              }
            });
          }
        });
      });
    });
  }

  getRisksAtTime(currentDateTime) {
    return this.risks.filter(risk => {
      if (!risk.time_range) return true;
      
      const { start, end } = risk.time_range;
      if (!start || !end) return true;
      
      return currentDateTime >= start && currentDateTime <= end;
    });
  }

  getRiskByType(type) {
    return this.risks.filter(r => r.type === type);
  }

  getRisksBySeverity(severity) {
    return this.risks.filter(r => r.severity === severity);
  }

  highlightRiskRiskObjects(risk) {
    if (risk.obstacle_id) {
      this.sceneManager.highlightObject(`obstacle_${risk.obstacle_id}`, true);
      this.highlightedObjects.add(`obstacle_${risk.obstacle_id}`);
    }
    
    if (risk.lift_id) {
      this.sceneManager.highlightObject(`load_${risk.lift_id}`, true);
      this.highlightedObjects.add(`load_${risk.lift_id}`);
    }
  }

  clearHighlights() {
    this.highlightedObjects.forEach(objId => {
      this.sceneManager.highlightObject(objId, false);
    });
    this.highlightedObjects.clear();
  }

  generatePathPoints(lift, numPoints = 20) {
    const points = [];
    const start = lift.start_position;
    const end = lift.end_position;
    
    for (let i = 0; i <= numPoints; i++) {
      const t = i / numPoints;
      const easeT = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      
      const midHeight = Math.max(start.y, end.y) + 20;
      const height = t < 0.5 
        ? start.y + (midHeight - start.y) * easeT * 2
        : midHeight + (end.y - midHeight) * (easeT - 0.5) * 2;
      
      points.push({
        x: start.x + (end.x - start.x) * easeT,
        y: height,
        z: start.z + (end.z - start.z) * easeT
      });
    }
    
    return points;
  }

  calculateHorizontalDistance(point1, point2) {
    return Math.sqrt(
      Math.pow(point1.x - point2.x, 2) +
      Math.pow(point1.z - point2.z, 2)
    );
  }

  boxesIntersect(minX1, maxX1, minY1, maxY1, minZ1, maxZ1,
                  minX2, maxX2, minY2, maxY2, minZ2, maxZ2) {
    return !(maxX1 < minX2 || minX1 > maxX2 ||
             maxY1 < minY2 || minY1 > maxY2 ||
             maxZ1 < minZ2 || minZ1 > maxZ2);
  }

  rectanglesOverlap(minX1, maxX1, minZ1, maxZ1,
                     minX2, maxX2, minZ2, maxZ2) {
    return !(maxX1 < minX2 || minX1 > maxX2 ||
             maxZ1 < minZ2 || minZ1 > maxZ2);
  }

  isPointInBox(point, minX, maxX, minY, maxY, minZ, maxZ) {
    return point.x >= minX && point.x <= maxX &&
           point.y >= minY && point.y <= maxY &&
           point.z >= minZ && point.z <= maxZ;
  }

  calculateClearance(point, obstacle) {
    const obstacleRadius = obstacle.dimensions.radius || 
      Math.max(obstacle.dimensions.width, obstacle.dimensions.depth) / 2;
    
    const dist = this.calculateHorizontalDistance(point, obstacle.position);
    const heightDiff = Math.abs(point.y - (obstacle.position.y + obstacle.dimensions.height / 2));
    
    return Math.min(dist - obstacleRadius, heightDiff - obstacle.dimensions.height / 2);
  }
}
