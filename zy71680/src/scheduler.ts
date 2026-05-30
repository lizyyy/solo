import type {
  Booking, Room, Engineer, Equipment, CustomerNote, Conflict,
  ResourceLock, RescheduleLog, ProcessingResult, Provenance, BookingStatus,
  ValidationResult
} from './types.js';
import { detectRoomOverlaps, detectEngineerDoubles, detectMissingEquipment, acquireLocks } from './conflict.js';

function now(): string {
  return new Date().toISOString();
}

function makeProvenance(): Provenance {
  return { source: 'system', sourceDetail: 'scheduler', importedAt: now() };
}

const BLOCKING_VALIDATION_KEYS = [
  '缺少房间ID',
  '缺少日期',
  '缺少开始时间',
  '缺少结束时间',
  '时间范围不合理',
  '日期格式异常',
  '日期无法解析',
];

function hasBlockingValidationIssue(bookingId: string, validationResults: ValidationResult[]): boolean {
  return validationResults.some(v =>
    v.recordId === bookingId &&
    !v.valid &&
    v.issues.some(issue => BLOCKING_VALIDATION_KEYS.some(key => issue.includes(key)))
  );
}

export interface ScheduleResult {
  processedBookings: Booking[];
  allConflicts: Conflict[];
  allLocks: ResourceLock[];
  allReschedules: RescheduleLog[];
  processingResults: ProcessingResult[];
}

export function schedule(
  bookings: Booking[],
  rooms: Room[],
  engineers: Engineer[],
  equipment: Equipment[],
  notes: CustomerNote[],
  legacyConflicts: Conflict[],
  validationResults: ValidationResult[] = []
): ScheduleResult {
  const processedBookings: Booking[] = [];
  const allConflicts: Conflict[] = [...legacyConflicts];
  const allLocks: ResourceLock[] = [];
  const allReschedules: RescheduleLog[] = [];
  const processingResults: ProcessingResult[] = [];
  const systemProvenance = makeProvenance();

  const roomOverlaps = detectRoomOverlaps(bookings, systemProvenance);
  const engineerDoubles = detectEngineerDoubles(bookings, systemProvenance);
  const missingEquip = detectMissingEquipment(bookings, rooms, equipment, systemProvenance);
  allConflicts.push(...roomOverlaps, ...engineerDoubles, ...missingEquip);

  const conflictMap = new Map<string, Conflict[]>();
  for (const c of allConflicts) {
    for (const bid of c.bookingIds) {
      if (!conflictMap.has(bid)) conflictMap.set(bid, []);
      conflictMap.get(bid)!.push(c);
    }
  }

  const sorted = [...bookings].sort((a, b) => a.processingOrder - b.processingOrder);

  for (const booking of sorted) {
    const bookingConflicts = conflictMap.get(booking.id) ?? [];
    const criticalConflicts = bookingConflicts.filter(c => c.severity === 'critical');

    const lockResult = acquireLocks(booking, allLocks);

    let finalStatus: BookingStatus = booking.status;
    let reschedules: RescheduleLog[] = [];

    const hasBlockingIssue = hasBlockingValidationIssue(booking.id, validationResults);

    if (booking.status === 'cancelled') {
      finalStatus = 'cancelled';
    } else if (hasBlockingIssue) {
      finalStatus = 'pending';
    } else if (criticalConflicts.length > 0 || lockResult.blocked) {
      if (booking.status === 'confirmed' || booking.status === 'in_progress') {
        finalStatus = booking.status;
      } else {
        finalStatus = 'pending';
      }

      if (lockResult.blocked && criticalConflicts.length === 0) {
        const autoRescheduled = tryAutoReschedule(booking, allLocks, allConflicts, bookingConflicts);
        if (autoRescheduled) {
          reschedules.push(autoRescheduled.reschedule);
          allReschedules.push(autoRescheduled.reschedule);
          booking.date = autoRescheduled.newDate;
          booking.startTime = autoRescheduled.newStart;
          booking.endTime = autoRescheduled.newEnd;
          booking.updatedAt = now();
          finalStatus = 'confirmed';
          allLocks.push(...autoRescheduled.locks);
        }
      }
    } else if (booking.status === 'pending') {
      finalStatus = 'confirmed';
      allLocks.push(...lockResult.locks);
    } else {
      allLocks.push(...lockResult.locks);
    }

    if (finalStatus === 'confirmed' && !lockResult.blocked && lockResult.locks.length > 0) {
      const alreadyLocked = allLocks.some(l => l.bookingId === booking.id);
      if (!alreadyLocked) {
        allLocks.push(...lockResult.locks);
      }
    }

    const updated: Booking = {
      ...booking,
      status: finalStatus,
      updatedAt: now(),
    };
    processedBookings.push(updated);

    processingResults.push({
      bookingId: booking.id,
      processingOrder: booking.processingOrder,
      status: finalStatus,
      conflicts: bookingConflicts,
      locks: allLocks.filter(l => l.bookingId === booking.id),
      reschedules,
    });
  }

  return {
    processedBookings,
    allConflicts,
    allLocks,
    allReschedules,
    processingResults,
  };
}

function tryAutoReschedule(
  booking: Booking,
  existingLocks: ResourceLock[],
  existingConflicts: Conflict[],
  bookingConflicts: Conflict[]
): { reschedule: RescheduleLog; newDate: string; newStart: string; newEnd: string; locks: ResourceLock[] } | null {
  if (bookingConflicts.some(c => c.severity === 'critical')) {
    return null;
  }

  const [hours, minutes] = booking.startTime.split(':').map(Number);
  const durationMinutes = timeDiff(booking.startTime, booking.endTime);
  const newStart = formatTime(hours, minutes + 60);
  const newEnd = formatTime(hours, minutes + 60 + durationMinutes);

  if (newStart >= '22:00') {
    return null;
  }

  const lockResult = acquireLocks(
    { ...booking, startTime: newStart, endTime: newEnd },
    existingLocks
  );

  if (lockResult.blocked) {
    return null;
  }

  const reschedule: RescheduleLog = {
    id: `RS-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    bookingId: booking.id,
    oldDate: booking.date,
    oldStartTime: booking.startTime,
    oldEndTime: booking.endTime,
    newDate: booking.date,
    newStartTime: newStart,
    newEndTime: newEnd,
    reason: `自动改期：原时段 ${booking.startTime}-${booking.endTime} 资源冲突（${lockResult.blockedBy.join(', ')}）`,
    operator: 'system',
    timestamp: now(),
  };

  return {
    reschedule,
    newDate: booking.date,
    newStart,
    newEnd,
    locks: lockResult.locks,
  };
}

function timeDiff(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  return (eh * 60 + em) - (sh * 60 + sm);
}

function formatTime(h: number, m: number): string {
  const totalMinutes = h * 60 + m;
  const rh = Math.floor(totalMinutes / 60);
  const rm = totalMinutes % 60;
  return `${String(rh).padStart(2, '0')}:${String(rm).padStart(2, '0')}`;
}
