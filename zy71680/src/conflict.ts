import type {
  Booking, Room, Engineer, Equipment, Conflict, ResourceLock, Provenance, Severity
} from './types.js';

function now(): string {
  return new Date().toISOString();
}

function timeOverlaps(
  dateA: string, startA: string, endA: string,
  dateB: string, startB: string, endB: string
): boolean {
  if (dateA !== dateB) return false;
  return startA < endB && startB < endA;
}

function makeConflict(
  type: Conflict['type'],
  severity: Severity,
  bookingIds: string[],
  description: string,
  affectedResources: string[],
  provenance: Provenance
): Conflict {
  return {
    id: `CFL-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    severity,
    bookingIds,
    description,
    affectedResources,
    resolutionStatus: 'open',
    detectedAt: now(),
    provenance,
  };
}

export function detectRoomOverlaps(
  bookings: Booking[],
  provenance: Provenance
): Conflict[] {
  const conflicts: Conflict[] = [];
  const sorted = [...bookings].filter(b => b.status !== 'cancelled');

  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const a = sorted[i];
      const b = sorted[j];
      if (a.roomId !== b.roomId) continue;
      if (timeOverlaps(a.date, a.startTime, a.endTime, b.date, b.startTime, b.endTime)) {
        const laterBooking = a.processingOrder > b.processingOrder ? a : b;
        conflicts.push(makeConflict(
          'ROOM_OVERLAP',
          'critical',
          [a.id, b.id],
          `房间 ${a.roomId} 在 ${a.date} ${a.startTime}-${a.endTime} 与 ${b.startTime}-${b.endTime} 重叠（预约 ${a.id} vs ${b.id}）`,
          [a.roomId],
          provenance
        ));
      }
    }
  }
  return conflicts;
}

export function detectEngineerDoubles(
  bookings: Booking[],
  provenance: Provenance
): Conflict[] {
  const conflicts: Conflict[] = [];
  const withEngineer = bookings.filter(b => b.engineerId && b.status !== 'cancelled');

  for (let i = 0; i < withEngineer.length; i++) {
    for (let j = i + 1; j < withEngineer.length; j++) {
      const a = withEngineer[i];
      const b = withEngineer[j];
      if (a.engineerId !== b.engineerId) continue;
      if (timeOverlaps(a.date, a.startTime, a.endTime, b.date, b.startTime, b.endTime)) {
        conflicts.push(makeConflict(
          'ENGINEER_DOUBLE',
          'critical',
          [a.id, b.id],
          `工程师 ${a.engineerId} 在 ${a.date} 被双约（预约 ${a.id} ${a.startTime}-${a.endTime} vs 预约 ${b.id} ${b.startTime}-${b.endTime}）`,
          [a.engineerId!],
          provenance
        ));
      }
    }
  }
  return conflicts;
}

export function detectMissingEquipment(
  bookings: Booking[],
  rooms: Room[],
  equipment: Equipment[],
  provenance: Provenance
): Conflict[] {
  const conflicts: Conflict[] = [];
  const roomMap = new Map(rooms.map(r => [r.id, r]));
  const equipMap = new Map(equipment.map(e => [e.id, e]));

  for (const booking of bookings) {
    if (booking.status === 'cancelled') continue;
    const requiredEquip = booking.equipmentIds;
    if (requiredEquip.length === 0) continue;

    const room = roomMap.get(booking.roomId);
    const roomEquipIds = new Set(room?.equipmentIds ?? []);

    const missing: string[] = [];
    for (const eqId of requiredEquip) {
      if (!roomEquipIds.has(eqId) && !equipMap.has(eqId)) {
        missing.push(eqId);
      } else if (equipMap.has(eqId)) {
        const eq = equipMap.get(eqId)!;
        if (eq.roomId && eq.roomId !== booking.roomId) {
          missing.push(eqId);
        }
      }
    }

    if (missing.length > 0) {
      const missingNames = missing.map(id => {
        const eq = equipMap.get(id);
        return eq ? `${eq.name}(${id})` : id;
      });
      conflicts.push(makeConflict(
        'MISSING_EQUIPMENT',
        'warning',
        [booking.id],
        `预约 ${booking.id} 缺少设备: ${missingNames.join(', ')}（房间 ${booking.roomId} 无此设备）`,
        missing,
        provenance
      ));
    }
  }
  return conflicts;
}

export function findExistingLock(
  locks: ResourceLock[],
  resourceId: string,
  resourceType: ResourceLock['resourceType'],
  date: string,
  startTime: string,
  endTime: string
): ResourceLock | undefined {
  return locks.find(lock =>
    lock.resourceId === resourceId &&
    lock.resourceType === resourceType &&
    lock.date === date &&
    lock.startTime < endTime &&
    startTime < lock.endTime
  );
}

export function acquireLocks(
  booking: Booking,
  existingLocks: ResourceLock[]
): { locks: ResourceLock[]; blocked: boolean; blockedBy: string[] } {
  const newLocks: ResourceLock[] = [];
  const blockedBy: string[] = [];

  const roomLock = findExistingLock(existingLocks, booking.roomId, 'room', booking.date, booking.startTime, booking.endTime);
  if (roomLock) {
    blockedBy.push(`房间 ${booking.roomId} 已被预约 ${roomLock.bookingId} 锁定`);
  } else {
    newLocks.push({
      resourceId: booking.roomId,
      resourceType: 'room',
      bookingId: booking.id,
      date: booking.date,
      startTime: booking.startTime,
      endTime: booking.endTime,
      lockedAt: now(),
    });
  }

  if (booking.engineerId) {
    const engLock = findExistingLock(existingLocks, booking.engineerId, 'engineer', booking.date, booking.startTime, booking.endTime);
    if (engLock) {
      blockedBy.push(`工程师 ${booking.engineerId} 已被预约 ${engLock.bookingId} 锁定`);
    } else {
      newLocks.push({
        resourceId: booking.engineerId,
        resourceType: 'engineer',
        bookingId: booking.id,
        date: booking.date,
        startTime: booking.startTime,
        endTime: booking.endTime,
        lockedAt: now(),
      });
    }
  }

  return {
    locks: newLocks,
    blocked: blockedBy.length > 0,
    blockedBy,
  };
}
