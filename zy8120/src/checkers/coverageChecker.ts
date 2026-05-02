import { DateTime } from 'luxon';
import {
  Route,
  ManifestEntry,
  FlightSegment,
  CoverageResult,
  Issue,
  PrecheckOptions,
} from '../types';
import { randomUUID } from 'crypto';

export class CoverageChecker {
  private options: PrecheckOptions;

  constructor(options: PrecheckOptions) {
    this.options = options;
  }

  analyzeFlightSegments(
    manifest: ManifestEntry[],
    route: Route
  ): { segments: FlightSegment[]; issues: Issue[] } {
    const issues: Issue[] = [];
    
    const sortedEntries = [...manifest].sort((a, b) => {
      const timeA = this.parseTimestamp(a.timestamp);
      const timeB = this.parseTimestamp(b.timestamp);
      return timeA.toMillis() - timeB.toMillis();
    });
    
    const segments: FlightSegment[] = [];
    const toleranceMinutes = this.options.timeToleranceMinutes || 30;
    
    if (sortedEntries.length === 0) {
      return { segments, issues };
    }
    
    let currentSegment: {
      id: string;
      name: string;
      startTime: DateTime;
      endTime: DateTime;
      waypointsCovered: Set<string>;
      photos: ManifestEntry[];
      isRerun: boolean;
      parentSegment?: string;
    } | null = null;
    
    let segmentIndex = 0;
    const segmentCount = new Map<string, number>();
    
    for (const entry of sortedEntries) {
      const entryTime = this.parseTimestamp(entry.timestamp);
      const towerId = entry.towerId;
      
      if (!currentSegment) {
        segmentIndex++;
        const segmentName = this.generateSegmentName(entry, segmentIndex);
        segmentCount.set(towerId, 1);
        
        currentSegment = {
          id: `seg-${segmentIndex}`,
          name: segmentName,
          startTime: entryTime,
          endTime: entryTime,
          waypointsCovered: new Set([entry.waypointId]),
          photos: [entry],
          isRerun: false,
        };
      } else {
        const diffMinutes = entryTime.diff(currentSegment.endTime, 'minutes').minutes;
        const sameTower = currentSegment.photos[0]?.towerId === towerId;
        
        if (diffMinutes < toleranceMinutes && sameTower) {
          currentSegment.endTime = entryTime;
          currentSegment.waypointsCovered.add(entry.waypointId);
          currentSegment.photos.push(entry);
        } else {
          segments.push(this.convertToFlightSegment(currentSegment));
          
          segmentIndex++;
          const currentCount: number = segmentCount.get(towerId) || 0;
          const count: number = currentCount + 1;
          segmentCount.set(towerId, count);
          
          const isRerun: boolean = count > 1;
          const segmentName = this.generateSegmentName(entry, segmentIndex, isRerun, count);
          
          if (isRerun) {
            issues.push({
              id: randomUUID(),
              category: 'coverage_gap',
              severity: 'info',
              message: `检测到杆塔 ${towerId} 的第 ${count} 次重飞: ${segmentName}`,
              details: {
                towerId,
                rerunCount: count,
                segmentName,
                startTime: entryTime.toISO(),
              },
              relatedWaypoints: [entry.waypointId],
              timestamp: new Date().toISOString(),
            });
          }
          
          currentSegment = {
            id: `seg-${segmentIndex}`,
            name: segmentName,
            startTime: entryTime,
            endTime: entryTime,
            waypointsCovered: new Set([entry.waypointId]),
            photos: [entry],
            isRerun,
          };
        }
      }
    }
    
    if (currentSegment) {
      segments.push(this.convertToFlightSegment(currentSegment));
    }
    
    return { segments, issues };
  }

  calculateCoverageByTower(
    route: Route,
    manifest: ManifestEntry[],
    segments: FlightSegment[]
  ): { coverageResults: CoverageResult[]; issues: Issue[] } {
    const issues: Issue[] = [];
    const coverageResults: CoverageResult[] = [];
    
    const towerWaypoints = new Map<string, Set<string>>();
    for (const wp of route.waypoints) {
      if (!towerWaypoints.has(wp.towerId)) {
        towerWaypoints.set(wp.towerId, new Set());
      }
      if (wp.photoRequired) {
        towerWaypoints.get(wp.towerId)!.add(wp.id);
      }
    }
    
    const towerSegments = new Map<string, FlightSegment[]>();
    for (const segment of segments) {
      const firstWaypointId = segment.waypointsCovered[0];
      const waypoint = route.waypoints.find(wp => wp.id === firstWaypointId);
      
      if (waypoint) {
        if (!towerSegments.has(waypoint.towerId)) {
          towerSegments.set(waypoint.towerId, []);
        }
        towerSegments.get(waypoint.towerId)!.push(segment);
      }
    }
    
    const manifestWaypointIds = new Set(manifest.map(e => e.waypointId));
    
    for (const [towerId, expectedWaypoints] of towerWaypoints.entries()) {
      const towerSegs = towerSegments.get(towerId) || [];
      const rerunCount = towerSegs.filter(s => s.isRerun).length;
      
      const coveredWaypoints = new Set<string>();
      const finalPhotos: string[] = [];
      
      const sortedTowerSegs = [...towerSegs].sort((a, b) => {
        return this.parseTimestamp(a.startTime).toMillis() - 
               this.parseTimestamp(b.startTime).toMillis();
      });
      
      for (const segment of sortedTowerSegs) {
        for (const wpId of segment.waypointsCovered) {
          coveredWaypoints.add(wpId);
        }
        
        const segmentPhotos = manifest.filter(e => 
          segment.waypointsCovered.includes(e.waypointId) &&
          this.parseTimestamp(e.timestamp) >= this.parseTimestamp(segment.startTime) &&
          this.parseTimestamp(e.timestamp) <= this.parseTimestamp(segment.endTime)
        );
        
        for (const photo of segmentPhotos) {
          finalPhotos.push(photo.filename);
        }
      }
      
      const missingWaypoints: string[] = [];
      for (const wpId of expectedWaypoints) {
        if (!coveredWaypoints.has(wpId)) {
          missingWaypoints.push(wpId);
        }
      }
      
      let status: CoverageResult['status'] = 'fully_covered';
      if (missingWaypoints.length === expectedWaypoints.size) {
        status = 'not_covered';
      } else if (missingWaypoints.length > 0) {
        status = 'partially_covered';
      }
      
      const coverageResult: CoverageResult = {
        towerId,
        status,
        totalWaypoints: expectedWaypoints.size,
        coveredWaypoints: coveredWaypoints.size,
        missingWaypoints,
        segments: sortedTowerSegs,
        rerunCount,
        finalPhotos: [...new Set(finalPhotos)],
      };
      
      coverageResults.push(coverageResult);
      
      if (status !== 'fully_covered') {
        issues.push({
          id: randomUUID(),
          category: 'coverage_gap',
          severity: status === 'not_covered' ? 'critical' : 'major',
          message: `杆塔 ${towerId} 覆盖不完整: ${coveredWaypoints.size}/${expectedWaypoints.size} 航点`,
          details: {
            towerId,
            status,
            totalWaypoints: expectedWaypoints.size,
            coveredWaypoints: coveredWaypoints.size,
            missingWaypoints,
            rerunCount,
          },
          relatedWaypoints: missingWaypoints,
          timestamp: new Date().toISOString(),
        });
      }
      
      if (rerunCount > 0) {
        issues.push({
          id: randomUUID(),
          category: 'coverage_gap',
          severity: 'info',
          message: `杆塔 ${towerId} 有 ${rerunCount} 次重飞记录`,
          details: {
            towerId,
            rerunCount,
            segments: sortedTowerSegs.map(s => ({
              name: s.name,
              startTime: s.startTime,
              endTime: s.endTime,
              isRerun: s.isRerun,
              waypointsCount: s.waypointsCovered.length,
            })),
          },
          timestamp: new Date().toISOString(),
        });
      }
    }
    
    return { coverageResults, issues };
  }

  mergeRerunSegments(
    segments: FlightSegment[]
  ): { mergedSegments: FlightSegment[]; finalPhotos: string[] } {
    const mergedSegments: FlightSegment[] = [];
    const towerGroups = new Map<string, FlightSegment[]>();
    
    for (const segment of segments) {
      const towerId = this.extractTowerIdFromSegment(segment);
      if (!towerGroups.has(towerId)) {
        towerGroups.set(towerId, []);
      }
      towerGroups.get(towerId)!.push(segment);
    }
    
    for (const [towerId, towerSegs] of towerGroups.entries()) {
      const sortedSegs = [...towerSegs].sort((a, b) => {
        return this.parseTimestamp(a.startTime).toMillis() - 
               this.parseTimestamp(b.startTime).toMillis();
      });
      
      const mainSegment = sortedSegs.find(s => !s.isRerun);
      const rerunSegments = sortedSegs.filter(s => s.isRerun);
      
      if (mainSegment) {
        const mergedWaypoints = new Set(mainSegment.waypointsCovered);
        let totalPhotos = mainSegment.photosCount;
        
        for (const rerun of rerunSegments) {
          for (const wp of rerun.waypointsCovered) {
            mergedWaypoints.add(wp);
          }
          totalPhotos += rerun.photosCount;
        }
        
        mergedSegments.push({
          id: mainSegment.id,
          name: `${mainSegment.name} (merged)`,
          startTime: mainSegment.startTime,
          endTime: rerunSegments.length > 0 
            ? rerunSegments[rerunSegments.length - 1].endTime 
            : mainSegment.endTime,
          waypointsCovered: Array.from(mergedWaypoints),
          photosCount: totalPhotos,
          isRerun: false,
        });
      } else {
        mergedSegments.push(...sortedSegs);
      }
    }
    
    return {
      mergedSegments,
      finalPhotos: [],
    };
  }

  private generateSegmentName(
    entry: ManifestEntry,
    index: number,
    isRerun = false,
    rerunCount = 1
  ): string {
    const timeStr = this.parseTimestamp(entry.timestamp).toFormat('HHmm');
    const baseName = `${entry.towerId}_${timeStr}`;
    
    if (isRerun) {
      return `${baseName}_rerun_${rerunCount}`;
    }
    return baseName;
  }

  private convertToFlightSegment(
    segment: {
      id: string;
      name: string;
      startTime: DateTime;
      endTime: DateTime;
      waypointsCovered: Set<string>;
      photos: ManifestEntry[];
      isRerun: boolean;
      parentSegment?: string;
    }
  ): FlightSegment {
    return {
      id: segment.id,
      name: segment.name,
      startTime: segment.startTime.toISO() || segment.startTime.toFormat("yyyy-MM-dd'T'HH:mm:ss"),
      endTime: segment.endTime.toISO() || segment.endTime.toFormat("yyyy-MM-dd'T'HH:mm:ss"),
      waypointsCovered: Array.from(segment.waypointsCovered),
      photosCount: segment.photos.length,
      isRerun: segment.isRerun,
      parentSegment: segment.parentSegment,
    };
  }

  private extractTowerIdFromSegment(segment: FlightSegment): string {
    const match = segment.name.match(/^([^_]+)_/);
    return match ? match[1] : 'unknown';
  }

  private parseTimestamp(timestamp: string): DateTime {
    const dt = DateTime.fromISO(timestamp);
    if (dt.isValid) {
      return dt;
    }
    
    const formats = [
      'yyyy-MM-dd HH:mm:ss',
      'yyyy:MM:dd HH:mm:ss',
    ];
    
    for (const format of formats) {
      const parsed = DateTime.fromFormat(timestamp, format, {
        zone: this.options.timezone || 'local',
      });
      if (parsed.isValid) {
        return parsed;
      }
    }
    
    return DateTime.now();
  }
}
