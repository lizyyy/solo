import { 
  SceneData, 
  ValidationResult, 
  ValidationError,
  Point3D,
  RiskZone
} from '../types';

function pointInPolygon(point: Point3D, polygon: Point3D[]): boolean {
  let inside = false;
  const n = polygon.length;
  
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].x, zi = polygon[i].z;
    const xj = polygon[j].x, zj = polygon[j].z;
    
    if (((zi > point.z) !== (zj > point.z)) &&
        (point.x < (xj - xi) * (point.z - zi) / (zj - zi) + xi)) {
      inside = !inside;
    }
  }
  
  return inside;
}

function lineIntersectsPolygon(
  p1: Point3D, 
  p2: Point3D, 
  polygon: Point3D[]
): boolean {
  const steps = 20;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const testPoint: Point3D = {
      x: p1.x + (p2.x - p1.x) * t,
      y: 0,
      z: p1.z + (p2.z - p1.z) * t
    };
    if (pointInPolygon(testPoint, polygon)) {
      return true;
    }
  }
  return false;
}

export function validateElevationUnit(sceneData: SceneData): ValidationError | null {
  const { heightmap } = sceneData.terrain;
  
  let maxHeight = -Infinity;
  let minHeight = Infinity;
  
  for (const row of heightmap) {
    for (const h of row) {
      maxHeight = Math.max(maxHeight, h);
      minHeight = Math.min(minHeight, h);
    }
  }
  
  const heightRange = maxHeight - minHeight;
  
  if (heightRange > 500) {
    return {
      type: 'elevation_unit',
      severity: 'error',
      message: '高程数据范围异常，可能存在单位错误',
      details: `检测到高程范围为 ${minHeight.toFixed(1)} ~ ${maxHeight.toFixed(1)} ${sceneData.terrain.unit}，超出正常滑雪场范围。请确认单位是否正确。`,
      location: { x: sceneData.terrain.width / 2, y: 0, z: sceneData.terrain.depth / 2 }
    };
  }
  
  if (heightRange < 5) {
    return {
      type: 'elevation_unit',
      severity: 'warning',
      message: '高程数据变化较小',
      details: `检测到高程范围仅为 ${heightRange.toFixed(1)} ${sceneData.terrain.unit}，可能存在单位缩放问题。`,
      location: { x: sceneData.terrain.width / 2, y: 0, z: sceneData.terrain.depth / 2 }
    };
  }
  
  return null;
}

export function validateTrajectoryBounds(sceneData: SceneData): ValidationError[] {
  const errors: ValidationError[] = [];
  const { width, depth } = sceneData.terrain;
  
  sceneData.trajectories.forEach((trajectory, trajIndex) => {
    trajectory.points.forEach((point, pointIndex) => {
      if (point.x < 0 || point.x > width || point.z < 0 || point.z > depth) {
        errors.push({
          type: 'trajectory_out_of_bounds',
          severity: 'error',
          message: `轨迹 "${trajectory.skierName}" 越界`,
          details: `第 ${pointIndex + 1} 个轨迹点 (${point.x.toFixed(1)}, ${point.z.toFixed(1)}) 超出地形边界 (0~${width}, 0~${depth})。`,
          location: { x: point.x, y: 0, z: point.z }
        });
      }
    });
  });
  
  return errors;
}

export function validateRescueRoutes(
  sceneData: SceneData
): ValidationError[] {
  const errors: ValidationError[] = [];
  const closedZones = sceneData.riskZones.filter(zone => zone.isClosed);
  
  sceneData.rescueRoutes.forEach(route => {
    closedZones.forEach(zone => {
      for (let i = 0; i < route.points.length - 1; i++) {
        if (lineIntersectsPolygon(route.points[i], route.points[i + 1], zone.polygon)) {
          errors.push({
            type: 'route_through_closed_zone',
            severity: 'error',
            message: `${route.name} 穿过关闭区域`,
            details: `救援路线穿越了关闭区域 "${zone.name}"（原因：${zone.reason}）。请重新规划救援路线。`,
            location: { 
              x: (route.points[i].x + route.points[i + 1].x) / 2, 
              y: 0, 
              z: (route.points[i].z + route.points[i + 1].z) / 2 
            }
          });
          break;
        }
      }
    });
  });
  
  return errors;
}

export function validateSceneData(sceneData: SceneData): ValidationResult {
  const errors: ValidationError[] = [];
  
  const elevationError = validateElevationUnit(sceneData);
  if (elevationError) errors.push(elevationError);
  
  errors.push(...validateTrajectoryBounds(sceneData));
  errors.push(...validateRescueRoutes(sceneData));
  
  return {
    isValid: errors.length === 0 || errors.every(e => e.severity === 'warning'),
    errors
  };
}

export function getSeverityColor(severity: 'error' | 'warning'): string {
  return severity === 'error' ? '#F53F3F' : '#FF7D00';
}

export function getRiskLevelColor(level: 'low' | 'medium' | 'high'): string {
  switch (level) {
    case 'low': return '#00B42A';
    case 'medium': return '#FF7D00';
    case 'high': return '#F53F3F';
  }
}

export function getRiskLevelOpacity(level: 'low' | 'medium' | 'high'): number {
  switch (level) {
    case 'low': return 0.2;
    case 'medium': return 0.3;
    case 'high': return 0.4;
  }
}

export default validateSceneData;
