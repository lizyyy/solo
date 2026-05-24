import { Bus, Conflict } from '../types';

export class ConflictDetector {
  private static instance: ConflictDetector;

  private constructor() {}

  public static getInstance(): ConflictDetector {
    if (!ConflictDetector.instance) {
      ConflictDetector.instance = new ConflictDetector();
    }
    return ConflictDetector.instance;
  }

  public detectAllConflicts(buses: Bus[]): Conflict[] {
    const conflicts: Conflict[] = [];
    
    conflicts.push(...this.detectSpotBlocked(buses));
    conflicts.push(...this.detectDepartureConflict(buses));
    
    return conflicts;
  }

  private detectSpotBlocked(buses: Bus[]): Conflict[] {
    const conflicts: Conflict[] = [];
    
    const exitLaneGroups = buses.reduce((acc, bus) => {
      if (!acc[bus.exitLane]) acc[bus.exitLane] = [];
      acc[bus.exitLane].push(bus);
      return acc;
    }, {} as Record<number, Bus[]>);

    Object.values(exitLaneGroups).forEach((laneBuses) => {
      const sortedByCol = [...laneBuses].sort((a, b) => b.col - a.col);
      
      for (let i = 0; i < sortedByCol.length - 1; i++) {
        const frontBus = sortedByCol[i];
        const behindBus = sortedByCol[i + 1];
        
        if (behindBus.departureTime < frontBus.departureTime + 30) {
          conflicts.push({
            id: `spot-blocked-${frontBus.id}-${behindBus.id}`,
            type: 'spot_blocked',
            time: behindBus.departureTime,
            severity: 'critical',
            involvedBuses: [behindBus.id, frontBus.id],
            description: `车辆 ${behindBus.number} 发车时被前方车辆 ${frontBus.number} 阻挡，建议调整发车时间间隔至少30秒`,
            resolved: false,
          });
        }
      }
    });

    return conflicts;
  }

  private detectDepartureConflict(buses: Bus[]): Conflict[] {
    const conflicts: Conflict[] = [];
    
    const exitLaneGroups = buses.reduce((acc, bus) => {
      if (!acc[bus.exitLane]) acc[bus.exitLane] = [];
      acc[bus.exitLane].push(bus);
      return acc;
    }, {} as Record<number, Bus[]>);

    Object.values(exitLaneGroups).forEach((laneBuses) => {
      const sortedByTime = [...laneBuses].sort((a, b) => a.departureTime - b.departureTime);
      
      for (let i = 0; i < sortedByTime.length - 1; i++) {
        const busA = sortedByTime[i];
        const busB = sortedByTime[i + 1];
        
        if (Math.abs(busA.departureTime - busB.departureTime) < 15) {
          conflicts.push({
            id: `departure-conflict-${busA.id}-${busB.id}`,
            type: 'departure_conflict',
            time: Math.min(busA.departureTime, busB.departureTime),
            severity: 'warning',
            involvedBuses: [busA.id, busB.id],
            description: `车辆 ${busA.number} 和 ${busB.number} 发车间隔过短（${Math.abs(busA.departureTime - busB.departureTime)}秒），建议间隔至少15秒`,
            resolved: false,
          });
        }
      }
    });

    return conflicts;
  }

  public getConflictsAtTime(conflicts: Conflict[], time: number, window: number = 5): Conflict[] {
    return conflicts.filter(c => Math.abs(c.time - time) <= window);
  }

  public getConflictTypeLabel(type: Conflict['type']): string {
    const labels: Record<Conflict['type'], string> = {
      spot_blocked: '车位阻塞',
      departure_conflict: '发车冲突',
      lane_occupied: '通道占用',
    };
    return labels[type];
  }

  public getSeverityLabel(severity: Conflict['severity']): string {
    return severity === 'critical' ? '严重' : '警告';
  }
}
