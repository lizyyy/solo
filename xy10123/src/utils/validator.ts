import type {
  ProjectData,
  ValidationResult,
  Booth,
  Zone,
  Exit,
  EvacuationPath,
  SimulationConfig
} from '../types';
import {
  checkBoothOverlap,
  getShortestPathForZone
} from './';

export interface BoundaryCheckResult {
  isWithinBounds: boolean;
  violations: string[];
}

export function checkRectWithinBounds(
  position: { x: number; z: number },
  dimension: { width: number; depth: number },
  hallWidth: number,
  hallDepth: number,
  tolerance: number = 0
): BoundaryCheckResult {
  const violations: string[] = [];
  
  if (isNaN(position.x) || isNaN(position.z) || 
      isNaN(dimension.width) || isNaN(dimension.depth)) {
    return { isWithinBounds: false, violations: ['坐标或尺寸包含无效值'] };
  }
  
  if (dimension.width <= 0 || dimension.depth <= 0) {
    return { isWithinBounds: false, violations: ['尺寸必须大于0'] };
  }
  
  if (position.x < -tolerance) {
    violations.push(`左边界超出 ${(-position.x + tolerance).toFixed(2)} 米`);
  }
  if (position.z < -tolerance) {
    violations.push(`前边界超出 ${(-position.z + tolerance).toFixed(2)} 米`);
  }
  if (position.x + dimension.width > hallWidth + tolerance) {
    violations.push(`右边界超出 ${(position.x + dimension.width - hallWidth - tolerance).toFixed(2)} 米`);
  }
  if (position.z + dimension.depth > hallDepth + tolerance) {
    violations.push(`后边界超出 ${(position.z + dimension.depth - hallDepth - tolerance).toFixed(2)} 米`);
  }
  
  return {
    isWithinBounds: violations.length === 0,
    violations
  };
}

export function checkPointWithinBounds(
  position: { x: number; z: number },
  hallWidth: number,
  hallDepth: number,
  tolerance: number = 0
): BoundaryCheckResult {
  const violations: string[] = [];
  
  if (isNaN(position.x) || isNaN(position.z)) {
    return { isWithinBounds: false, violations: ['坐标包含无效值'] };
  }
  
  if (position.x < -tolerance) {
    violations.push(`X坐标越界 ${(-position.x + tolerance).toFixed(2)} 米`);
  }
  if (position.z < -tolerance) {
    violations.push(`Z坐标越界 ${(-position.z + tolerance).toFixed(2)} 米`);
  }
  if (position.x > hallWidth + tolerance) {
    violations.push(`X坐标越界 ${(position.x - hallWidth - tolerance).toFixed(2)} 米`);
  }
  if (position.z > hallDepth + tolerance) {
    violations.push(`Z坐标越界 ${(position.z - hallDepth - tolerance).toFixed(2)} 米`);
  }
  
  return {
    isWithinBounds: violations.length === 0,
    violations
  };
}

export function validateProject(project: ProjectData): ValidationResult[] {
  const results: ValidationResult[] = [];
  const hallWidth = project.exhibitionHall.width;
  const hallDepth = project.exhibitionHall.depth;
  
  results.push(...validateBooths(project.booths, project.config, hallWidth, hallDepth));
  results.push(...validateExits(project.exits, project.booths, project.config, hallWidth, hallDepth));
  results.push(...validateZones(project.zones, project.evacuationPaths, project.config, hallWidth, hallDepth));
  
  return results;
}

function validateBooths(
  booths: Booth[], 
  config: SimulationConfig,
  hallWidth: number,
  hallDepth: number
): ValidationResult[] {
  const results: ValidationResult[] = [];
  
  if (booths.length === 0) {
    return results;
  }
  
  if (config.checkBoothOverlap) {
    const overlaps = checkBoothOverlap(booths);
    
    for (const overlap of overlaps) {
      const booth1 = booths.find(b => b.id === overlap.booth1);
      const booth2 = booths.find(b => b.id === overlap.booth2);
      
      if (booth1 && booth2) {
        results.push({
          status: 'error',
          message: `展位「${booth1.name}」与「${booth2.name}」发生重叠`,
          boothId: overlap.booth1,
          details: {
            overlappingWith: overlap.booth2,
            booth1Name: booth1.name,
            booth2Name: booth2.name
          }
        });
      }
    }
  }
  
  for (const booth of booths) {
    const boundaryCheck = checkRectWithinBounds(
      booth.position,
      booth.dimension,
      hallWidth,
      hallDepth
    );
    
    if (!boundaryCheck.isWithinBounds) {
      results.push({
        status: 'error',
        message: `展位「${booth.name}」超出展馆边界：${boundaryCheck.violations.join('；')}`,
        boothId: booth.id,
        details: {
          boothName: booth.name,
          position: `${booth.position.x.toFixed(2)}, ${booth.position.z.toFixed(2)}`,
          dimension: `${booth.dimension.width} x ${booth.dimension.depth}`,
          violations: boundaryCheck.violations.join(', ')
        }
      });
    }
    
    if (booth.dimension.width < 0.5 || booth.dimension.depth < 0.5) {
      results.push({
        status: 'warning',
        message: `展位「${booth.name}」尺寸过小（建议最小尺寸：宽 x 深 = 0.5 x 0.5）`,
        boothId: booth.id,
        details: {
          width: booth.dimension.width,
          depth: booth.dimension.depth,
          minWidth: 0.5,
          minDepth: 0.5
        }
      });
    }
    
    if (booth.dimension.width > 20 || booth.dimension.depth > 20) {
      results.push({
        status: 'warning',
        message: `展位「${booth.name}」尺寸过大（建议最大尺寸：宽 x 深 = 20 x 20）`,
        boothId: booth.id,
        details: {
          width: booth.dimension.width,
          depth: booth.dimension.depth,
          maxWidth: 20,
          maxDepth: 20
        }
      });
    }
    
    if (booth.dimension.width <= 0 || booth.dimension.depth <= 0) {
      results.push({
        status: 'error',
        message: `展位「${booth.name}」尺寸无效（宽度和深度必须大于0）`,
        boothId: booth.id,
        details: {
          width: booth.dimension.width,
          depth: booth.dimension.depth
        }
      });
    }
  }
  
  return results;
}

function validateExits(
  exits: Exit[],
  booths: Booth[],
  config: SimulationConfig,
  hallWidth: number,
  hallDepth: number
): ValidationResult[] {
  const results: ValidationResult[] = [];
  
  if (exits.length === 0) {
    results.push({
      status: 'error',
      message: '展馆未设置安全出口'
    });
    return results;
  }
  
  for (const exit of exits) {
    const boundaryCheck = checkPointWithinBounds(
      exit.position,
      hallWidth,
      hallDepth,
      0.5
    );
    
    if (!boundaryCheck.isWithinBounds) {
      results.push({
        status: 'error',
        message: `安全出口「${exit.name}」超出展馆边界：${boundaryCheck.violations.join('；')}`,
        exitId: exit.id,
        details: {
          exitName: exit.name,
          position: `${exit.position.x.toFixed(2)}, ${exit.position.z.toFixed(2)}`,
          violations: boundaryCheck.violations.join(', ')
        }
      });
    }
    
    if (exit.width <= 0) {
      results.push({
        status: 'error',
        message: `安全出口「${exit.name}」宽度无效（必须大于0）`,
        exitId: exit.id,
        details: {
          width: exit.width
        }
      });
    }
  }
  
  if (config.checkExitAccessibility) {
    for (const exit of exits) {
      const blockedBy = booths.find(booth => {
        const exitCenter = { x: exit.position.x, z: exit.position.z };
        const boothCenter = {
          x: booth.position.x + booth.dimension.width / 2,
          z: booth.position.z + booth.dimension.depth / 2
        };
        
        const distance = Math.sqrt(
          Math.pow(exitCenter.x - boothCenter.x, 2) +
          Math.pow(exitCenter.z - boothCenter.z, 2)
        );
        
        return distance < 2.0;
      });
      
      if (blockedBy) {
        results.push({
          status: 'error',
          message: `安全出口「${exit.name}」被展位「${blockedBy.name}」阻挡`,
          exitId: exit.id,
          boothId: blockedBy.id,
          details: {
            exitName: exit.name,
            blockingBooth: blockedBy.name
          }
        });
      }
    }
  }
  
  return results;
}

function validateZones(
  zones: Zone[],
  paths: EvacuationPath[],
  config: SimulationConfig,
  hallWidth: number,
  hallDepth: number
): ValidationResult[] {
  const results: ValidationResult[] = [];
  
  if (zones.length === 0) {
    results.push({
      status: 'warning',
      message: '展馆未设置疏散区域'
    });
    return results;
  }
  
  for (const zone of zones) {
    const boundaryCheck = checkRectWithinBounds(
      zone.position,
      zone.dimension,
      hallWidth,
      hallDepth
    );
    
    if (!boundaryCheck.isWithinBounds) {
      results.push({
        status: 'error',
        message: `区域「${zone.name}」超出展馆边界：${boundaryCheck.violations.join('；')}`,
        zoneId: zone.id,
        details: {
          zoneName: zone.name,
          position: `${zone.position.x.toFixed(2)}, ${zone.position.z.toFixed(2)}`,
          dimension: `${zone.dimension.width} x ${zone.dimension.depth}`,
          violations: boundaryCheck.violations.join(', ')
        }
      });
    }
    
    if (zone.dimension.width <= 0 || zone.dimension.depth <= 0) {
      results.push({
        status: 'error',
        message: `区域「${zone.name}」尺寸无效（宽度和深度必须大于0）`,
        zoneId: zone.id,
        details: {
          width: zone.dimension.width,
          depth: zone.dimension.depth
        }
      });
    }
  }
  
  for (const zone of zones) {
    const shortestPath = getShortestPathForZone(zone.id, paths);
    
    if (!shortestPath || shortestPath.isBlocked) {
      results.push({
        status: 'error',
        message: `区域「${zone.name}」到所有安全出口的路径被完全阻断`,
        zoneId: zone.id,
        details: {
          zoneName: zone.name,
          blocked: true
        }
      });
    } else {
      const distanceRatio = shortestPath.distance / config.maxEvacuationDistance;
      
      if (shortestPath.distance > config.maxEvacuationDistance) {
        results.push({
          status: 'error',
          message: `区域「${zone.name}」的最短疏散距离（${shortestPath.distance.toFixed(1)}米）超过最大限制（${config.maxEvacuationDistance}米）`,
          zoneId: zone.id,
          details: {
            zoneName: zone.name,
            actualDistance: shortestPath.distance,
            maxDistance: config.maxEvacuationDistance,
            exitId: shortestPath.toExit,
            overLimit: true
          }
        });
      } else if (distanceRatio > 0.8) {
        results.push({
          status: 'warning',
          message: `区域「${zone.name}」的最短疏散距离（${shortestPath.distance.toFixed(1)}米）接近最大限制（${config.maxEvacuationDistance}米）`,
          zoneId: zone.id,
          details: {
            zoneName: zone.name,
            actualDistance: shortestPath.distance,
            maxDistance: config.maxEvacuationDistance,
            warningThreshold: 0.8
          }
        });
      } else {
        results.push({
          status: 'ok',
          message: `区域「${zone.name}」疏散路线正常，距离为 ${shortestPath.distance.toFixed(1)} 米`,
          zoneId: zone.id,
          details: {
            zoneName: zone.name,
            actualDistance: shortestPath.distance,
            maxDistance: config.maxEvacuationDistance
          }
        });
      }
    }
  }
  
  return results;
}

export function getValidationSummary(results: ValidationResult[]): {
  ok: number;
  warning: number;
  error: number;
} {
  return {
    ok: results.filter(r => r.status === 'ok').length,
    warning: results.filter(r => r.status === 'warning').length,
    error: results.filter(r => r.status === 'error').length
  };
}

export function hasCriticalErrors(results: ValidationResult[]): boolean {
  return results.some(r => r.status === 'error');
}
