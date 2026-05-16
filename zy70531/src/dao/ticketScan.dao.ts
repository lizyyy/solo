import { getDatabase } from '../database';
import { TicketScanRecord, ScanStatus, RiskLevel, IsolationAction, ScanEngine, FailureRecord } from '../types';
import { v4 as uuidv4 } from 'uuid';

function deserializeRecord(row: any): TicketScanRecord {
  return {
    id: row.id,
    ticketId: row.ticket_id,
    attachments: JSON.parse(row.attachments),
    scanEngine: row.scan_engine as ScanEngine,
    riskLevel: row.risk_level as RiskLevel,
    isolationAction: row.isolation_action as IsolationAction,
    status: row.status as ScanStatus,
    processingSummary: row.processing_summary,
    scanReport: row.scan_report,
    virusFound: row.virus_found ? JSON.parse(row.virus_found) : undefined,
    failureRecords: row.failure_records ? JSON.parse(row.failure_records) : undefined,
    reviewedBy: row.reviewed_by,
    reviewComment: row.review_comment,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    scannedAt: row.scanned_at ? new Date(row.scanned_at) : undefined,
    reviewedAt: row.reviewed_at ? new Date(row.reviewed_at) : undefined
  };
}

export async function createTicketScanRecord(
  ticketId: string,
  attachments: any[],
  scanEngine: ScanEngine
): Promise<TicketScanRecord> {
  const db = getDatabase();
  const now = new Date().toISOString();
  const id = uuidv4();

  const attachmentsWithIds = attachments.map(att => ({
    ...att,
    id: uuidv4()
  }));

  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO ticket_scan_records (
        id, ticket_id, attachments, scan_engine, risk_level, 
        isolation_action, status, processing_summary, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        ticketId,
        JSON.stringify(attachmentsWithIds),
        scanEngine,
        RiskLevel.SAFE,
        IsolationAction.NONE,
        ScanStatus.PENDING,
        '工单附件已提交，等待扫描排队',
        now,
        now
      ],
      function(err) {
        if (err) {
          reject(err);
          return;
        }
        resolve({
          id,
          ticketId,
          attachments: attachmentsWithIds,
          scanEngine,
          riskLevel: RiskLevel.SAFE,
          isolationAction: IsolationAction.NONE,
          status: ScanStatus.PENDING,
          processingSummary: '工单附件已提交，等待扫描排队',
          createdAt: new Date(now),
          updatedAt: new Date(now)
        });
      }
    );
  });
}

export async function getTicketScanRecordById(id: string): Promise<TicketScanRecord | null> {
  const db = getDatabase();
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM ticket_scan_records WHERE id = ?', [id], (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      if (!row) {
        resolve(null);
        return;
      }
      resolve(deserializeRecord(row));
    });
  });
}

export async function getTicketScanRecordsByTicketId(ticketId: string): Promise<TicketScanRecord[]> {
  const db = getDatabase();
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM ticket_scan_records WHERE ticket_id = ? ORDER BY created_at DESC', [ticketId], (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows.map(deserializeRecord));
    });
  });
}

export async function getTicketScanRecordsByStatus(status: ScanStatus): Promise<TicketScanRecord[]> {
  const db = getDatabase();
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM ticket_scan_records WHERE status = ? ORDER BY created_at DESC', [status], (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows.map(deserializeRecord));
    });
  });
}

export async function getAllTicketScanRecords(page: number = 1, pageSize: number = 20): Promise<{ records: TicketScanRecord[], total: number }> {
  const db = getDatabase();
  const offset = (page - 1) * pageSize;

  const recordsPromise = new Promise<TicketScanRecord[]>((resolve, reject) => {
    db.all(
      'SELECT * FROM ticket_scan_records ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [pageSize, offset],
      (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(rows.map(deserializeRecord));
      }
    );
  });

  const totalPromise = new Promise<number>((resolve, reject) => {
    db.get('SELECT COUNT(*) as count FROM ticket_scan_records', (err, row: any) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(row.count);
    });
  });

  const [records, total] = await Promise.all([recordsPromise, totalPromise]);
  return { records, total };
}

export async function updateTicketScanStatus(
  id: string,
  status: ScanStatus,
  updates: {
    scanReport?: string;
    virusFound?: string[];
    riskLevel?: RiskLevel;
    isolationAction?: IsolationAction;
    processingSummary?: string;
  }
): Promise<TicketScanRecord | null> {
  const db = getDatabase();
  const now = new Date().toISOString();
  const scannedAt = status === ScanStatus.SUCCESS || status === ScanStatus.FAILED ? now : undefined;

  const setClauses: string[] = ['status = ?', 'updated_at = ?'];
  const params: any[] = [status, now];

  if (updates.scanReport !== undefined) {
    setClauses.push('scan_report = ?');
    params.push(updates.scanReport);
  }
  if (updates.virusFound !== undefined) {
    setClauses.push('virus_found = ?');
    params.push(JSON.stringify(updates.virusFound));
  }
  if (updates.riskLevel !== undefined) {
    setClauses.push('risk_level = ?');
    params.push(updates.riskLevel);
  }
  if (updates.isolationAction !== undefined) {
    setClauses.push('isolation_action = ?');
    params.push(updates.isolationAction);
  }
  if (updates.processingSummary !== undefined) {
    setClauses.push('processing_summary = ?');
    params.push(updates.processingSummary);
  }
  if (scannedAt) {
    setClauses.push('scanned_at = ?');
    params.push(scannedAt);
  }

  params.push(id);

  return new Promise((resolve, reject) => {
    db.run(
      `UPDATE ticket_scan_records SET ${setClauses.join(', ')} WHERE id = ?`,
      params,
      async function(err) {
        if (err) {
          reject(err);
          return;
        }
        if (this.changes === 0) {
          resolve(null);
          return;
        }
        const updatedRecord = await getTicketScanRecordById(id);
        resolve(updatedRecord);
      }
    );
  });
}

export async function addFailureRecord(
  id: string,
  failureRecord: FailureRecord
): Promise<TicketScanRecord | null> {
  const db = getDatabase();
  const existingRecord = await getTicketScanRecordById(id);
  
  if (!existingRecord) {
    return null;
  }

  const failureRecords = existingRecord.failureRecords || [];
  failureRecords.push(failureRecord);

  return new Promise((resolve, reject) => {
    db.run(
      'UPDATE ticket_scan_records SET failure_records = ?, updated_at = ? WHERE id = ?',
      [JSON.stringify(failureRecords), new Date().toISOString(), id],
      async function(err) {
        if (err) {
          reject(err);
          return;
        }
        const updatedRecord = await getTicketScanRecordById(id);
        resolve(updatedRecord);
      }
    );
  });
}

export async function manualCorrectRecord(
  id: string,
  reviewedBy: string,
  reviewComment: string,
  updates: {
    status: ScanStatus;
    riskLevel?: RiskLevel;
    isolationAction?: IsolationAction;
    processingSummary?: string;
  }
): Promise<TicketScanRecord | null> {
  const db = getDatabase();
  const now = new Date().toISOString();

  const setClauses: string[] = [
    'status = ?',
    'reviewed_by = ?',
    'review_comment = ?',
    'reviewed_at = ?',
    'updated_at = ?'
  ];
  const params: any[] = [updates.status, reviewedBy, reviewComment, now, now];

  if (updates.riskLevel !== undefined) {
    setClauses.push('risk_level = ?');
    params.push(updates.riskLevel);
  }
  if (updates.isolationAction !== undefined) {
    setClauses.push('isolation_action = ?');
    params.push(updates.isolationAction);
  }
  if (updates.processingSummary !== undefined) {
    setClauses.push('processing_summary = ?');
    params.push(updates.processingSummary);
  }

  params.push(id);

  return new Promise((resolve, reject) => {
    db.run(
      `UPDATE ticket_scan_records SET ${setClauses.join(', ')} WHERE id = ?`,
      params,
      async function(err) {
        if (err) {
          reject(err);
          return;
        }
        if (this.changes === 0) {
          resolve(null);
          return;
        }
        const updatedRecord = await getTicketScanRecordById(id);
        resolve(updatedRecord);
      }
    );
  });
}
