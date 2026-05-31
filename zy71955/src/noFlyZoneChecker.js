const config = require('./config');
const { createError } = require('./utils/errors');

class NoFlyZoneChecker {
  constructor() {
    this.noFlyZones = config.noFlyZones;
    this.safetyDistance = config.safetyDistance;
  }

  checkRoute(waypoints) {
    const violations = [];
    const warnings = [];
    
    for (const zone of this.noFlyZones) {
      const result = this._checkZone(waypoints, zone);
      if (result.violation) {
        violations.push({
          zone: zone.name,
          zoneId: zone.id,
          level: zone.level,
          minDistance: result.minDistance,
          closestPoint: result.closestPoint,
          message: this._getViolationMessage(zone, result.minDistance)
        });
      } else if (result.warning) {
        warnings.push({
          zone: zone.name,
          zoneId: zone.id,
          level: zone.level,
          minDistance: result.minDistance,
          message: `离"${zone.name}"还有 ${Math.round(result.minDistance)} 米，注意保持距离`
        });
      }
    }
    
    return {
      safe: violations.length === 0,
      violations,
      warnings,
      summary: this._generateSummary(violations, warnings)
    };
  }

  _checkZone(waypoints, zone) {
    let minDistance = Infinity;
    let closestPoint = null;
    
    for (const point of waypoints) {
      const distance = this._calculateDistance(point, zone.center);
      if (distance < minDistance) {
        minDistance = distance;
        closestPoint = point;
      }
    }
    
    const violationDistance = zone.radius;
    const warningDistance = zone.radius + this.safetyDistance * 2;
    
    return {
      violation: minDistance < violationDistance,
      warning: minDistance >= violationDistance && minDistance < warningDistance,
      minDistance,
      closestPoint
    };
  }

  _calculateDistance(p1, p2) {
    const R = 6371000;
    const dLat = (p2.lat - p1.lat) * Math.PI / 180;
    const dLng = (p2.lng - p1.lng) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(p1.lat * Math.PI / 180) * Math.cos(p2.lat * Math.PI / 180) *
              Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  _getViolationMessage(zone, distance) {
    if (zone.level === 'critical') {
      return `严重！航线进入"${zone.name}"禁飞区，最近只有 ${Math.round(distance)} 米`;
    }
    return `注意！航线擦到"${zone.name}"边缘，最近距离 ${Math.round(distance)} 米`;
  }

  _generateSummary(violations, warnings) {
    const parts = [];
    
    if (violations.length > 0) {
      const critical = violations.filter(v => v.level === 'critical').length;
      parts.push(`发现 ${violations.length} 处禁飞区冲突${critical > 0 ? `（含 ${critical} 个高危区域）` : ''}`);
    }
    
    if (warnings.length > 0) {
      parts.push(`${warnings.length} 处需要注意保持距离`);
    }
    
    if (violations.length === 0 && warnings.length === 0) {
      parts.push('航线安全，未发现禁飞区冲突');
    }
    
    return parts.join('，');
  }

  throwIfViolated(checkResult) {
    if (checkResult.violations.length > 0) {
      const worst = checkResult.violations.reduce((a, b) => 
        a.minDistance < b.minDistance ? a : b
      );
      throw createError('NO_FLY_ZONE_VIOLATION', worst.zone, worst.minDistance);
    }
  }
}

module.exports = NoFlyZoneChecker;
