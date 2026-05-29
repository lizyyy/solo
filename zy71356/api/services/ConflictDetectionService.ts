import {
  Conflict,
  ConflictType,
  ConflictSeverity,
  Vendor,
  Stall,
  Assignment,
  CATEGORY_LABELS,
} from '../../shared/types';

interface AssignmentWithDetails extends Assignment {
  vendor: Vendor;
  stall: Stall;
}

export class ConflictDetectionService {
  private readonly MAX_SAME_CATEGORY_NEIGHBORS = 2;
  private readonly HIGH_POWER_THRESHOLD = 1000;

  detectConflicts(
    arrangementId: string,
    assignments: Assignment[],
    vendors: Vendor[],
    stalls: Stall[]
  ): Omit<Conflict, 'id' | 'createdAt'>[] {
    const conflicts: Omit<Conflict, 'id' | 'createdAt'>[] = [];

    const detailedAssignments = assignments
      .map((a) => {
        const vendor = vendors.find((v) => v.id === a.vendorId);
        const stall = stalls.find((s) => s.id === a.stallId);
        if (!vendor || !stall) return null;
        return { ...a, vendor, stall };
      })
      .filter((a): a is AssignmentWithDetails => a !== null);

    conflicts.push(
      ...this.detectPowerMismatches(arrangementId, detailedAssignments)
    );

    conflicts.push(
      ...this.detectCategoryClusters(arrangementId, detailedAssignments, stalls)
    );

    return conflicts;
  }

  detectUnrecordedSwap(
    arrangementId: string,
    stallA: string,
    stallB: string,
    stallAName: string,
    stallBName: string
  ): Omit<Conflict, 'id' | 'createdAt'> {
    return {
      arrangementId,
      type: 'unrecorded_swap',
      severity: 'warning',
      message: `摊位 ${stallAName} 和 ${stallBName} 发生换位但未记录原因`,
      affectedItems: [stallA, stallB],
      source: '换位操作',
    };
  }

  private detectPowerMismatches(
    arrangementId: string,
    assignments: AssignmentWithDetails[]
  ): Omit<Conflict, 'id' | 'createdAt'>[] {
    const conflicts: Omit<Conflict, 'id' | 'createdAt'>[] = [];

    for (const assignment of assignments) {
      if (assignment.vendor.powerRequirement > assignment.stall.maxPower) {
        const isHighPower =
          assignment.vendor.powerRequirement >= this.HIGH_POWER_THRESHOLD;
        conflicts.push({
          arrangementId,
          type: 'power_mismatch',
          severity: isHighPower ? 'error' : 'warning',
          message:
            `摊主「${assignment.vendor.name}」(${CATEGORY_LABELS[assignment.vendor.category]}) ` +
            `用电需求 ${assignment.vendor.powerRequirement}W 超过摊位 ${assignment.stall.name} ` +
            `最大供电 ${assignment.stall.maxPower}W`,
          affectedItems: [assignment.vendorId, assignment.stallId],
          source: assignment.source || '摊位分配',
        });
      }
    }

    return conflicts;
  }

  private detectCategoryClusters(
    arrangementId: string,
    assignments: AssignmentWithDetails[],
    stalls: Stall[]
  ): Omit<Conflict, 'id' | 'createdAt'>[] {
    const conflicts: Omit<Conflict, 'id' | 'createdAt'>[] = [];

    const stallMap = new Map<string, AssignmentWithDetails>();
    for (const a of assignments) {
      stallMap.set(a.stallId, a);
    }

    const visited = new Set<string>();

    for (const assignment of assignments) {
      if (visited.has(assignment.stallId)) continue;

      const cluster = this.findCluster(
        assignment,
        stallMap,
        stalls,
        assignment.vendor.category
      );

      cluster.forEach((a) => visited.add(a.stallId));

      if (cluster.length > this.MAX_SAME_CATEGORY_NEIGHBORS) {
        const vendorNames = cluster.map((a) => a.vendor.name).join('、');
        const stallNames = cluster.map((a) => a.stall.name).join('、');

        conflicts.push({
          arrangementId,
          type: 'category_cluster',
          severity: 'warning',
          message:
            `${CATEGORY_LABELS[assignment.vendor.category]}类摊位过度集中: ` +
            `${cluster.length} 个相邻摊位 (${stallNames}) 均为同类摊主: ${vendorNames}`,
          affectedItems: cluster.map((a) => a.stallId),
          source: '品类分散规则',
        });
      }
    }

    return conflicts;
  }

  private findCluster(
    start: AssignmentWithDetails,
    stallMap: Map<string, AssignmentWithDetails>,
    stalls: Stall[],
    category: string
  ): AssignmentWithDetails[] {
    const cluster: AssignmentWithDetails[] = [];
    const queue: AssignmentWithDetails[] = [start];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current.stallId)) continue;
      visited.add(current.stallId);

      if (current.vendor.category === category) {
        cluster.push(current);

        const neighbors = this.getNeighbors(current.stall, stalls);
        for (const neighbor of neighbors) {
          const neighborAssignment = stallMap.get(neighbor.id);
          if (
            neighborAssignment &&
            !visited.has(neighborAssignment.stallId) &&
            neighborAssignment.vendor.category === category
          ) {
            queue.push(neighborAssignment);
          }
        }
      }
    }

    return cluster;
  }

  private getNeighbors(stall: Stall, allStalls: Stall[]): Stall[] {
    const directions = [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ];

    const neighbors: Stall[] = [];
    for (const [dr, dc] of directions) {
      const neighbor = allStalls.find(
        (s) => s.row === stall.row + dr && s.col === stall.col + dc
      );
      if (neighbor) {
        neighbors.push(neighbor);
      }
    }

    return neighbors;
  }
}
