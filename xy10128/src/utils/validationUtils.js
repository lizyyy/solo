import { getInstrumentBoundingBox, getDistanceBetweenInstruments, getInstrumentCenter } from './instrumentUtils';

export const ZONE_CONFIG = {
  sterileZone: {
    minX: -3,
    maxX: 3,
    minZ: -2,
    maxZ: 2,
    y: 0.9
  },
  pathway: {
    x: 0,
    z: -4,
    length: 8,
    width: 1.5
  }
};

export function checkCollision(instrument1, instrument2) {
  const box1 = getInstrumentBoundingBox(instrument1);
  const box2 = getInstrumentBoundingBox(instrument2);
  
  return box1.intersectsBox(box2);
}

export function checkAllCollisions(instruments) {
  const collisions = [];
  const instrumentList = Object.values(instruments);
  
  for (let i = 0; i < instrumentList.length; i++) {
    for (let j = i + 1; j < instrumentList.length; j++) {
      const inst1 = instrumentList[i];
      const inst2 = instrumentList[j];
      
      if (checkCollision(inst1, inst2)) {
        const distance = getDistanceBetweenInstruments(inst1, inst2);
        collisions.push({
          type: 'collision',
          instrument1: inst1.userData.id,
          instrument2: inst2.userData.id,
          instrument1Name: inst1.userData.name,
          instrument2Name: inst2.userData.name,
          distance: distance,
          severity: 'high'
        });
      }
    }
  }
  
  return collisions;
}

export function checkMinDistanceViolations(instruments) {
  const violations = [];
  const instrumentList = Object.values(instruments);
  
  for (let i = 0; i < instrumentList.length; i++) {
    for (let j = i + 1; j < instrumentList.length; j++) {
      const inst1 = instrumentList[i];
      const inst2 = instrumentList[j];
      
      const distance = getDistanceBetweenInstruments(inst1, inst2);
      const minDistance = Math.max(
        inst1.userData.config.minDistance,
        inst2.userData.config.minDistance
      );
      
      if (distance < minDistance && !checkCollision(inst1, inst2)) {
        violations.push({
          type: 'min_distance',
          instrument1: inst1.userData.id,
          instrument2: inst2.userData.id,
          instrument1Name: inst1.userData.name,
          instrument2Name: inst2.userData.name,
          actualDistance: distance,
          requiredDistance: minDistance,
          deficit: minDistance - distance,
          severity: 'medium'
        });
      }
    }
  }
  
  return violations;
}

export function checkBoundary(instrument, zone = ZONE_CONFIG.sterileZone) {
  const center = getInstrumentCenter(instrument);
  const box = getInstrumentBoundingBox(instrument);
  
  const outsideX = box.min.x < zone.minX || box.max.x > zone.maxX;
  const outsideZ = box.min.z < zone.minZ || box.max.z > zone.maxZ;
  
  const violations = [];
  
  if (outsideX || outsideZ) {
    let outsideDistance = 0;
    
    if (box.min.x < zone.minX) {
      outsideDistance += zone.minX - box.min.x;
    }
    if (box.max.x > zone.maxX) {
      outsideDistance += box.max.x - zone.maxX;
    }
    if (box.min.z < zone.minZ) {
      outsideDistance += zone.minZ - box.min.z;
    }
    if (box.max.z > zone.maxZ) {
      outsideDistance += box.max.z - zone.maxZ;
    }
    
    violations.push({
      type: 'boundary',
      instrument: instrument.userData.id,
      instrumentName: instrument.userData.name,
      outsideDistance: outsideDistance,
      zone: 'sterile_zone',
      position: {
        x: center.x,
        z: center.z
      },
      severity: 'high'
    });
  }
  
  return violations;
}

export function checkAllBoundaries(instruments, zone = ZONE_CONFIG.sterileZone) {
  const violations = [];
  const instrumentList = Object.values(instruments);
  
  instrumentList.forEach(instrument => {
    const boundaryViolations = checkBoundary(instrument, zone);
    violations.push(...boundaryViolations);
  });
  
  return violations;
}

export function checkPathwayObstruction(instruments, pathway = ZONE_CONFIG.pathway) {
  const obstructions = [];
  const instrumentList = Object.values(instruments);
  
  const pathwayMinX = pathway.x - pathway.width / 2;
  const pathwayMaxX = pathway.x + pathway.width / 2;
  const pathwayMinZ = pathway.z - pathway.length / 2;
  const pathwayMaxZ = pathway.z + pathway.length / 2;
  
  instrumentList.forEach(instrument => {
    const box = getInstrumentBoundingBox(instrument);
    
    const overlapsX = box.min.x < pathwayMaxX && box.max.x > pathwayMinX;
    const overlapsZ = box.min.z < pathwayMaxZ && box.max.z > pathwayMinZ;
    
    if (overlapsX && overlapsZ) {
      const overlapX = Math.min(box.max.x, pathwayMaxX) - Math.max(box.min.x, pathwayMinX);
      const overlapZ = Math.min(box.max.z, pathwayMaxZ) - Math.max(box.min.z, pathwayMinZ);
      const overlapArea = overlapX * overlapZ;
      
      obstructions.push({
        type: 'pathway',
        instrument: instrument.userData.id,
        instrumentName: instrument.userData.name,
        overlapArea: overlapArea,
        overlapX: overlapX,
        overlapZ: overlapZ,
        severity: overlapArea > 0.5 ? 'high' : 'medium'
      });
    }
  });
  
  return obstructions;
}

export function runAllValidations(instruments, zone = ZONE_CONFIG.sterileZone, pathway = ZONE_CONFIG.pathway) {
  const results = {
    collisions: checkAllCollisions(instruments),
    distanceViolations: checkMinDistanceViolations(instruments),
    boundaryViolations: checkAllBoundaries(instruments, zone),
    pathwayObstructions: checkPathwayObstruction(instruments, pathway)
  };
  
  results.issues = [
    ...results.collisions,
    ...results.distanceViolations,
    ...results.boundaryViolations,
    ...results.pathwayObstructions
  ];
  
  results.highSeverityIssues = results.issues.filter(issue => issue.severity === 'high');
  results.mediumSeverityIssues = results.issues.filter(issue => issue.severity === 'medium');
  results.lowSeverityIssues = results.issues.filter(issue => issue.severity === 'low');
  
  results.isValid = results.highSeverityIssues.length === 0;
  results.hasWarnings = results.mediumSeverityIssues.length > 0;
  
  return results;
}

export function getValidationSummary(validationResults) {
  const summary = {
    totalIssues: validationResults.issues.length,
    high: validationResults.highSeverityIssues.length,
    medium: validationResults.mediumSeverityIssues.length,
    low: validationResults.lowSeverityIssues.length,
    collisions: validationResults.collisions.length,
    distanceViolations: validationResults.distanceViolations.length,
    boundaryViolations: validationResults.boundaryViolations.length,
    pathwayObstructions: validationResults.pathwayObstructions.length,
    isValid: validationResults.isValid,
    hasWarnings: validationResults.hasWarnings
  };
  
  return summary;
}

export function getInstrumentIssues(instrumentId, validationResults) {
  return validationResults.issues.filter(issue => 
    issue.instrument === instrumentId ||
    issue.instrument1 === instrumentId ||
    issue.instrument2 === instrumentId
  );
}

export function checkSterileZoneAccessibility(instrument, pathway = ZONE_CONFIG.pathway) {
  const center = getInstrumentCenter(instrument);
  
  const distToPathwayX = Math.abs(center.x - pathway.x);
  const distToPathwayZ = Math.abs(center.z - pathway.z);
  
  const accessScore = Math.max(0, 5 - (distToPathwayX + distToPathwayZ) / 2);
  
  return {
    instrument: instrument.userData.id,
    instrumentName: instrument.userData.name,
    accessScore: Math.round(accessScore * 100) / 100,
    distanceToPathway: Math.sqrt(distToPathwayX ** 2 + distToPathwayZ ** 2)
  };
}
