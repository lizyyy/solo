import { PathPlan, PathWaypoint, YardConfig, ValidationResult, ValidationError, ValidationWarning, PathSegment } from '../types';
import { lineSegmentIntersectsBox, distance, generateId, pointInBox } from './geometry';

export const buildPathPlan = (waypoints: PathWaypoint[], name: string = '未命名方案'): PathPlan => {
  const segments: PathSegment[] = [];
  let totalDistance = 0;

  for (let i = 0; i < waypoints.length - 1; i++) {
    const from = waypoints[i];
    const to = waypoints[i + 1];
    const segDistance = distance(from.position, to.position);
    
    segments.push({
      id: generateId(),
      from: from.id,
      to: to.id,
      distance: segDistance
    });
    
    totalDistance += segDistance;
  }

  return {
    id: generateId(),
    name,
    createdAt: Date.now(),
    waypoints,
    segments,
    totalDistance
  };
};

export const validatePath = (plan: PathPlan, yard: YardConfig): ValidationResult => {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  if (plan.waypoints.length < 2) {
    return {
      isValid: false,
      errors: [{
        id: generateId(),
        type: 'boundary',
        severity: 'error',
        message: '路径至少需要两个航点'
      }],
      warnings: []
    };
  }

  checkBoundaryViolations(plan, yard, errors);
  checkForbiddenZoneViolations(plan, yard, errors);
  checkCollisions(plan, yard, errors);
  checkWarnings(plan, yard, warnings);

  return {
    isValid: errors.filter(e => e.severity === 'error').length === 0,
    errors,
    warnings
  };
};

const checkBoundaryViolations = (
  plan: PathPlan,
  yard: YardConfig,
  errors: ValidationError[]
): void => {
  const halfW = yard.width / 2;
  const halfL = yard.length / 2;

  plan.waypoints.forEach((wp, idx) => {
    const outOfBounds = 
      Math.abs(wp.position.x) > halfW ||
      Math.abs(wp.position.z) > halfL ||
      wp.position.y < 0 ||
      wp.position.y > yard.height;

    if (outOfBounds) {
      errors.push({
        id: generateId(),
        type: 'boundary',
        severity: 'error',
        message: `航点 ${idx + 1} (${wp.id.slice(-6)}) 超出堆场边界`,
        position: wp.position
      });
    }
  });
};

const checkForbiddenZoneViolations = (
  plan: PathPlan,
  yard: YardConfig,
  errors: ValidationError[]
): void => {
  plan.waypoints.forEach((wp, wpIdx) => {
    yard.forbiddenZones.forEach(zone => {
      if (pointInBox(wp.position, zone.position, zone.width, zone.length, zone.height)) {
        errors.push({
          id: generateId(),
          type: 'forbidden',
          severity: 'error',
          message: `航点 ${wpIdx + 1} 位于禁行区 "${zone.name}" 内: ${zone.reason}`,
          position: wp.position,
          zoneId: zone.id
        });
      }
    });
  });

  plan.segments.forEach((seg, segIdx) => {
    const from = plan.waypoints.find(w => w.id === seg.from);
    const to = plan.waypoints.find(w => w.id === seg.to);
    if (!from || !to) return;

    yard.forbiddenZones.forEach(zone => {
      if (lineSegmentIntersectsBox(
        from.position,
        to.position,
        zone.position,
        zone.width,
        zone.length,
        zone.height
      )) {
        errors.push({
          id: generateId(),
          type: 'forbidden',
          severity: 'error',
          message: `路径段 ${segIdx + 1} 穿过禁行区 "${zone.name}"`,
          position: {
            x: (from.position.x + to.position.x) / 2,
            y: (from.position.y + to.position.y) / 2,
            z: (from.position.z + to.position.z) / 2
          },
          segmentId: seg.id,
          zoneId: zone.id
        });
      }
    });
  });
};

const checkCollisions = (
  plan: PathPlan,
  yard: YardConfig,
  errors: ValidationError[]
): void => {
  const occupiedSlots = yard.slots.filter(s => s.occupied);

  plan.waypoints.forEach((wp, wpIdx) => {
    occupiedSlots.forEach(slot => {
      if (pointInBox(wp.position, slot.position, slot.width, slot.length, slot.height)) {
        errors.push({
          id: generateId(),
          type: 'collision',
          severity: 'error',
          message: `航点 ${wpIdx + 1} 与货位 "${slot.name}" 上的货物发生碰撞`,
          position: wp.position
        });
      }
    });
  });

  plan.segments.forEach((seg, segIdx) => {
    const from = plan.waypoints.find(w => w.id === seg.from);
    const to = plan.waypoints.find(w => w.id === seg.to);
    if (!from || !to) return;

    occupiedSlots.forEach(slot => {
      if (lineSegmentIntersectsBox(
        from.position,
        to.position,
        slot.position,
        slot.width,
        slot.length,
        slot.height
      )) {
        errors.push({
          id: generateId(),
          type: 'collision',
          severity: 'error',
          message: `路径段 ${segIdx + 1} 与货位 "${slot.name}" 上的货物发生碰撞`,
          position: {
            x: (from.position.x + to.position.x) / 2,
            y: (from.position.y + to.position.y) / 2,
            z: (from.position.z + to.position.z) / 2
          },
          segmentId: seg.id
        });
      }
    });
  });
};

const checkWarnings = (
  plan: PathPlan,
  _yard: YardConfig,
  warnings: ValidationWarning[]
): void => {
  for (let i = 0; i < plan.waypoints.length; i++) {
    const wp = plan.waypoints[i];
    if (wp.position.y > 0.5) {
      warnings.push({
        id: generateId(),
        type: 'elevation',
        message: `航点 ${i + 1} 高度较高 (${wp.position.y.toFixed(2)}m)，注意行驶安全`,
        position: wp.position
      });
    }
  }

  for (let i = 1; i < plan.segments.length - 1; i++) {
    const seg1 = plan.segments[i - 1];
    const seg2 = plan.segments[i];
    const turnPoint = plan.waypoints.find(w => w.id === seg1.to);
    
    if (turnPoint && Math.abs(seg1.distance - seg2.distance) > 20) {
      warnings.push({
        id: generateId(),
        type: 'turn',
        message: `在航点 "${turnPoint.id.slice(-6)}" 处转弯前后距离差异较大`,
        position: turnPoint.position
      });
    }
  }
};
