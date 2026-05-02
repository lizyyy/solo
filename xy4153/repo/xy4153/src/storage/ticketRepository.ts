import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from './database';
import { Ticket, TicketStatus, SampleType, User, UserRole } from '../types';

function mapRowToTicket(row: any): Ticket {
  return {
    id: row.id,
    storeId: row.store_id,
    poolId: row.pool_id,
    sampleRecordId: row.sample_record_id,
    sampleType: row.sample_type as SampleType,
    exceededValue: row.exceeded_value,
    thresholdMin: row.threshold_min,
    thresholdMax: row.threshold_max,
    status: row.status as TicketStatus,
    assignedTo: row.assigned_to,
    rectificationDescription: row.rectification_description,
    rectificationEvidenceUrls: row.rectification_evidence_urls ? JSON.parse(row.rectification_evidence_urls) : undefined,
    rectificationTime: row.rectification_time,
    retestSampleRecordId: row.retest_sample_record_id,
    retestValue: row.retest_value,
    retestTime: row.retest_time,
    retestPassed: row.retest_passed !== null ? Boolean(row.retest_passed) : undefined,
    reopenRequestReason: row.reopen_request_reason,
    reopenRequestTime: row.reopen_request_time,
    reopenedBy: row.reopened_by,
    closeReason: row.close_reason,
    closedTime: row.closed_time,
    closedBy: row.closed_by,
    archivedTime: row.archived_time,
    archivedBy: row.archived_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function createTicket(
  storeId: string,
  poolId: string,
  sampleRecordId: string,
  sampleType: SampleType,
  exceededValue: number,
  thresholdMin: number,
  thresholdMax: number,
  createdBy: User
): Ticket {
  const db = getDatabase();
  const now = new Date().toISOString();
  const id = uuidv4();
  const status = TicketStatus.CREATED;

  const insert = db.prepare(`
    INSERT INTO tickets (
      id, store_id, pool_id, sample_record_id, sample_type,
      exceeded_value, threshold_min, threshold_max, status,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insert.run(
    id, storeId, poolId, sampleRecordId, sampleType,
    exceededValue, thresholdMin, thresholdMax, status,
    now, now
  );

  return {
    id,
    storeId,
    poolId,
    sampleRecordId,
    sampleType,
    exceededValue,
    thresholdMin,
    thresholdMax,
    status,
    createdAt: now,
    updatedAt: now
  };
}

export function updateTicket(
  id: string,
  updates: Partial<{
    status: TicketStatus;
    assignedTo: string;
    rectificationDescription: string;
    rectificationEvidenceUrls: string[];
    rectificationTime: string;
    retestSampleRecordId: string;
    retestValue: number;
    retestTime: string;
    retestPassed: boolean;
    reopenRequestReason: string;
    reopenRequestTime: string;
    reopenedBy: string;
    closeReason: string;
    closedTime: string;
    closedBy: string;
    archivedTime: string;
    archivedBy: string;
  }>,
  updatedBy: User
): Ticket | null {
  const db = getDatabase();
  const existing = getTicketById(id);
  
  if (!existing) return null;

  const now = new Date().toISOString();
  const fields: string[] = [];
  const values: any[] = [];

  if (updates.status !== undefined) {
    fields.push('status = ?');
    values.push(updates.status);
  }
  if (updates.assignedTo !== undefined) {
    fields.push('assigned_to = ?');
    values.push(updates.assignedTo);
  }
  if (updates.rectificationDescription !== undefined) {
    fields.push('rectification_description = ?');
    values.push(updates.rectificationDescription);
  }
  if (updates.rectificationEvidenceUrls !== undefined) {
    fields.push('rectification_evidence_urls = ?');
    values.push(JSON.stringify(updates.rectificationEvidenceUrls));
  }
  if (updates.rectificationTime !== undefined) {
    fields.push('rectification_time = ?');
    values.push(updates.rectificationTime);
  }
  if (updates.retestSampleRecordId !== undefined) {
    fields.push('retest_sample_record_id = ?');
    values.push(updates.retestSampleRecordId);
  }
  if (updates.retestValue !== undefined) {
    fields.push('retest_value = ?');
    values.push(updates.retestValue);
  }
  if (updates.retestTime !== undefined) {
    fields.push('retest_time = ?');
    values.push(updates.retestTime);
  }
  if (updates.retestPassed !== undefined) {
    fields.push('retest_passed = ?');
    values.push(updates.retestPassed ? 1 : 0);
  }
  if (updates.reopenRequestReason !== undefined) {
    fields.push('reopen_request_reason = ?');
    values.push(updates.reopenRequestReason);
  }
  if (updates.reopenRequestTime !== undefined) {
    fields.push('reopen_request_time = ?');
    values.push(updates.reopenRequestTime);
  }
  if (updates.reopenedBy !== undefined) {
    fields.push('reopened_by = ?');
    values.push(updates.reopenedBy);
  }
  if (updates.closeReason !== undefined) {
    fields.push('close_reason = ?');
    values.push(updates.closeReason);
  }
  if (updates.closedTime !== undefined) {
    fields.push('closed_time = ?');
    values.push(updates.closedTime);
  }
  if (updates.closedBy !== undefined) {
    fields.push('closed_by = ?');
    values.push(updates.closedBy);
  }
  if (updates.archivedTime !== undefined) {
    fields.push('archived_time = ?');
    values.push(updates.archivedTime);
  }
  if (updates.archivedBy !== undefined) {
    fields.push('archived_by = ?');
    values.push(updates.archivedBy);
  }

  if (fields.length === 0) return existing;

  fields.push('updated_at = ?');
  values.push(now);
  values.push(id);

  const update = db.prepare(`
    UPDATE tickets SET ${fields.join(', ')} WHERE id = ?
  `);

  update.run(...values);

  return getTicketById(id);
}

export function getTicketById(id: string): Ticket | null {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM tickets WHERE id = ?').get(id);
  
  if (!row) return null;
  return mapRowToTicket(row);
}

export function getTicketsByPool(
  poolId: string,
  status?: TicketStatus
): Ticket[] {
  const db = getDatabase();
  let query = 'SELECT * FROM tickets WHERE pool_id = ?';
  const params: any[] = [poolId];

  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }

  query += ' ORDER BY created_at DESC';

  const rows = db.prepare(query).all(...params);
  return rows.map(mapRowToTicket);
}

export function getTicketsByStore(
  storeId: string,
  status?: TicketStatus
): Ticket[] {
  const db = getDatabase();
  let query = 'SELECT * FROM tickets WHERE store_id = ?';
  const params: any[] = [storeId];

  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }

  query += ' ORDER BY created_at DESC';

  const rows = db.prepare(query).all(...params);
  return rows.map(mapRowToTicket);
}

export function getOpenTicketsByPool(poolId: string): Ticket[] {
  const db = getDatabase();
  const openStatuses = [
    TicketStatus.CREATED,
    TicketStatus.ASSIGNED,
    TicketStatus.IN_PROGRESS,
    TicketStatus.RETEST_REQUESTED,
    TicketStatus.RETEST_FAILED,
    TicketStatus.REOPEN_REQUESTED
  ];

  const placeholders = openStatuses.map(() => '?').join(',');
  const rows = db.prepare(`
    SELECT * FROM tickets 
    WHERE pool_id = ? AND status IN (${placeholders})
    ORDER BY created_at DESC
  `).all(poolId, ...openStatuses);

  return rows.map(mapRowToTicket);
}

export function getTicketsByUser(
  user: User,
  status?: TicketStatus
): Ticket[] {
  const db = getDatabase();
  
  if (user.role === UserRole.ADMIN || user.role === UserRole.SUPERVISOR) {
    let query = `
      SELECT t.* FROM tickets t
      JOIN stores s ON t.store_id = s.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (status) {
      query += ' AND t.status = ?';
      params.push(status);
    }

    query += ' ORDER BY t.created_at DESC';

    const rows = db.prepare(query).all(...params);
    return rows.map(mapRowToTicket);
  }
  
  if (user.storeId) {
    return getTicketsByStore(user.storeId, status);
  }
  
  return [];
}

export function getAllTickets(status?: TicketStatus): Ticket[] {
  const db = getDatabase();
  let query = 'SELECT * FROM tickets';
  const params: any[] = [];

  if (status) {
    query += ' WHERE status = ?';
    params.push(status);
  }

  query += ' ORDER BY created_at DESC';

  const rows = db.prepare(query).all(...params);
  return rows.map(mapRowToTicket);
}

export function deleteTicket(id: string, deletedBy: User): boolean {
  const db = getDatabase();
  const result = db.prepare('DELETE FROM tickets WHERE id = ?').run(id);
  return result.changes > 0;
}
