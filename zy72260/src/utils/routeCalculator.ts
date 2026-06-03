import { Waypoint, Route, ExhibitData } from '@/types';
import { db } from '@/db';

export function calculateRouteLength(waypoints: Waypoint[]): number {
  if (waypoints.length < 2) return 0;
  
  let length = 0;
  for (let i = 1; i < waypoints.length; i++) {
    const dx = waypoints[i].x - waypoints[i - 1].x;
    const dy = waypoints[i].y - waypoints[i - 1].y;
    length += Math.sqrt(dx * dx + dy * dy);
  }
  
  return Math.round(length * 100) / 100;
}

export function createRouteFromWaypoints(
  waypoints: Waypoint[],
  isSupplementary: boolean = false,
  reportedLength?: number
): Route {
  const calculatedLength = calculateRouteLength(waypoints);
  const now = new Date().toISOString();
  
  let reviewStatus: Route['reviewStatus'] = 'not_required';
  let lengthRecalculated = true;
  
  if (isSupplementary && reportedLength !== undefined) {
    const diff = Math.abs(calculatedLength - reportedLength);
    lengthRecalculated = diff <= 0.5;
    reviewStatus = lengthRecalculated ? 'not_required' : 'pending';
  }
  
  return {
    id: `route_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    waypoints,
    calculatedLength,
    reportedLength,
    isSupplementary,
    lengthRecalculated,
    reviewStatus,
    supplementaryTime: isSupplementary ? now : undefined,
    recalcTime: now,
  };
}

export async function recalculateAllRoutes(
  routes: Route[]
): Promise<Route[]> {
  const now = new Date().toISOString();
  const updatedRoutes = routes.map((route) => {
    const calculatedLength = calculateRouteLength(route.waypoints);
    let reviewStatus = route.reviewStatus;
    let lengthRecalculated = true;
    
    if (route.isSupplementary && route.reportedLength !== undefined) {
      const diff = Math.abs(calculatedLength - route.reportedLength);
      lengthRecalculated = diff <= 0.5;
      if (!lengthRecalculated && reviewStatus === 'not_required') {
        reviewStatus = 'pending';
      }
    }
    
    return {
      ...route,
      calculatedLength,
      lengthRecalculated,
      reviewStatus,
      recalcTime: now,
    };
  });
  
  await Promise.all(updatedRoutes.map(r => db.routes.put(r)));
  
  return updatedRoutes;
}

export function checkRouteSafetyCompliance(
  waypoints: Waypoint[],
  exhibits: ExhibitData[]
): Array<{
  waypointIndex: number;
  exhibitId: string;
  distance: number;
  requiredRadius: number;
  isCompliant: boolean;
}> {
  const results: Array<{
    waypointIndex: number;
    exhibitId: string;
    distance: number;
    requiredRadius: number;
    isCompliant: boolean;
  }> = [];
  
  for (let i = 0; i < waypoints.length; i++) {
    const wp = waypoints[i];
    for (const exhibit of exhibits) {
      const dx = wp.x - exhibit.x;
      const dy = wp.y - exhibit.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const requiredRadius = exhibit.safetyRadius || exhibit.pointCloudRadius;
      
      results.push({
        waypointIndex: i,
        exhibitId: exhibit.exhibitId,
        distance: Math.round(distance * 100) / 100,
        requiredRadius,
        isCompliant: distance >= requiredRadius,
      });
    }
  }
  
  return results;
}

export function simplifyRoute(
  waypoints: Waypoint[],
  tolerance: number = 0.5
): Waypoint[] {
  if (waypoints.length < 3) return waypoints;
  
  const simplified: Waypoint[] = [waypoints[0]];
  
  for (let i = 1; i < waypoints.length - 1; i++) {
    const prev = simplified[simplified.length - 1];
    const curr = waypoints[i];
    const next = waypoints[i + 1];
    
    const cross = Math.abs(
      (curr.x - prev.x) * (next.y - prev.y) - 
      (curr.y - prev.y) * (next.x - prev.x)
    ) / 2;
    
    const distance = Math.sqrt(
      Math.pow(next.x - prev.x, 2) + Math.pow(next.y - prev.y, 2)
    );
    
    if (distance === 0 || cross / distance > tolerance) {
      simplified.push(curr);
    }
  }
  
  simplified.push(waypoints[waypoints.length - 1]);
  
  return simplified;
}

export function generateSmoothCurvePoints(
  waypoints: Waypoint[],
  segments: number = 20
): Waypoint[] {
  if (waypoints.length < 2) return waypoints;
  if (waypoints.length < 3) {
    const result: Waypoint[] = [];
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      result.push({
        x: waypoints[0].x + (waypoints[1].x - waypoints[0].x) * t,
        y: waypoints[0].y + (waypoints[1].y - waypoints[0].y) * t,
      });
    }
    return result;
  }
  
  const smoothPoints: Waypoint[] = [];
  
  for (let i = 0; i < waypoints.length - 1; i++) {
    const p0 = waypoints[Math.max(0, i - 1)];
    const p1 = waypoints[i];
    const p2 = waypoints[i + 1];
    const p3 = waypoints[Math.min(waypoints.length - 1, i + 2)];
    
    for (let j = 0; j < segments; j++) {
      const t = j / segments;
      const t2 = t * t;
      const t3 = t2 * t;
      
      smoothPoints.push({
        x: 0.5 * (
          (2 * p1.x) +
          (-p0.x + p2.x) * t +
          (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
          (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3
        ),
        y: 0.5 * (
          (2 * p1.y) +
          (-p0.y + p2.y) * t +
          (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
          (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3
        ),
      });
    }
  }
  
  smoothPoints.push(waypoints[waypoints.length - 1]);
  
  return smoothPoints;
}
