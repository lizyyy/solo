import {
  Passenger,
  Seat,
  PaidSeat,
  CompanionGroup,
  WeightConfig,
  SwapAction,
  ConflictEntry,
  SwapScheme,
} from '@/types';

function hungarianAlgorithm(costMatrix: number[][]): number[] {
  const n = costMatrix.length;
  const m = costMatrix[0].length;
  const size = Math.max(n, m);

  const u = new Array(size + 1).fill(0);
  const v = new Array(size + 1).fill(0);
  const p = new Array(size + 1).fill(0);
  const way = new Array(size + 1).fill(0);

  for (let i = 1; i <= n; i++) {
    p[0] = i;
    let j0 = 0;
    const minv = new Array(size + 1).fill(Infinity);
    const used = new Array(size + 1).fill(false);

    do {
      used[j0] = true;
      const i0 = p[j0];
      let delta = Infinity;
      let j1 = 0;

      for (let j = 1; j <= m; j++) {
        if (!used[j]) {
          const cur = costMatrix[i0 - 1]?.[j - 1] ?? 0 - u[i0] - v[j];
          if (cur < minv[j]) {
            minv[j] = cur;
            way[j] = j0;
          }
          if (minv[j] < delta) {
            delta = minv[j];
            j1 = j;
          }
        }
      }

      for (let j = 0; j <= size; j++) {
        if (used[j]) {
          u[p[j]] += delta;
          v[j] -= delta;
        } else {
          minv[j] -= delta;
        }
      }

      j0 = j1;
    } while (p[j0] !== 0);

    do {
      const j1 = way[j0];
      p[j0] = p[j1];
      j0 = j1;
    } while (j0 !== 0);
  }

  const result = new Array(n).fill(-1);
  for (let j = 1; j <= m; j++) {
    if (p[j] !== 0 && p[j] <= n) {
      result[p[j] - 1] = j - 1;
    }
  }

  return result;
}

function calculateSeatDistance(seat1: string, seat2: string): number {
  const row1 = parseInt(seat1.match(/\d+/)?.[0] || '0');
  const col1 = seat1.match(/[A-Z]/)?.[0] || 'A';
  const row2 = parseInt(seat2.match(/\d+/)?.[0] || '0');
  const col2 = seat2.match(/[A-Z]/)?.[0] || 'A';

  const rowDiff = Math.abs(row1 - row2);
  const colDiff = Math.abs(col1.charCodeAt(0) - col2.charCodeAt(0));

  return rowDiff * 2 + colDiff;
}

function getCabinRank(cabin: string): number {
  const ranks: Record<string, number> = {
    '头等舱': 4,
    '商务舱': 3,
    '超级经济舱': 2,
    '经济舱': 1,
    'F': 4,
    'C': 3,
    'W': 2,
    'Y': 1,
  };
  return ranks[cabin] || 0;
}

export function calculateCostMatrix(
  passengers: Passenger[],
  seats: Seat[],
  paidSeats: PaidSeat[],
  companionGroups: CompanionGroup[],
  weightConfig: WeightConfig
): number[][] {
  const costMatrix: number[][] = [];

  const paidSeatMap = new Map(paidSeats.map((ps) => [ps.seatId, ps]));
  const passengerCompanionMap = new Map<string, string>();
  const companionPassengerMap = new Map<string, string[]>();

  companionGroups.forEach((group) => {
    group.passengerIds.forEach((pid) => {
      passengerCompanionMap.set(pid, group.groupId);
    });
    companionPassengerMap.set(group.groupId, group.passengerIds);
  });

  passengers.forEach((passenger) => {
    const row: number[] = [];
    const passengerGroupId = passengerCompanionMap.get(passenger.id);

    seats.forEach((seat) => {
      if (seat.status === 'blocked') {
        row.push(Infinity);
        return;
      }

      let cost = 0;

      const paidSeat = paidSeatMap.get(passenger.currentSeat);
      if (paidSeat && seat.seatId !== passenger.currentSeat) {
        cost += weightConfig.paidSeatWeight * paidSeat.fee;
      }

      if (passengerGroupId) {
        const groupMembers = companionPassengerMap.get(passengerGroupId) || [];
        groupMembers.forEach((memberId) => {
          if (memberId !== passenger.id) {
            const member = passengers.find((p) => p.id === memberId);
            if (member) {
              const distance = calculateSeatDistance(seat.seatId, member.currentSeat);
              cost += weightConfig.companionWeight * distance;
            }
          }
        });
      }

      const originalCabinRank = getCabinRank(passenger.cabinClass);
      const newCabinRank = getCabinRank(seat.cabinClass);
      if (newCabinRank < originalCabinRank) {
        cost += weightConfig.cabinDiffWeight * (originalCabinRank - newCabinRank);
      }

      const distance = calculateSeatDistance(passenger.currentSeat, seat.seatId);
      cost += weightConfig.distanceWeight * distance;

      row.push(cost);
    });

    costMatrix.push(row);
  });

  return costMatrix;
}

export function generateSwapActions(
  passengers: Passenger[],
  seats: Seat[],
  assignments: number[]
): SwapAction[] {
  const actions: SwapAction[] = [];

  passengers.forEach((passenger, idx) => {
    const seatIdx = assignments[idx];
    if (seatIdx >= 0 && seatIdx < seats.length) {
      const newSeat = seats[seatIdx];
      if (newSeat.seatId !== passenger.currentSeat) {
        actions.push({
          actionId: `action-${passenger.id}-${newSeat.seatId}`,
          passengerId: passenger.id,
          fromSeat: passenger.currentSeat,
          toSeat: newSeat.seatId,
        });
      }
    }
  });

  return actions;
}

export function detectConflicts(
  passengers: Passenger[],
  seats: Seat[],
  actions: SwapAction[],
  paidSeats: PaidSeat[],
  companionGroups: CompanionGroup[]
): ConflictEntry[] {
  const conflicts: ConflictEntry[] = [];
  let conflictId = 0;

  const newSeatAssignment = new Map<string, string>();
  passengers.forEach((p) => newSeatAssignment.set(p.id, p.currentSeat));
  actions.forEach((a) => newSeatAssignment.set(a.passengerId, a.toSeat));

  const paidSeatMap = new Map(paidSeats.map((ps) => [ps.passengerId, ps]));
  actions.forEach((action) => {
    const paidSeat = paidSeatMap.get(action.passengerId);
    if (paidSeat) {
      conflicts.push({
        entryId: `conflict-${++conflictId}`,
        conflictType: 'paid_displaced',
        affectedPassengerId: action.passengerId,
        description: `付费座位 ${action.fromSeat} 被更换为 ${action.toSeat}`,
        reason: `超售或同行优化需要，乘客原付费座位 ${action.fromSeat}（费用 ¥${paidSeat.fee}）需调整`,
      });
    }
  });

  companionGroups.forEach((group) => {
    const memberSeats = group.passengerIds
      .map((pid) => newSeatAssignment.get(pid))
      .filter(Boolean) as string[];

    if (memberSeats.length > 1) {
      const rows = memberSeats.map((s) => parseInt(s.match(/\d+/)?.[0] || '0'));
      const cols = memberSeats.map((s) => s.match(/[A-Z]/)?.[0] || 'A');

      const allSameRow = rows.every((r) => r === rows[0]);
      if (!allSameRow) {
        group.passengerIds.forEach((pid) => {
          const passenger = passengers.find((p) => p.id === pid);
          if (passenger) {
            conflicts.push({
              entryId: `conflict-${++conflictId}`,
              conflictType: 'companion_split',
              affectedPassengerId: pid,
              affectedGroupId: group.groupId,
              description: `同行组 ${group.groupId} 成员 ${passenger.name} 座位 ${newSeatAssignment.get(pid)} 与其他成员分开`,
              reason: `同行组 ${group.groupId} 共有 ${group.passengerIds.length} 人，当前座位无法全部相邻，需要分开安排`,
            });
          }
        });
      }
    }
  });

  const seatPassengerMap = new Map<string, string[]>();
  newSeatAssignment.forEach((seat, pid) => {
    if (!seatPassengerMap.has(seat)) {
      seatPassengerMap.set(seat, []);
    }
    seatPassengerMap.get(seat)!.push(pid);
  });

  seatPassengerMap.forEach((pids, seat) => {
    if (pids.length > 1) {
      pids.forEach((pid) => {
        const passenger = passengers.find((p) => p.id === pid);
        if (passenger) {
          conflicts.push({
            entryId: `conflict-${++conflictId}`,
            conflictType: 'overbooked_duplicate',
            affectedPassengerId: pid,
            description: `座位 ${seat} 被 ${pids.length} 名乘客重复分配`,
            reason: `航班超售，座位 ${seat} 同时分配给 ${pids.length} 名乘客，需进一步调整`,
          });
        }
      });
    }
  });

  return conflicts;
}

export function calculateTotalScore(
  actions: SwapAction[],
  conflicts: ConflictEntry[],
  weightConfig: WeightConfig
): number {
  let score = 0;

  const conflictTypeWeights: Record<string, number> = {
    paid_displaced: weightConfig.paidSeatWeight * 10,
    companion_split: weightConfig.companionWeight * 5,
    overbooked_duplicate: 50,
  };

  conflicts.forEach((c) => {
    score += conflictTypeWeights[c.conflictType] || 10;
  });

  score += actions.length * weightConfig.distanceWeight;

  return -score;
}

export function generateSwapSchemes(
  passengers: Passenger[],
  seats: Seat[],
  paidSeats: PaidSeat[],
  companionGroups: CompanionGroup[],
  weightConfig: WeightConfig,
  numSchemes: number = 3
): SwapScheme[] {
  if (passengers.length === 0 || seats.length === 0) {
    return [];
  }

  const schemes: SwapScheme[] = [];

  const costMatrix = calculateCostMatrix(
    passengers,
    seats,
    paidSeats,
    companionGroups,
    weightConfig
  );

  const assignments = hungarianAlgorithm(costMatrix);
  const actions = generateSwapActions(passengers, seats, assignments);
  const conflicts = detectConflicts(passengers, seats, actions, paidSeats, companionGroups);
  const score = calculateTotalScore(actions, conflicts, weightConfig);

  schemes.push({
    schemeId: 'scheme-0',
    actions,
    conflicts,
    totalScore: score,
    isRecommended: true,
  });

  for (let i = 1; i < numSchemes; i++) {
    const modifiedConfig = { ...weightConfig };
    const weights = ['paidSeatWeight', 'companionWeight', 'cabinDiffWeight', 'distanceWeight'] as const;
    const randomWeight = weights[Math.floor(Math.random() * weights.length)];
    modifiedConfig[randomWeight] = Math.max(1, modifiedConfig[randomWeight] + (Math.random() > 0.5 ? 2 : -2));

    const altCostMatrix = calculateCostMatrix(
      passengers,
      seats,
      paidSeats,
      companionGroups,
      modifiedConfig
    );

    const altAssignments = hungarianAlgorithm(altCostMatrix);
    const altActions = generateSwapActions(passengers, seats, altAssignments);
    const altConflicts = detectConflicts(passengers, seats, altActions, paidSeats, companionGroups);
    const altScore = calculateTotalScore(altActions, altConflicts, weightConfig);

    schemes.push({
      schemeId: `scheme-${i}`,
      actions: altActions,
      conflicts: altConflicts,
      totalScore: altScore,
      isRecommended: false,
    });
  }

  return schemes.sort((a, b) => b.totalScore - a.totalScore).map((s, idx) => ({
    ...s,
    isRecommended: idx === 0,
  }));
}

export { calculateSeatDistance };
