import { AnomalyType } from '../models/types.js';
import { AnalysisResult, Point } from '../models/interfaces.js';

export class AnomalyDetector {
  constructor(config = {}) {
    this.config = {
      stayThreshold: config.stayThreshold || 30,
      speedThreshold: config.speedThreshold || 0.1,
      congestionThreshold: config.congestionThreshold || 5,
      distanceThreshold: config.distanceThreshold || 2.0
    };
  }

  analyzePerson(person, pathFinder, exits, allEdges) {
    const analysis = new AnalysisResult(person.id);
    
    if (person.trajectory.length === 0) return analysis;
    
    analysis.actualTime = person.getTotalTime();
    analysis.actualDistance = person.getTotalDistance();
    
    const startPoint = person.trajectory[0].position;
    const endPoint = person.trajectory[person.trajectory.length - 1].position;
    
    const shortestPathResult = pathFinder.findShortestPathToAnyExit(
      startPoint,
      exits,
      person.trajectory[0].time,
      true
    );
    
    analysis.optimalDistance = shortestPathResult.distance;
    analysis.detourDistance = Math.max(0, analysis.actualDistance - analysis.optimalDistance);
    analysis.detourRatio = analysis.optimalDistance > 0 
      ? analysis.detourDistance / analysis.optimalDistance 
      : 0;
    
    for (const exit of exits) {
      if (!exit.isSafe) continue;
      const dist = endPoint.distanceTo(exit.position);
      if (dist < this.config.distanceThreshold) {
        analysis.reachedExit = exit;
        break;
      }
    }
    
    if (analysis.reachedExit && shortestPathResult.exit) {
      analysis.reachedNearestExit = analysis.reachedExit.id === shortestPathResult.exit.id;
      
      if (!analysis.reachedNearestExit) {
        analysis.addAnomaly(
          AnomalyType.WRONG_EXIT,
          person.trajectory[person.trajectory.length - 1].time,
          endPoint,
          `未选择最近出口。最近出口: ${shortestPathResult.exit.id}, 实际选择: ${analysis.reachedExit.id}`
        );
      }
    }
    
    this.detectBlockedPathUsage(person, analysis, allEdges);
    this.detectLongStays(person, analysis);
    this.detectWrongDirection(person, analysis, shortestPathResult.path);
    
    return analysis;
  }

  detectBlockedPathUsage(person, analysis, allEdges) {
    for (const trajPoint of person.trajectory) {
      for (const edge of allEdges) {
        if (edge.isBlockedAt(trajPoint.time)) {
          const dist = this.pointToEdgeDistance(trajPoint.position, edge);
          if (dist < this.config.distanceThreshold) {
            analysis.usedBlockedPaths.push({
              edge,
              time: trajPoint.time,
              position: trajPoint.position.clone()
            });
            
            analysis.addAnomaly(
              AnomalyType.BLOCKED_PATH,
              trajPoint.time,
              trajPoint.position,
              `经过封闭通道: ${edge.id}, 原因: ${edge.blockReason || '未知'}`
            );
          }
        }
      }
    }
  }

  detectLongStays(person, analysis) {
    if (person.trajectory.length < 2) return;
    
    let stayStart = null;
    let stayPos = null;
    
    for (let i = 1; i < person.trajectory.length; i++) {
      const prev = person.trajectory[i - 1];
      const curr = person.trajectory[i];
      
      const dist = prev.position.distanceTo(curr.position);
      const timeDiff = curr.time - prev.time;
      
      if (dist < this.config.speedThreshold * timeDiff) {
        if (stayStart === null) {
          stayStart = prev.time;
          stayPos = prev.position;
        }
      } else {
        if (stayStart !== null) {
          const duration = prev.time - stayStart;
          if (duration >= this.config.stayThreshold) {
            analysis.addStayPoint(stayStart, prev.time, stayPos, duration);
            analysis.addAnomaly(
              AnomalyType.STAY_TOO_LONG,
              stayStart,
              stayPos,
              `异常停留 ${duration.toFixed(1)} 秒`
            );
          }
          stayStart = null;
          stayPos = null;
        }
      }
    }
    
    if (stayStart !== null) {
      const lastPoint = person.trajectory[person.trajectory.length - 1];
      const duration = lastPoint.time - stayStart;
      if (duration >= this.config.stayThreshold) {
        analysis.addStayPoint(stayStart, lastPoint.time, stayPos, duration);
        analysis.addAnomaly(
          AnomalyType.STAY_TOO_LONG,
          stayStart,
          stayPos,
          `异常停留 ${duration.toFixed(1)} 秒`
        );
      }
    }
  }

  detectWrongDirection(person, analysis, optimalPath) {
    if (optimalPath.length < 2 || person.trajectory.length < 2) return;
    
    for (let i = 1; i < person.trajectory.length; i++) {
      const prev = person.trajectory[i - 1];
      const curr = person.trajectory[i];
      
      const moveVec = {
        x: curr.position.x - prev.position.x,
        y: curr.position.y - prev.position.y
      };
      const moveLen = Math.sqrt(moveVec.x * moveVec.x + moveVec.y * moveVec.y);
      
      if (moveLen < 0.5) continue;
      
      const nearNodeIndex = this.findNearestPathIndex(prev.position, optimalPath);
      if (nearNodeIndex < 0 || nearNodeIndex >= optimalPath.length - 1) continue;
      
      const nextOptimal = optimalPath[nearNodeIndex + 1];
      const optimalDir = {
        x: nextOptimal.position.x - prev.position.x,
        y: nextOptimal.position.y - prev.position.y
      };
      const optimalLen = Math.sqrt(optimalDir.x * optimalDir.x + optimalDir.y * optimalDir.y);
      
      if (optimalLen < 0.5) continue;
      
      const dotProduct = (moveVec.x * optimalDir.x + moveVec.y * optimalDir.y) / (moveLen * optimalLen);
      
      if (dotProduct < -0.3) {
        analysis.addAnomaly(
          AnomalyType.WRONG_DIRECTION,
          prev.time,
          prev.position.clone(),
          `移动方向与最优路径偏差较大，角度偏差约 ${Math.acos(dotProduct) * 180 / Math.PI.toFixed(1)} 度`
        );
      }
    }
  }

  findNearestPathIndex(point, path) {
    let nearestIndex = -1;
    let minDist = Infinity;
    
    for (let i = 0; i < path.length; i++) {
      const dist = point.distanceTo(path[i].position);
      if (dist < minDist) {
        minDist = dist;
        nearestIndex = i;
      }
    }
    
    return nearestIndex;
  }

  pointToEdgeDistance(point, edge) {
    const p1 = edge.from.position;
    const p2 = edge.to.position;
    
    if (p1.floor !== point.floor || p2.floor !== point.floor) return Infinity;
    
    const lineVec = { x: p2.x - p1.x, y: p2.y - p1.y };
    const pointVec = { x: point.x - p1.x, y: point.y - p1.y };
    
    const lineLenSq = lineVec.x * lineVec.x + lineVec.y * lineVec.y;
    if (lineLenSq === 0) return point.distanceTo(p1);
    
    let t = (pointVec.x * lineVec.x + pointVec.y * lineVec.y) / lineLenSq;
    t = Math.max(0, Math.min(1, t));
    
    const projection = new Point(
      p1.x + t * lineVec.x,
      p1.y + t * lineVec.y,
      point.floor
    );
    
    return point.distanceTo(projection);
  }

  detectCongestion(persons, edges, timeStep = 10) {
    const congestionEvents = [];
    
    if (persons.length === 0) return congestionEvents;
    
    let minTime = Infinity;
    let maxTime = -Infinity;
    
    for (const person of persons) {
      if (person.trajectory.length > 0) {
        minTime = Math.min(minTime, person.trajectory[0].time);
        maxTime = Math.max(maxTime, person.trajectory[person.trajectory.length - 1].time);
      }
    }
    
    const edgeUsage = new Map();
    for (const edge of edges) {
      edgeUsage.set(edge.id, { edge, timeSlots: new Map() });
    }
    
    for (const person of persons) {
      for (const trajPoint of person.trajectory) {
        const timeSlot = Math.floor(trajPoint.time / timeStep) * timeStep;
        
        for (const edge of edges) {
          if (edge.isBlockedAt(trajPoint.time)) continue;
          
          const dist = this.pointToEdgeDistance(trajPoint.position, edge);
          if (dist < 2.0) {
            const usage = edgeUsage.get(edge.id);
            if (!usage.timeSlots.has(timeSlot)) {
              usage.timeSlots.set(timeSlot, new Set());
            }
            usage.timeSlots.get(timeSlot).add(person.id);
          }
        }
      }
    }
    
    for (const [edgeId, usage] of edgeUsage) {
      for (const [timeSlot, personSet] of usage.timeSlots) {
        if (personSet.size >= this.config.congestionThreshold) {
          congestionEvents.push({
            type: AnomalyType.CONGESTION,
            edge: usage.edge,
            timeStart: timeSlot,
            timeEnd: timeSlot + timeStep,
            personCount: personSet.size,
            personIds: Array.from(personSet),
            description: `${usage.edge.id} 在 ${timeSlot}s 至 ${timeSlot + timeStep}s 期间拥堵，共 ${personSet.size} 人`
          });
        }
      }
    }
    
    return congestionEvents.sort((a, b) => a.timeStart - b.timeStart);
  }
}

export default AnomalyDetector;
