import type {
  Obstacle,
  Conflict,
  ConflictEvidence,
  FloorSketch,
  PointCloudLog,
  Position,
} from '../types';

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function calculateNameSimilarity(name1: string, name2: string): number {
  const s1 = name1.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]/g, '');
  const s2 = name2.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]/g, '');

  if (s1 === s2) return 1;
  if (s1.includes(s2) || s2.includes(s1)) return 0.8;

  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;

  if (longer.length === 0) return 1;

  const costs: number[] = [];
  for (let i = 0; i <= longer.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= shorter.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else if (j > 0) {
        let newValue = costs[j - 1];
        if (longer.charAt(i - 1) !== shorter.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) costs[shorter.length] = lastValue;
  }

  const distance = costs[shorter.length];
  return 1 - distance / longer.length;
}

export function calculatePositionDistance(pos1: Position, pos2: Position): number {
  return Math.sqrt(
    Math.pow(pos1.x - pos2.x, 2) +
    Math.pow(pos1.y - pos2.y, 2) +
    Math.pow(pos1.z - pos2.z, 2)
  );
}

export function calculateOverlapPercentage(
  obs1: Obstacle,
  obs2: Obstacle
): number {
  const overlapX = Math.max(
    0,
    Math.min(obs1.position.x + obs1.dimensions.width / 2, obs2.position.x + obs2.dimensions.width / 2) -
    Math.max(obs1.position.x - obs1.dimensions.width / 2, obs2.position.x - obs2.dimensions.width / 2)
  );

  const overlapY = Math.max(
    0,
    Math.min(obs1.position.y + obs1.dimensions.height / 2, obs2.position.y + obs2.dimensions.height / 2) -
    Math.max(obs1.position.y - obs1.dimensions.height / 2, obs2.position.y - obs2.dimensions.height / 2)
  );

  const overlapZ = Math.max(
    0,
    Math.min(obs1.position.z + obs1.dimensions.depth / 2, obs2.position.z + obs2.dimensions.depth / 2) -
    Math.max(obs1.position.z - obs1.dimensions.depth / 2, obs2.position.z - obs2.dimensions.depth / 2)
  );

  const overlapVolume = overlapX * overlapY * overlapZ;
  const volume1 = obs1.dimensions.width * obs1.dimensions.height * obs1.dimensions.depth;
  const volume2 = obs2.dimensions.width * obs2.dimensions.height * obs2.dimensions.depth;
  const minVolume = Math.min(volume1, volume2);

  return minVolume > 0 ? overlapVolume / minVolume : 0;
}

export function detectDuplicateNames(obstacles: Obstacle[]): Conflict[] {
  const conflicts: Conflict[] = [];
  const processed = new Set<string>();

  for (let i = 0; i < obstacles.length; i++) {
    for (let j = i + 1; j < obstacles.length; j++) {
      const obs1 = obstacles[i];
      const obs2 = obstacles[j];

      if (obs1.status === 'merged' || obs2.status === 'merged') continue;
      if (processed.has(`${obs1.id}-${obs2.id}`)) continue;

      const nameSimilarity = calculateNameSimilarity(obs1.currentName, obs2.currentName);
      const overlapPercentage = calculateOverlapPercentage(obs1, obs2);
      const coordinateDiff: Position = {
        x: Math.abs(obs1.position.x - obs2.position.x),
        y: Math.abs(obs1.position.y - obs2.position.y),
        z: Math.abs(obs1.position.z - obs2.position.z),
      };

      const isSameObstacle =
        (nameSimilarity >= 0.6 && overlapPercentage >= 0.3) ||
        (nameSimilarity >= 0.4 && overlapPercentage >= 0.7) ||
        overlapPercentage >= 0.9;

      if (isSameObstacle && obs1.currentName !== obs2.currentName) {
        const evidence: ConflictEvidence = {
          sketchData: obs1,
          pointCloudData: obs2,
          overlapPercentage,
          nameSimilarity,
          coordinateDiff,
          nameHistory1: obs1.nameHistory,
          nameHistory2: obs2.nameHistory,
        };

        const conflict: Conflict = {
          id: generateId(),
          type: 'duplicate-name',
          obstacleIds: [obs1.id, obs2.id],
          evidence,
          status: 'pending',
          requiresReview: true,
          createdAt: new Date(),
        };

        conflicts.push(conflict);
        processed.add(`${obs1.id}-${obs2.id}`);
      }
    }
  }

  return conflicts;
}

export function detectPositionOverlap(obstacles: Obstacle[]): Conflict[] {
  const conflicts: Conflict[] = [];

  for (let i = 0; i < obstacles.length; i++) {
    for (let j = i + 1; j < obstacles.length; j++) {
      const obs1 = obstacles[i];
      const obs2 = obstacles[j];

      if (obs1.status === 'merged' || obs2.status === 'merged') continue;

      const overlapPercentage = calculateOverlapPercentage(obs1, obs2);

      if (overlapPercentage >= 0.5 && obs1.source !== obs2.source) {
        const nameSimilarity = calculateNameSimilarity(obs1.currentName, obs2.currentName);
        const coordinateDiff: Position = {
          x: Math.abs(obs1.position.x - obs2.position.x),
          y: Math.abs(obs1.position.y - obs2.position.y),
          z: Math.abs(obs1.position.z - obs2.position.z),
        };

        const evidence: ConflictEvidence = {
          sketchData: obs1,
          pointCloudData: obs2,
          overlapPercentage,
          nameSimilarity,
          coordinateDiff,
        };

        const conflict: Conflict = {
          id: generateId(),
          type: 'position-overlap',
          obstacleIds: [obs1.id, obs2.id],
          evidence,
          status: 'pending',
          requiresReview: true,
          createdAt: new Date(),
        };

        conflicts.push(conflict);
      }
    }
  }

  return conflicts;
}

export function detectSketchPointCloudInconsistency(
  sketchObstacles: Obstacle[],
  pointCloudObstacles: Obstacle[]
): Conflict[] {
  const conflicts: Conflict[] = [];

  for (const sketchObs of sketchObstacles) {
    let bestMatch: Obstacle | null = null;
    let bestOverlap = 0;

    for (const pcObs of pointCloudObstacles) {
      const overlap = calculateOverlapPercentage(sketchObs, pcObs);
      if (overlap > bestOverlap) {
        bestOverlap = overlap;
        bestMatch = pcObs;
      }
    }

    if (bestMatch && bestOverlap >= 0.5) {
      const nameSimilarity = calculateNameSimilarity(sketchObs.currentName, bestMatch.currentName);

      if (nameSimilarity < 0.3) {
        const coordinateDiff: Position = {
          x: Math.abs(sketchObs.position.x - bestMatch.position.x),
          y: Math.abs(sketchObs.position.y - bestMatch.position.y),
          z: Math.abs(sketchObs.position.z - bestMatch.position.z),
        };

        const evidence: ConflictEvidence = {
          sketchData: sketchObs,
          pointCloudData: bestMatch,
          overlapPercentage: bestOverlap,
          nameSimilarity,
          coordinateDiff,
        };

        const conflict: Conflict = {
          id: generateId(),
          type: 'data-inconsistency',
          obstacleIds: [sketchObs.id, bestMatch.id],
          evidence,
          status: 'pending',
          requiresReview: true,
          createdAt: new Date(),
        };

        conflicts.push(conflict);
      }
    }
  }

  return conflicts;
}

export function detectAllConflicts(
  sketchObstacles: Obstacle[],
  pointCloudObstacles: Obstacle[] = []
): Conflict[] {
  const allObstacles = [...sketchObstacles, ...pointCloudObstacles];

  const duplicateNameConflicts = detectDuplicateNames(allObstacles);
  const positionOverlapConflicts = detectPositionOverlap(allObstacles);
  const inconsistencyConflicts = detectSketchPointCloudInconsistency(
    sketchObstacles,
    pointCloudObstacles
  );

  const seen = new Set<string>();
  const allConflicts: Conflict[] = [];

  for (const conflict of [...duplicateNameConflicts, ...positionOverlapConflicts, ...inconsistencyConflicts]) {
    const key = conflict.obstacleIds.sort().join('-');
    if (!seen.has(key)) {
      seen.add(key);
      allConflicts.push(conflict);
    }
  }

  return allConflicts;
}
