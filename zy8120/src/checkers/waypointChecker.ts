import { Route, ManifestEntry, Issue, IssueSeverity } from '../types';
import { randomUUID } from 'crypto';

export class WaypointChecker {
  static checkMissingWaypoints(
    route: Route,
    manifest: ManifestEntry[]
  ): { issues: Issue[]; missingWaypoints: string[]; coveredWaypoints: string[] } {
    const issues: Issue[] = [];
    
    const photoWaypoints = route.waypoints.filter(wp => wp.photoRequired);
    const manifestWaypointIds = new Set(manifest.map(e => e.waypointId));
    
    const missingWaypoints: string[] = [];
    const coveredWaypoints: string[] = [];
    
    for (const waypoint of photoWaypoints) {
      if (!manifestWaypointIds.has(waypoint.id)) {
        missingWaypoints.push(waypoint.id);
        
        issues.push({
          id: randomUUID(),
          category: 'missing_waypoint',
          severity: this.getSeverity(route, waypoint),
          message: `航点 ${waypoint.id} (杆塔 ${waypoint.towerId}) 未拍摄`,
          details: {
            waypointId: waypoint.id,
            towerId: waypoint.towerId,
            latitude: waypoint.latitude,
            longitude: waypoint.longitude,
            index: waypoint.index,
          },
          relatedWaypoints: [waypoint.id],
          timestamp: new Date().toISOString(),
        });
      } else {
        coveredWaypoints.push(waypoint.id);
      }
    }
    
    return { issues, missingWaypoints, coveredWaypoints };
  }

  private static getSeverity(route: Route, waypoint: typeof route.waypoints[0]): IssueSeverity {
    const towerWaypoints = route.waypoints.filter(wp => wp.towerId === waypoint.towerId);
    const photoTowerWaypoints = towerWaypoints.filter(wp => wp.photoRequired);
    
    if (photoTowerWaypoints.length === 1) {
      return 'critical';
    }
    
    const totalPhotos = photoTowerWaypoints.length;
    const missingPhotos = 1;
    
    if (missingPhotos / totalPhotos > 0.5) {
      return 'critical';
    }
    
    return 'major';
  }

  static checkWaypointCoverageByTower(
    route: Route,
    manifest: ManifestEntry[]
  ): Map<string, { total: number; covered: number; missing: string[] }> {
    const towerMap = new Map<string, { total: number; covered: number; missing: string[] }>();
    
    const photoWaypoints = route.waypoints.filter(wp => wp.photoRequired);
    const manifestWaypointIds = new Set(manifest.map(e => e.waypointId));
    
    for (const waypoint of photoWaypoints) {
      const towerId = waypoint.towerId;
      
      if (!towerMap.has(towerId)) {
        towerMap.set(towerId, { total: 0, covered: 0, missing: [] });
      }
      
      const towerData = towerMap.get(towerId)!;
      towerData.total++;
      
      if (manifestWaypointIds.has(waypoint.id)) {
        towerData.covered++;
      } else {
        towerData.missing.push(waypoint.id);
      }
    }
    
    return towerMap;
  }
}
