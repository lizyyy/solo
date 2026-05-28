import {
  Passenger,
  SeatMap,
  PaidSeat,
  CompanionGroup,
  RebookingRecord,
  SwapScheme,
  SwapAction,
} from '@/types';
import { calculateSeatDistance } from '@/algorithm/seatSwap';

export function generatePassengerName(idx: number): string {
  const surnames = ['张', '李', '王', '刘', '陈', '杨', '赵', '黄', '周', '吴'];
  const names = ['伟', '芳', '娜', '秀英', '敏', '静', '丽', '强', '磊', '洋'];
  return surnames[idx % surnames.length] + names[Math.floor(idx / surnames.length) % names.length];
}

export function generateSampleData(): {
  passengers: Passenger[];
  seatMap: SeatMap;
  paidSeats: PaidSeat[];
  companionGroups: CompanionGroup[];
  rebookingRecords: RebookingRecord[];
} {
  const rows = 15;
  const cols = ['A', 'B', 'C', 'D', 'E', 'F'];

  const passengers: Passenger[] = [];
  const paidSeats: PaidSeat[] = [];
  const companionGroups: CompanionGroup[] = [];
  const rebookingRecords: RebookingRecord[] = [];

  for (let i = 0; i < 84; i++) {
    const row = Math.floor(i / 6) + 1;
    const col = cols[i % 6];
    const cabinClass = row <= 3 ? '商务舱' : row <= 6 ? '超级经济舱' : '经济舱';

    passengers.push({
      id: `P${String(i + 1).padStart(3, '0')}`,
      name: generatePassengerName(i),
      currentSeat: `${row}${col}`,
      cabinClass,
    });
  }

  passengers.push({
    id: 'P085',
    name: '周杰',
    currentSeat: '1A',
    cabinClass: '商务舱',
  });

  const paidPassengerIndices = [0, 5, 10, 15, 20, 25, 30];
  paidPassengerIndices.forEach((idx, i) => {
    paidSeats.push({
      seatId: passengers[idx].currentSeat,
      fee: [200, 150, 100, 100, 50, 50, 50][i],
      passengerId: passengers[idx].id,
    });
  });

  companionGroups.push({
    groupId: 'G001',
    passengerIds: [passengers[10].id, passengers[11].id, passengers[12].id],
    priority: 'high',
  });

  companionGroups.push({
    groupId: 'G002',
    passengerIds: [passengers[35].id, passengers[36].id],
    priority: 'medium',
  });

  companionGroups.push({
    groupId: 'G003',
    passengerIds: [passengers[55].id, passengers[56].id, passengers[57].id, passengers[58].id],
    priority: 'low',
  });

  rebookingRecords.push({
    id: 'R001',
    passengerId: passengers[5].id,
    originalSeat: passengers[5].currentSeat,
    targetFlight: 'CA1234',
  });

  rebookingRecords.push({
    id: 'R002',
    passengerId: passengers[25].id,
    originalSeat: passengers[25].currentSeat,
    targetFlight: 'CA5678',
  });

  rebookingRecords.push({
    id: 'R003',
    passengerId: 'P085',
    originalSeat: '1A',
    targetFlight: 'CA9999',
  });

  const seats = [];
  for (let row = 1; row <= rows; row++) {
    for (const col of cols) {
      const seatId = `${row}${col}`;
      const passenger = passengers.find((p) => p.currentSeat === seatId);
      const cabinClass = row <= 3 ? '商务舱' : row <= 6 ? '超级经济舱' : '经济舱';
      seats.push({
        seatId,
        row,
        col,
        status: passenger ? 'occupied' : 'available',
        cabinClass,
      });
    }
  }

  const seatMap: SeatMap = {
    id: 'SM001',
    rows,
    cols,
    seats,
  };

  return {
    passengers,
    seatMap,
    paidSeats,
    companionGroups,
    rebookingRecords,
  };
}

export function generateCSVReport(
  scheme: SwapScheme,
  passengers: Passenger[],
  paidSeats: PaidSeat[],
  companionGroups: CompanionGroup[]
): string {
  const headers = ['乘客ID', '姓名', '原座位', '新座位', '舱位', '是否付费', '同行组', '冲突类型', '冲突说明'];

  const passengerMap = new Map(passengers.map((p) => [p.id, p]));
  const paidSeatMap = new Map(paidSeats.map((ps) => [ps.passengerId, ps]));
  const companionMap = new Map<string, string>();
  companionGroups.forEach((g) => {
    g.passengerIds.forEach((pid) => companionMap.set(pid, g.groupId));
  });

  const passengerConflicts = new Map<string, string[]>();
  scheme.conflicts.forEach((c) => {
    if (!passengerConflicts.has(c.affectedPassengerId)) {
      passengerConflicts.set(c.affectedPassengerId, []);
    }
    passengerConflicts.get(c.affectedPassengerId)!.push(c.description);
  });

  const conflictTypeMap = new Map<string, string>();
  scheme.conflicts.forEach((c) => {
    conflictTypeMap.set(c.affectedPassengerId, c.conflictType);
  });

  const actionMap = new Map(scheme.actions.map((a) => [a.passengerId, a]));

  const rows = passengers.map((p) => {
    const action = actionMap.get(p.id);
    const newSeat = action ? action.toSeat : p.currentSeat;
    const isPaid = paidSeatMap.has(p.id) ? '是' : '否';
    const groupId = companionMap.get(p.id) || '-';
    const conflictType = conflictTypeMap.get(p.id)
      ? conflictTypeMap.get(p.id) === 'paid_displaced'
        ? '付费座位变更'
        : conflictTypeMap.get(p.id) === 'companion_split'
        ? '同行拆分'
        : '超售重复'
      : '-';
    const conflictDesc = passengerConflicts.get(p.id)?.join('; ') || '-';

    return [
      p.id,
      p.name,
      p.currentSeat,
      newSeat,
      p.cabinClass,
      isPaid,
      groupId,
      conflictType,
      conflictDesc,
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}

export function generateJSONReport(
  scheme: SwapScheme,
  passengers: Passenger[],
  paidSeats: PaidSeat[],
  companionGroups: CompanionGroup[],
  weightConfig: { paidSeatWeight: number; companionWeight: number; cabinDiffWeight: number; distanceWeight: number }
): string {
  const passengerMap = new Map(passengers.map((p) => [p.id, p]));
  const actionMap = new Map(scheme.actions.map((a) => [a.passengerId, a]));

  const passengerDetails = passengers.map((p) => {
    const action = actionMap.get(p.id);
    const newSeat = action ? action.toSeat : p.currentSeat;
    const distance = action ? calculateSeatDistance(p.currentSeat, newSeat) : 0;
    const conflicts = scheme.conflicts.filter((c) => c.affectedPassengerId === p.id);

    return {
      passengerId: p.id,
      name: p.name,
      originalSeat: p.currentSeat,
      newSeat,
      cabinClass: p.cabinClass,
      isPaidSeat: paidSeats.some((ps) => ps.passengerId === p.id),
      companionGroup: companionGroups.find((g) => g.passengerIds.includes(p.id))?.groupId || null,
      moveDistance: distance,
      hasConflict: conflicts.length > 0,
      conflicts: conflicts.map((c) => ({
        type: c.conflictType,
        description: c.description,
        reason: c.reason,
      })),
    };
  });

  const report = {
    schemeId: scheme.schemeId,
    isRecommended: scheme.isRecommended,
    totalScore: scheme.totalScore,
    generatedAt: new Date().toISOString(),
    weightConfig,
    statistics: {
      totalPassengers: passengers.length,
      totalSwaps: scheme.actions.length,
      totalConflicts: scheme.conflicts.length,
      paidDisplacedCount: scheme.conflicts.filter((c) => c.conflictType === 'paid_displaced').length,
      companionSplitCount: scheme.conflicts.filter((c) => c.conflictType === 'companion_split').length,
      overbookedDuplicateCount: scheme.conflicts.filter((c) => c.conflictType === 'overbooked_duplicate').length,
      averageMoveDistance:
        scheme.actions.length > 0
          ? Math.round(
              scheme.actions.reduce((sum, a) => {
                const p = passengerMap.get(a.passengerId);
                return sum + (p ? calculateSeatDistance(a.fromSeat, a.toSeat) : 0);
              }, 0) / scheme.actions.length
            )
          : 0,
    },
    passengerDetails,
  };

  return JSON.stringify(report, null, 2);
}

export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
