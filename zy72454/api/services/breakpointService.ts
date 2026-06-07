import { v4 as uuidv4 } from 'uuid';
import db from '../db/init.js';
import { Breakpoint, BreakpointStatus, BreakpointWithDetails, BusCardTime } from '../../shared/types.js';
import { recordChange } from './historyService.js';
import createFriendlyError from './friendlyErrors.js';

const rowToBreakpoint = (row: {
  id: string;
  name: string;
  location: string;
  lat: number;
  lng: number;
  status: BreakpointStatus;
  has_construction_detour: number;
  redline_note: string | null;
  created_at: string;
  updated_at: string;
}): Breakpoint => ({
  id: row.id,
  name: row.name,
  location: row.location,
  lat: row.lat,
  lng: row.lng,
  status: row.status,
  hasConstructionDetour: row.has_construction_detour === 1,
  redlineNote: row.redline_note,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const STATUS_TRANSITIONS: Record<BreakpointStatus, BreakpointStatus[]> = {
  pending_inspection: ['inspecting', 'pending_review'],
  inspecting: ['pending_review', 'confirmed'],
  pending_review: ['confirmed', 'inspecting'],
  confirmed: ['completed', 'pending_review'],
  completed: [],
};

export const canTransition = (
  current: BreakpointStatus,
  target: BreakpointStatus
): boolean => {
  return STATUS_TRANSITIONS[current].includes(target);
};

export const listBreakpoints = (
  filters: {
    status?: BreakpointStatus;
    hasConstructionDetour?: boolean;
    search?: string;
  } = {}
): Breakpoint[] => {
  let query = 'SELECT * FROM breakpoints WHERE 1=1';
  const params: (string | number)[] = [];

  if (filters.status) {
    query += ' AND status = ?';
    params.push(filters.status);
  }
  if (filters.hasConstructionDetour !== undefined) {
    query += ' AND has_construction_detour = ?';
    params.push(filters.hasConstructionDetour ? 1 : 0);
  }
  if (filters.search) {
    query += ' AND (name LIKE ? OR location LIKE ?)';
    params.push(`%${filters.search}%`, `%${filters.search}%`);
  }

  query += ' ORDER BY created_at DESC';

  const rows = db.prepare(query).all(...params) as Array<{
    id: string;
    name: string;
    location: string;
    lat: number;
    lng: number;
    status: BreakpointStatus;
    has_construction_detour: number;
    redline_note: string | null;
    created_at: string;
    updated_at: string;
  }>;

  return rows.map(rowToBreakpoint);
};

export const getBreakpoint = (id: string): BreakpointWithDetails | null => {
  const bpRow = db.prepare('SELECT * FROM breakpoints WHERE id = ?').get(id) as
    | {
        id: string;
        name: string;
        location: string;
        lat: number;
        lng: number;
        status: BreakpointStatus;
        has_construction_detour: number;
        redline_note: string | null;
        created_at: string;
        updated_at: string;
      }
    | undefined;

  if (!bpRow) return null;

  const busRows = db
    .prepare(
      'SELECT * FROM bus_card_times WHERE breakpoint_id = ? ORDER BY source_date DESC, time_slot ASC'
    )
    .all(id) as Array<{
    id: string;
    breakpoint_id: string;
    import_batch_id: string;
    time_slot: string;
    passenger_count: number;
    source_date: string;
    imported_at: string;
  }>;

  const busCardTimes: BusCardTime[] = busRows.map((row) => ({
    id: row.id,
    breakpointId: row.breakpoint_id,
    importBatchId: row.import_batch_id,
    timeSlot: row.time_slot,
    passengerCount: row.passenger_count,
    sourceDate: row.source_date,
    importedAt: row.imported_at,
  }));

  const historyRows = db
    .prepare(
      'SELECT * FROM history_records WHERE breakpoint_id = ? ORDER BY changed_at DESC'
    )
    .all(id) as Array<{
    id: string;
    breakpoint_id: string;
    field_name: string;
    old_value: string | null;
    new_value: string | null;
    changed_by: string;
    changed_at: string;
    change_type: 'create' | 'update' | 'status_change';
    snapshot: string;
  }>;

  const historyRecords = historyRows.map((row) => ({
    id: row.id,
    breakpointId: row.breakpoint_id,
    fieldName: row.field_name,
    oldValue: row.old_value,
    newValue: row.new_value,
    changedBy: row.changed_by,
    changedAt: row.changed_at,
    changeType: row.change_type,
    snapshot: JSON.parse(row.snapshot),
  }));

  return {
    ...rowToBreakpoint(bpRow),
    busCardTimes,
    historyRecords,
  };
};

export const updateBreakpoint = (
  id: string,
  updates: Partial<{
    redlineNote: string;
    status: BreakpointStatus;
    hasConstructionDetour: boolean;
  }>,
  updatedBy: string
): Breakpoint => {
  const existing = db.prepare('SELECT * FROM breakpoints WHERE id = ?').get(id) as
    | {
        id: string;
        name: string;
        status: BreakpointStatus;
        has_construction_detour: number;
        redline_note: string | null;
        updated_at: string;
      }
    | undefined;

  if (!existing) {
    const err = new Error() as Error & { code?: string };
    err.code = 'BREAKPOINT_NOT_FOUND';
    throw err;
  }

  if (updates.status && !canTransition(existing.status, updates.status)) {
    const err = new Error() as Error & { code?: string };
    err.code = 'STATUS_TRANSITION_INVALID';
    throw err;
  }

  if (
    updates.hasConstructionDetour &&
    updates.status &&
    updates.status !== 'pending_review' &&
    updates.status !== 'inspecting'
  ) {
    const err = new Error() as Error & { code?: string };
    err.code = 'DETOUR_MUST_REVIEW';
    throw err;
  }

  const now = new Date().toISOString();
  const fields: string[] = [];
  const values: (string | number | null)[] = [];

  if (updates.redlineNote !== undefined) {
    fields.push('redline_note = ?');
    values.push(updates.redlineNote || null);
  }
  if (updates.status) {
    fields.push('status = ?');
    values.push(updates.status);
  }
  if (updates.hasConstructionDetour !== undefined) {
    fields.push('has_construction_detour = ?');
    values.push(updates.hasConstructionDetour ? 1 : 0);
  }

  if (fields.length === 0) {
    return getBreakpoint(id) as unknown as Breakpoint;
  }

  fields.push('updated_at = ?');
  values.push(now);
  values.push(id);

  const query = `UPDATE breakpoints SET ${fields.join(', ')} WHERE id = ?`;
  db.prepare(query).run(...values);

  if (updates.redlineNote !== undefined) {
    recordChange(
      id,
      'redline_note',
      existing.redline_note,
      updates.redlineNote || null,
      updatedBy,
      'update',
      {
        before: { redlineNote: existing.redline_note },
        after: { redlineNote: updates.redlineNote || null },
      }
    );
  }

  if (updates.status) {
    recordChange(
      id,
      'status',
      existing.status,
      updates.status,
      updatedBy,
      'status_change',
      {
        before: { status: existing.status },
        after: { status: updates.status },
      }
    );
  }

  if (updates.hasConstructionDetour !== undefined) {
    recordChange(
      id,
      'has_construction_detour',
      String(existing.has_construction_detour),
      String(updates.hasConstructionDetour ? 1 : 0),
      updatedBy,
      'update',
      {
        before: { hasConstructionDetour: existing.has_construction_detour === 1 },
        after: { hasConstructionDetour: updates.hasConstructionDetour },
      }
    );

    if (updates.hasConstructionDetour && existing.status !== 'pending_review') {
      db.prepare(
        'UPDATE breakpoints SET status = ?, updated_at = ? WHERE id = ?'
      ).run('pending_review', now, id);
      recordChange(
        id,
        'status',
        existing.status,
        'pending_review',
        '边界规则引擎-自动流转',
        'status_change',
        {
          rule: 'rule-001: 施工临时改道未同步地图',
          before: { status: existing.status },
          after: { status: 'pending_review' },
        }
      );
    }
  }

  return getBreakpoint(id) as unknown as Breakpoint;
};

export const markConstructionDetour = (
  id: string,
  markedBy: string
): Breakpoint => {
  return updateBreakpoint(
    id,
    { hasConstructionDetour: true, status: 'pending_review' },
    markedBy
  );
};

export const confirmByResident = (
  id: string,
  confirmedBy: string
): Breakpoint => {
  return updateBreakpoint(id, { status: 'confirmed' }, confirmedBy);
};
