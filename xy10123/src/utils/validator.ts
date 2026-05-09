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

export function validateProject(project: ProjectData): ValidationResult[] {
  const results: ValidationResult[] = [];
  
  results.push(...validateBooths(project.booths, project.config));
  results.push(...validateExits(project.exits, project.booths, project.config));
  results.push(...validateZones(project.zones, project.evacuationPaths, project.config));
  
  return results;
}

function validateBooths(booths: Booth[], config: SimulationConfig): ValidationResult[] {
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
  }
  
  return results;
}

function validateExits(
  exits: Exit[],
  booths: Booth[],
  config: SimulationConfig
): ValidationResult[] {
  const results: ValidationResult[] = [];
  
  if (exits.length === 0) {
    results.push({
      status: 'error',
      message: '展馆未设置安全出口'
    });
    return results;
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
  config: SimulationConfig
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
