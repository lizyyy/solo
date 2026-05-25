export class ValidationEngine {
  constructor() {
    this.rules = [
      { id: 'noStopZone', name: '禁停区穿越检测', type: 'error', validate: this.validateNoStopZone.bind(this) },
      { id: 'speedZone', name: '限速区遗漏检测', type: 'warning', validate: this.validateSpeedZone.bind(this) },
      { id: 'washPointDistance', name: '洗消点距离检测', type: 'warning', validate: this.validateWashPointDistance.bind(this) },
      { id: 'routeContinuity', name: '路线连续性检测', type: 'error', validate: this.validateRouteContinuity.bind(this) },
      { id: 'startEndPoints', name: '起点终点检测', type: 'warning', validate: this.validateStartEndPoints.bind(this) }
    ];
  }

  validate(route, zones, settings = {}) {
    const results = [];
    
    this.rules.forEach(rule => {
      const result = rule.validate(route, zones, settings);
      if (result) {
        results.push({
          ruleId: rule.id,
          ruleName: rule.name,
          type: rule.type,
          ...result
        });
      }
    });

    const failedResults = results.filter(r => !r.passed);

    return {
      isValid: !failedResults.some(r => r.type === 'error'),
      totalIssues: failedResults.length,
      errors: failedResults.filter(r => r.type === 'error').length,
      warnings: failedResults.filter(r => r.type === 'warning').length,
      details: results
    };
  }

  validateNoStopZone(route, zones, settings) {
    const noStopZones = zones.filter(z => z.type === 'noStopZone');
    const crossings = [];

    if (noStopZones.length === 0) return null;

    for (let i = 0; i < route.length - 1; i++) {
      const start = route[i];
      const end = route[i + 1];

      noStopZones.forEach(zone => {
        if (this.lineIntersectsZone(start, end, zone)) {
          crossings.push({
            segment: i,
            zoneId: zone.id,
            zoneName: zone.name || '未命名禁停区',
            position: this.getIntersectionPoint(start, end, zone)
          });
        }
      });
    }

    if (crossings.length > 0) {
      return {
        passed: false,
        message: `路线穿越 ${crossings.length} 个禁停区`,
        details: crossings.map(c => 
          `路段 ${c.segment + 1}-${c.segment + 2} 穿越 ${c.zoneName}`
        ),
        locations: crossings.map(c => c.position)
      };
    }

    return {
      passed: true,
      message: '未穿越任何禁停区',
      details: []
    };
  }

  validateSpeedZone(route, zones, settings) {
    const speedZones = zones.filter(z => z.type === 'speedZone');
    const missedZones = [];

    if (speedZones.length === 0) return null;

    speedZones.forEach(zone => {
      let passedZone = false;
      
      for (let i = 0; i < route.length - 1; i++) {
        if (this.lineIntersectsZone(route[i], route[i + 1], zone)) {
          passedZone = true;
          break;
        }
      }

      if (!passedZone) {
        missedZones.push({
          zoneId: zone.id,
          zoneName: zone.name || '未命名限速区',
          speedLimit: zone.speedLimit || 30
        });
      }
    });

    if (missedZones.length > 0) {
      return {
        passed: false,
        message: `${missedZones.length} 个限速区未经过`,
        details: missedZones.map(z => 
          `${z.zoneName} (限速 ${z.speedLimit}km/h) 未经过`
        ),
        locations: missedZones.map(z => zones.find(zone => zone.id === z.zoneId)?.position)
      };
    }

    return {
      passed: true,
      message: '所有限速区均已覆盖',
      details: []
    };
  }

  validateWashPointDistance(route, zones, settings) {
    const washPoints = zones.filter(z => z.type === 'washPoint');
    const maxDistance = settings.maxWashDistance || 50;
    const violations = [];

    if (washPoints.length === 0) return null;

    route.forEach((point, index) => {
      let minDistance = Infinity;
      
      washPoints.forEach(washPoint => {
        const dist = this.distanceBetween(point, washPoint.position);
        minDistance = Math.min(minDistance, dist);
      });

      if (minDistance > maxDistance) {
        violations.push({
          pointIndex: index,
          distance: Math.round(minDistance * 10) / 10,
          position: point
        });
      }
    });

    if (violations.length > 0) {
      return {
        passed: false,
        message: `${violations.length} 个路径点距离洗消点超过 ${maxDistance}米`,
        details: violations.slice(0, 5).map(v => 
          `路径点 ${v.pointIndex + 1} 距最近洗消点 ${v.distance}米`
        ).concat(violations.length > 5 ? [`... 还有 ${violations.length - 5} 个点`] : []),
        locations: violations.map(v => v.position)
      };
    }

    return {
      passed: true,
      message: `所有路径点均在洗消点 ${maxDistance}米范围内`,
      details: []
    };
  }

  validateRouteContinuity(route, zones, settings) {
    const maxSegmentLength = settings.maxSegmentLength || 30;
    const longSegments = [];

    if (route.length < 2) {
      return {
        passed: false,
        message: '路线需要至少2个点',
        details: ['当前路径点数量不足'],
        locations: []
      };
    }

    for (let i = 0; i < route.length - 1; i++) {
      const dist = this.distanceBetween(route[i], route[i + 1]);
      if (dist > maxSegmentLength) {
        longSegments.push({
          segment: i,
          distance: Math.round(dist * 10) / 10
        });
      }
    }

    if (longSegments.length > 0) {
      return {
        passed: false,
        message: `${longSegments.length} 个路段过长`,
        details: longSegments.map(s => 
          `路段 ${s.segment + 1}-${s.segment + 2} 长度 ${s.distance}米`
        ),
        locations: longSegments.map(s => ({
          x: (route[s.segment].x + route[s.segment + 1].x) / 2,
          z: (route[s.segment].z + route[s.segment + 1].z) / 2
        }))
      };
    }

    return {
      passed: true,
      message: '路线连续性良好',
      details: []
    };
  }

  validateStartEndPoints(route, zones, settings) {
    if (route.length < 2) return null;

    const start = route[0];
    const end = route[route.length - 1];
    const warnings = [];

    const startNearWash = zones
      .filter(z => z.type === 'washPoint')
      .some(z => this.distanceBetween(start, z.position) < 10);
    
    const endNearWash = zones
      .filter(z => z.type === 'washPoint')
      .some(z => this.distanceBetween(end, z.position) < 10);

    if (!startNearWash) {
      warnings.push('起点未设置在洗消点附近');
    }

    if (!endNearWash) {
      warnings.push('终点未设置在洗消点附近');
    }

    if (warnings.length > 0) {
      return {
        passed: false,
        message: '起点/终点建议靠近洗消点',
        details: warnings,
        locations: warnings.length === 2 ? [start, end] : [start]
      };
    }

    return {
      passed: true,
      message: '起点终点设置合理',
      details: []
    };
  }

  lineIntersectsZone(start, end, zone) {
    if (zone.type === 'washPoint') {
      return this.lineIntersectsCircle(start, end, zone.position, zone.size.radius);
    } else {
      return this.lineIntersectsRectangle(start, end, zone);
    }
  }

  lineIntersectsCircle(start, end, center, radius) {
    const dx = end.x - start.x;
    const dz = end.z - start.z;
    const fx = start.x - center.x;
    const fz = start.z - center.z;

    const a = dx * dx + dz * dz;
    const b = 2 * (fx * dx + fz * dz);
    const c = fx * fx + fz * fz - radius * radius;

    let discriminant = b * b - 4 * a * c;
    if (discriminant < 0) return false;

    discriminant = Math.sqrt(discriminant);
    const t1 = (-b - discriminant) / (2 * a);
    const t2 = (-b + discriminant) / (2 * a);

    return (t1 >= 0 && t1 <= 1) || (t2 >= 0 && t2 <= 1);
  }

  lineIntersectsRectangle(start, end, zone) {
    const halfWidth = zone.size.width / 2;
    const halfHeight = zone.size.height / 2;
    const cx = zone.position.x;
    const cz = zone.position.z;

    const x1 = cx - halfWidth, z1 = cz - halfHeight;
    const x2 = cx + halfWidth, z2 = cz - halfHeight;
    const x3 = cx + halfWidth, z3 = cz + halfHeight;
    const x4 = cx - halfWidth, z4 = cz + halfHeight;

    return this.lineIntersectsLine(start, end, { x: x1, z: z1 }, { x: x2, z: z2 }) ||
           this.lineIntersectsLine(start, end, { x: x2, z: z2 }, { x: x3, z: z3 }) ||
           this.lineIntersectsLine(start, end, { x: x3, z: z3 }, { x: x4, z: z4 }) ||
           this.lineIntersectsLine(start, end, { x: x4, z: z4 }, { x: x1, z: z1 }) ||
           this.pointInRectangle(start, zone) ||
           this.pointInRectangle(end, zone);
  }

  lineIntersectsLine(p1, p2, p3, p4) {
    const denom = (p4.z - p3.z) * (p2.x - p1.x) - (p4.x - p3.x) * (p2.z - p1.z);
    if (Math.abs(denom) < 0.0001) return false;

    const ua = ((p4.x - p3.x) * (p1.z - p3.z) - (p4.z - p3.z) * (p1.x - p3.x)) / denom;
    const ub = ((p2.x - p1.x) * (p1.z - p3.z) - (p2.z - p1.z) * (p1.x - p3.x)) / denom;

    return ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1;
  }

  pointInRectangle(point, zone) {
    const halfWidth = zone.size.width / 2;
    const halfHeight = zone.size.height / 2;
    return point.x >= zone.position.x - halfWidth &&
           point.x <= zone.position.x + halfWidth &&
           point.z >= zone.position.z - halfHeight &&
           point.z <= zone.position.z + halfHeight;
  }

  getIntersectionPoint(start, end, zone) {
    return {
      x: (start.x + end.x) / 2,
      z: (start.z + end.z) / 2
    };
  }

  distanceBetween(p1, p2) {
    const dx = p2.x - p1.x;
    const dz = p2.z - p1.z;
    return Math.sqrt(dx * dx + dz * dz);
  }

  getRouteLength(route) {
    let length = 0;
    for (let i = 0; i < route.length - 1; i++) {
      length += this.distanceBetween(route[i], route[i + 1]);
    }
    return length;
  }
}
