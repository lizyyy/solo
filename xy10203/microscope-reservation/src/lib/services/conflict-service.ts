import db from '../db';
import { ConflictCheckResult, ConflictDetail, ReservationStatus } from '../types';
import { getOverlapRange } from '../utils';

const ACTIVE_STATUSES: ReservationStatus[] = ['pending', 'approved', 'completed'];

export function checkReservationConflicts(
  microscopeId: string,
  accessoryIds: string[],
  startTime: string,
  endTime: string,
  excludeReservationId?: string
): ConflictCheckResult {
  const conflicts: ConflictDetail[] = [];

  const activeReservationsStmt = db.prepare(`
    SELECT r.id, r.start_time, r.end_time, r.purpose, r.status,
           m.name as microscope_name,
           u.name as user_name,
           g.name as group_name
    FROM reservations r
    JOIN microscopes m ON r.microscope_id = m.id
    JOIN users u ON r.user_id = u.id
    JOIN research_groups g ON r.group_id = g.id
    WHERE r.microscope_id = ?
      AND r.status IN (${ACTIVE_STATUSES.map(() => '?').join(',')})
      ${excludeReservationId ? 'AND r.id != ?' : ''}
  `);

  const params = [microscopeId, ...ACTIVE_STATUSES];
  if (excludeReservationId) params.push(excludeReservationId);

  const activeReservations = activeReservationsStmt.all(...params) as any[];

  for (const reservation of activeReservations) {
    const overlap = getOverlapRange(
      startTime,
      endTime,
      reservation.start_time,
      reservation.end_time
    );

    if (overlap) {
      conflicts.push({
        type: 'microscope',
        resourceId: microscopeId,
        resourceName: reservation.microscope_name,
        conflictingReservationId: reservation.id,
        conflictingReservationTitle: `[${reservation.group_name}] ${reservation.user_name} - ${reservation.purpose.substring(0, 30)}`,
        overlappingTime: overlap
      });
    }
  }

  if (accessoryIds.length > 0) {
    const accessoryReservationsStmt = db.prepare(`
      SELECT r.id, r.start_time, r.end_time, r.purpose, r.status,
             a.id as accessory_id,
             a.name as accessory_name,
             u.name as user_name,
             g.name as group_name
      FROM reservations r
      JOIN reservation_accessories ra ON r.id = ra.reservation_id
      JOIN accessories a ON ra.accessory_id = a.id
      JOIN users u ON r.user_id = u.id
      JOIN research_groups g ON r.group_id = g.id
      WHERE a.id IN (${accessoryIds.map(() => '?').join(',')})
        AND r.status IN (${ACTIVE_STATUSES.map(() => '?').join(',')})
        ${excludeReservationId ? 'AND r.id != ?' : ''}
    `);

    const accessoryParams = [...accessoryIds, ...ACTIVE_STATUSES];
    if (excludeReservationId) accessoryParams.push(excludeReservationId);

    const accessoryReservations = accessoryReservationsStmt.all(...accessoryParams) as any[];

    for (const accReservation of accessoryReservations) {
      const overlap = getOverlapRange(
        startTime,
        endTime,
        accReservation.start_time,
        accReservation.end_time
      );

      if (overlap) {
        conflicts.push({
          type: 'accessory',
          resourceId: accReservation.accessory_id,
          resourceName: accReservation.accessory_name,
          conflictingReservationId: accReservation.id,
          conflictingReservationTitle: `[${accReservation.group_name}] ${accReservation.user_name} - ${accReservation.purpose.substring(0, 30)}`,
          overlappingTime: overlap
        });
      }
    }
  }

  return {
    hasConflict: conflicts.length > 0,
    conflicts
  };
}

export function getMicroscopeAvailability(
  microscopeId: string,
  date: string
): { available: boolean; reservedSlots: any[] } {
  const reservations = db.prepare(`
    SELECT r.id, r.start_time, r.end_time, r.status, r.purpose,
           u.name as user_name, g.name as group_name
    FROM reservations r
    JOIN users u ON r.user_id = u.id
    JOIN research_groups g ON r.group_id = g.id
    WHERE r.microscope_id = ?
      AND date(r.start_time) = date(?)
      AND r.status IN (${ACTIVE_STATUSES.map(() => '?').join(',')})
    ORDER BY r.start_time
  `).all(microscopeId, date, ...ACTIVE_STATUSES);

  return {
    available: reservations.length === 0,
    reservedSlots: reservations as any[]
  };
}
