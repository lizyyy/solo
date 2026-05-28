import {
  Passenger,
  SeatMap,
  PaidSeat,
  CompanionGroup,
  RebookingRecord,
  ValidationError,
} from '@/types';

export function validatePassengerId(id: string): boolean {
  return /^P\d{3,}$/.test(id);
}

export function validateSeatId(seatId: string): boolean {
  return /^\d+[A-F]$/.test(seatId);
}

export function validatePassengers(passengers: Passenger[]): ValidationError[] {
  const errors: ValidationError[] = [];
  const ids = new Set<string>();
  const seats = new Set<string>();

  passengers.forEach((p, idx) => {
    if (!p.id || !validatePassengerId(p.id)) {
      errors.push({
        field: `passengers[${idx}].id`,
        message: `乘客 ${p.name || idx + 1} 的ID格式无效，应为 P+数字（如 P001）`,
        severity: 'error',
      });
    } else if (ids.has(p.id)) {
      errors.push({
        field: `passengers[${idx}].id`,
        message: `乘客ID ${p.id} 重复`,
        severity: 'error',
      });
    } else {
      ids.add(p.id);
    }

    if (!p.name || p.name.trim().length === 0) {
      errors.push({
        field: `passengers[${idx}].name`,
        message: `乘客 ${idx + 1} 的姓名不能为空`,
        severity: 'error',
      });
    }

    if (!p.currentSeat || !validateSeatId(p.currentSeat)) {
      errors.push({
        field: `passengers[${idx}].currentSeat`,
        message: `乘客 ${p.name || idx + 1} 的座位号格式无效，应为 数字+字母（如 12A）`,
        severity: 'error',
      });
    } else if (seats.has(p.currentSeat)) {
      errors.push({
        field: `passengers[${idx}].currentSeat`,
        message: `座位 ${p.currentSeat} 被多名乘客占用`,
        severity: 'error',
      });
    } else {
      seats.add(p.currentSeat);
    }

    if (!p.cabinClass || p.cabinClass.trim().length === 0) {
      errors.push({
        field: `passengers[${idx}].cabinClass`,
        message: `乘客 ${p.name || idx + 1} 的舱位不能为空`,
        severity: 'warning',
      });
    }
  });

  return errors;
}

export function validateSeatMap(seatMap: SeatMap | null): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!seatMap) {
    errors.push({
      field: 'seatMap',
      message: '座位图尚未配置',
      severity: 'error',
    });
    return errors;
  }

  if (!seatMap.rows || seatMap.rows <= 0) {
    errors.push({
      field: 'seatMap.rows',
      message: '行数必须大于 0',
      severity: 'error',
    });
  }

  if (!seatMap.cols || seatMap.cols.length === 0) {
    errors.push({
      field: 'seatMap.cols',
      message: '列配置不能为空',
      severity: 'error',
    });
  }

  const expectedSeatCount = seatMap.rows * seatMap.cols.length;
  if (seatMap.seats.length !== expectedSeatCount) {
    errors.push({
      field: 'seatMap.seats',
      message: `座位数量不匹配，期望 ${expectedSeatCount} 个，实际 ${seatMap.seats.length} 个`,
      severity: 'error',
    });
  }

  return errors;
}

export function validatePaidSeats(
  paidSeats: PaidSeat[],
  passengers: Passenger[],
  seatMap: SeatMap | null
): ValidationError[] {
  const errors: ValidationError[] = [];
  const passengerIds = new Set(passengers.map((p) => p.id));
  const validSeatIds = new Set(seatMap?.seats.map((s) => s.seatId) || []);

  paidSeats.forEach((ps, idx) => {
    if (!ps.seatId || !validateSeatId(ps.seatId)) {
      errors.push({
        field: `paidSeats[${idx}].seatId`,
        message: `付费座位 ${idx + 1} 的座位号格式无效`,
        severity: 'error',
      });
    } else if (!validSeatIds.has(ps.seatId)) {
      errors.push({
        field: `paidSeats[${idx}].seatId`,
        message: `付费座位 ${ps.seatId} 不在座位图中`,
        severity: 'error',
      });
    }

    if (typeof ps.fee !== 'number' || ps.fee <= 0) {
      errors.push({
        field: `paidSeats[${idx}].fee`,
        message: `付费座位 ${ps.seatId || idx + 1} 的费用必须大于 0`,
        severity: 'error',
      });
    }

    if (!ps.passengerId || !passengerIds.has(ps.passengerId)) {
      errors.push({
        field: `paidSeats[${idx}].passengerId`,
        message: `付费座位 ${ps.seatId || idx + 1} 的乘客ID不存在`,
        severity: 'error',
      });
    }
  });

  return errors;
}

export function validateCompanionGroups(
  groups: CompanionGroup[],
  passengers: Passenger[]
): ValidationError[] {
  const errors: ValidationError[] = [];
  const passengerIds = new Set(passengers.map((p) => p.id));
  const groupIds = new Set<string>();
  const usedPassengerIds = new Set<string>();

  groups.forEach((group, idx) => {
    if (!group.groupId || group.groupId.trim().length === 0) {
      errors.push({
        field: `companionGroups[${idx}].groupId`,
        message: `同行组 ${idx + 1} 的ID不能为空`,
        severity: 'error',
      });
    } else if (groupIds.has(group.groupId)) {
      errors.push({
        field: `companionGroups[${idx}].groupId`,
        message: `同行组ID ${group.groupId} 重复`,
        severity: 'error',
      });
    } else {
      groupIds.add(group.groupId);
    }

    if (!group.passengerIds || group.passengerIds.length < 2) {
      errors.push({
        field: `companionGroups[${idx}].passengerIds`,
        message: `同行组 ${group.groupId || idx + 1} 至少需要 2 名乘客`,
        severity: 'error',
      });
    } else {
      group.passengerIds.forEach((pid) => {
        if (!passengerIds.has(pid)) {
          errors.push({
            field: `companionGroups[${idx}].passengerIds`,
            message: `同行组 ${group.groupId || idx + 1} 中的乘客 ${pid} 不存在`,
            severity: 'error',
          });
        }
        if (usedPassengerIds.has(pid)) {
          errors.push({
            field: `companionGroups[${idx}].passengerIds`,
            message: `乘客 ${pid} 已属于其他同行组`,
            severity: 'error',
          });
        } else {
          usedPassengerIds.add(pid);
        }
      });
    }

    if (!group.priority || !['high', 'medium', 'low'].includes(group.priority)) {
      errors.push({
        field: `companionGroups[${idx}].priority`,
        message: `同行组 ${group.groupId || idx + 1} 的优先级无效`,
        severity: 'warning',
      });
    }
  });

  return errors;
}

export function validateRebookingRecords(
  records: RebookingRecord[],
  passengers: Passenger[]
): ValidationError[] {
  const errors: ValidationError[] = [];
  const passengerIds = new Set(passengers.map((p) => p.id));
  const passengerSeatMap = new Map(passengers.map((p) => [p.id, p.currentSeat]));

  records.forEach((record, idx) => {
    if (!record.passengerId || !passengerIds.has(record.passengerId)) {
      errors.push({
        field: `rebookingRecords[${idx}].passengerId`,
        message: `改签记录 ${idx + 1} 的乘客ID不存在`,
        severity: 'error',
      });
    }

    if (!record.originalSeat || !validateSeatId(record.originalSeat)) {
      errors.push({
        field: `rebookingRecords[${idx}].originalSeat`,
        message: `改签记录 ${idx + 1} 的原座位号格式无效`,
        severity: 'error',
      });
    } else if (record.passengerId && passengerSeatMap.get(record.passengerId) !== record.originalSeat) {
      errors.push({
        field: `rebookingRecords[${idx}].originalSeat`,
        message: `改签记录中原座位 ${record.originalSeat} 与乘客当前座位不符`,
        severity: 'warning',
      });
    }

    if (!record.targetFlight || record.targetFlight.trim().length === 0) {
      errors.push({
        field: `rebookingRecords[${idx}].targetFlight`,
        message: `改签记录 ${idx + 1} 的目标航班不能为空`,
        severity: 'warning',
      });
    }
  });

  return errors;
}

export function validateAll(
  passengers: Passenger[],
  seatMap: SeatMap | null,
  paidSeats: PaidSeat[],
  companionGroups: CompanionGroup[],
  rebookingRecords: RebookingRecord[]
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (passengers.length === 0) {
    errors.push({
      field: 'passengers',
      message: '乘客名单不能为空',
      severity: 'error',
    });
  }

  errors.push(...validatePassengers(passengers));
  errors.push(...validateSeatMap(seatMap));
  errors.push(...validatePaidSeats(paidSeats, passengers, seatMap));
  errors.push(...validateCompanionGroups(companionGroups, passengers));
  errors.push(...validateRebookingRecords(rebookingRecords, passengers));

  return errors;
}
