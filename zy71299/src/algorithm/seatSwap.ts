import {
  Passenger,
  Seat,
  PaidSeat,
  CompanionGroup,
  RebookingRecord,
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

export function detectPreSwapOverbooking(
  passengers: Passenger[],
  rebookingRecords: RebookingRecord[]
): ConflictEntry[] {
  const conflicts: ConflictEntry[] = [];
  let conflictId = 0;

  const seatPassengerMap = new Map<string, Passenger[]>();
  passengers.forEach((p) => {
    if (!seatPassengerMap.has(p.currentSeat)) {
      seatPassengerMap.set(p.currentSeat, []);
    }
    seatPassengerMap.get(p.currentSeat)!.push(p);
  });

  seatPassengerMap.forEach((paxList, seat) => {
    if (paxList.length > 1) {
      const rebookedIds = new Set(rebookingRecords.map((r) => r.passengerId));
      paxList.forEach((p) => {
        const isRebooked = rebookedIds.has(p.id);
        const rebooking = rebookingRecords.find((r) => r.passengerId === p.id);
        conflicts.push({
          entryId: `conflict-preswap-${++conflictId}`,
          conflictType: 'overbooked_duplicate',
          affectedPassengerId: p.id,
          description: `座位 ${seat} 被 ${paxList.length} 名乘客（${paxList.map((x) => x.name).join('、')}）重复占用`,
          reason: isRebooked
            ? `乘客 ${p.name} 已改签至航班 ${rebooking!.targetFlight}，但原座位 ${seat} 尚未释放，与 ${paxList.filter((x) => x.id !== p.id).map((x) => x.name).join('、')} 冲突`
            : `航班超售，座位 ${seat} 同时分配给 ${paxList.length} 名乘客，需调座解决`,
        });
      });
    }
  });

  return conflicts;
}

export function detectConflicts(
  passengers: Passenger[],
  seats: Seat[],
  actions: SwapAction[],
  paidSeats: PaidSeat[],
  companionGroups: CompanionGroup[],
  rebookingRecords: RebookingRecord[]
): ConflictEntry[] {
  const conflicts: ConflictEntry[] = [];
  let conflictId = 0;

  const preSwapOverbooking = detectPreSwapOverbooking(passengers, rebookingRecords);
  preSwapOverbooking.forEach((c) => {
    conflicts.push({
      ...c,
      entryId: `conflict-${++conflictId}`,
    });
  });

  const newSeatAssignment = new Map<string, string>();
  passengers.forEach((p) => newSeatAssignment.set(p.id, p.currentSeat));
  actions.forEach((a) => newSeatAssignment.set(a.passengerId, a.toSeat));

  const paidSeatMap = new Map(paidSeats.map((ps) => [ps.passengerId, ps]));
  actions.forEach((action) => {
    const paidSeat = paidSeatMap.get(action.passengerId);
    if (paidSeat) {
      const originalSeat = action.fromSeat;
      const isOverbookedSeat = preSwapOverbooking.some(
        (c) => c.affectedPassengerId === action.passengerId
      );
      conflicts.push({
        entryId: `conflict-${++conflictId}`,
        conflictType: 'paid_displaced',
        affectedPassengerId: action.passengerId,
        description: `付费座位 ${originalSeat} 被更换为 ${action.toSeat}，乘客已支付 ¥${paidSeat.fee}`,
        reason: isOverbookedSeat
          ? `超售导致座位 ${originalSeat} 需重新分配，乘客原付费座位（费用 ¥${paidSeat.fee}）被调整`
          : `同行优化或调座需要，乘客原付费座位 ${originalSeat}（费用 ¥${paidSeat.fee}）被调整至 ${action.toSeat}`,
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
      const allAdjacent = allSameRow && cols.every((c, i) => i === 0 || Math.abs(c.charCodeAt(0) - cols[i - 1].charCodeAt(0)) <= 1);
      if (!allSameRow || !allAdjacent) {
        group.passengerIds.forEach((pid) => {
          const passenger = passengers.find((p) => p.id === pid);
          if (passenger) {
            const seat = newSeatAssignment.get(pid);
            const otherMembers = group.passengerIds
              .filter((id) => id !== pid)
              .map((id) => {
                const otherP = passengers.find((p) => p.id === id);
                const otherSeat = newSeatAssignment.get(id);
                return otherP ? `${otherP.name}(${otherSeat})` : id;
              });
            conflicts.push({
              entryId: `conflict-${++conflictId}`,
              conflictType: 'companion_split',
              affectedPassengerId: pid,
              affectedGroupId: group.groupId,
              description: `同行组 ${group.groupId} 成员 ${passenger.name} 座位 ${seat} 与其他成员 ${otherMembers.join('、')} 分开`,
              reason: `同行组 ${group.groupId} 共 ${group.passengerIds.length} 人，当前可用座位无法全部相邻，需分开安排`,
            });
          }
        });
      }
    }
  });

  const postSwapSeatMap = new Map<string, string[]>();
  newSeatAssignment.forEach((seat, pid) => {
    if (!postSwapSeatMap.has(seat)) {
      postSwapSeatMap.set(seat, []);
    }
    postSwapSeatMap.get(seat)!.push(pid);
  });

  postSwapSeatMap.forEach((pids, seat) => {
    if (pids.length > 1) {
      const alreadyListed = preSwapOverbooking.some((c) =>
        c.description.includes(`座位 ${seat} 被`) && pids.includes(c.affectedPassengerId)
      );
      if (!alreadyListed) {
        pids.forEach((pid) => {
          const passenger = passengers.find((p) => p.id === pid);
          if (passenger) {
            conflicts.push({
              entryId: `conflict-${++conflictId}`,
              conflictType: 'overbooked_duplicate',
              affectedPassengerId: pid,
              description: `调座后座位 ${seat} 仍被 ${pids.length} 名乘客重复分配`,
              reason: `调座方案未能完全消除超售冲突，座位 ${seat} 仍同时分配给 ${paxList_names(passengers, pids)}，需进一步调整`,
            });
          }
        });
      }
    }
  });

  return conflicts;
}

function paxList_names(passengers: Passenger[], pids: string[]): string {
  return pids
    .map((pid) => {
      const p = passengers.find((x) => x.id === pid);
      return p ? p.name : pid;
    })
    .join('、');
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
  rebookingRecords: RebookingRecord[],
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
  const conflicts = detectConflicts(passengers, seats, actions, paidSeats, companionGroups, rebookingRecords);
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
    const altConflicts = detectConflicts(passengers, seats, altActions, paidSeats, companionGroups, rebookingRecords);
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
