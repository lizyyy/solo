import type { ContainerSlot, Crane, Truck, Conflict } from '@/types';

export function detectSlotOverlaps(slots: ContainerSlot[]): Conflict[] {
  const conflicts: Conflict[] = [];
  
  for (let i = 0; i < slots.length; i++) {
    for (let j = i + 1; j < slots.length; j++) {
      const slotA = slots[i];
      const slotB = slots[j];
      
      if (
        Math.abs(slotA.position.x - slotB.position.x) < 2 &&
        Math.abs(slotA.position.y - slotB.position.y) < 1 &&
        Math.abs(slotA.position.z - slotB.position.z) < 2 &&
        slotA.status === 'occupied' &&
        slotB.status === 'occupied'
      ) {
        conflicts.push({
          id: `conflict-slot-${slotA.id}-${slotB.id}`,
          type: 'slot_overlap',
          severity: 'critical',
          title: '箱位空间重叠',
          description: `检测到 ${slotA.bay}-${slotA.row}-${slotA.tier} 和 ${slotB.bay}-${slotB.row}-${slotB.tier} 两个箱位存在空间重叠。请检查箱位数据是否正确加载。`,
          affectedObjects: [slotA.id, slotB.id],
          affectedObjectNames: [
            `箱位 ${slotA.bay}-${slotA.row}-${slotA.tier}`,
            `箱位 ${slotB.bay}-${slotB.row}-${slotB.tier}`,
          ],
          timestamp: new Date(),
          dataSource: [slotA.dataSource, slotB.dataSource],
          resolved: false,
        });
      }
    }
  }
  
  return conflicts;
}

export function detectCraneConflicts(cranes: Crane[]): Conflict[] {
  const conflicts: Conflict[] = [];
  
  for (let i = 0; i < cranes.length; i++) {
    for (let j = i + 1; j < cranes.length; j++) {
      const craneA = cranes[i];
      const craneB = cranes[j];
      
      const rangeA = craneA.workingRange;
      const rangeB = craneB.workingRange;
      
      const hasOverlap =
        rangeA.minX <= rangeB.maxX &&
        rangeA.maxX >= rangeB.minX &&
        rangeA.minZ <= rangeB.maxZ &&
        rangeA.maxZ >= rangeB.minZ;
      
      if (hasOverlap && craneA.status === 'working' && craneB.status === 'working') {
        conflicts.push({
          id: `conflict-crane-${craneA.id}-${craneB.id}`,
          type: 'crane_collision',
          severity: 'warning',
          title: '吊机作业范围冲突',
          description: `${craneA.name} 和 ${craneB.name} 的工作范围存在重叠区域。两机同时作业可能导致安全隐患，建议协调作业顺序。`,
          affectedObjects: [craneA.id, craneB.id],
          affectedObjectNames: [craneA.name, craneB.name],
          timestamp: new Date(),
          dataSource: [craneA.dataSource, craneB.dataSource],
          resolved: false,
        });
      }
    }
  }
  
  return conflicts;
}

export function detectRouteBlockages(trucks: Truck[]): Conflict[] {
  const conflicts: Conflict[] = [];
  
  const activeTrucks = trucks.filter(
    (t) => t.currentRoute && t.status === 'moving'
  );
  
  for (let i = 0; i < activeTrucks.length; i++) {
    for (let j = i + 1; j < activeTrucks.length; j++) {
      const truckA = activeTrucks[i];
      const truckB = activeTrucks[j];
      const routeA = truckA.currentRoute!;
      const routeB = truckB.currentRoute!;
      
      const willIntersect = checkRouteIntersection(routeA.waypoints, routeB.waypoints);
      
      if (willIntersect) {
        conflicts.push({
          id: `conflict-route-${truckA.id}-${truckB.id}`,
          type: 'route_blockage',
          severity: 'warning',
          title: '卡车路线交汇风险',
          description: `${truckA.plateNumber} 和 ${truckB.plateNumber} 的行驶路线预计在堆场入口附近交汇。可能造成交通堵塞，建议调整其中一辆的行驶路线。`,
          affectedObjects: [truckA.id, truckB.id],
          affectedObjectNames: [truckA.plateNumber, truckB.plateNumber],
          timestamp: new Date(),
          dataSource: [truckA.dataSource, truckB.dataSource],
          resolved: false,
        });
      }
    }
  }
  
  return conflicts;
}

function checkRouteIntersection(
  waypointsA: { x: number; z: number }[],
  waypointsB: { x: number; z: number }[]
): boolean {
  for (let i = 0; i < waypointsA.length - 1; i++) {
    for (let j = 0; j < waypointsB.length - 1; j++) {
      if (
        lineSegmentsIntersect(
          waypointsA[i],
          waypointsA[i + 1],
          waypointsB[j],
          waypointsB[j + 1]
        )
      ) {
        return true;
      }
    }
  }
  return false;
}

function lineSegmentsIntersect(
  p1: { x: number; z: number },
  p2: { x: number; z: number },
  p3: { x: number; z: number },
  p4: { x: number; z: number }
): boolean {
  const d1 = direction(p3, p4, p1);
  const d2 = direction(p3, p4, p2);
  const d3 = direction(p1, p2, p3);
  const d4 = direction(p1, p2, p4);

  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
      ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    return true;
  }

  return false;
}

function direction(
  p1: { x: number; z: number },
  p2: { x: number; z: number },
  p3: { x: number; z: number }
): number {
  return (p3.x - p1.x) * (p2.z - p1.z) - (p2.x - p1.x) * (p3.z - p1.z);
}

export function detectAllConflicts(
  slots: ContainerSlot[],
  cranes: Crane[],
  trucks: Truck[]
): Conflict[] {
  return [
    ...detectSlotOverlaps(slots),
    ...detectCraneConflicts(cranes),
    ...detectRouteBlockages(trucks),
  ];
}
