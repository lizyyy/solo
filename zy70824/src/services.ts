import db from './database';
import { SampleRecord, OperationLog, Influencer, Sample, Batch } from './types';
import { generateId, isOverdue } from './utils';

export async function createBatch(batchData: Omit<Batch, 'id' | 'createdAt' | 'updatedAt'>): Promise<Batch> {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(`
      INSERT INTO batches (batchId, brand, sendDate, expectedReturnDate, status, handler, remark)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      batchData.batchId,
      batchData.brand,
      batchData.sendDate,
      batchData.expectedReturnDate,
      batchData.status || 'pending',
      batchData.handler,
      batchData.remark,
      function(this: any, err: Error | null) {
        if (err) reject(err);
        else resolve({ ...batchData, id: this.lastID } as Batch);
      }
    );
    stmt.finalize();
  });
}

export async function createSampleRecord(recordData: Omit<SampleRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<SampleRecord> {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(`
      INSERT INTO sample_records (
        recordId, batchId, sampleId, sampleName, influencerId, influencerName,
        sendDate, expectedReturnDate, actualReturnDate, status, deposit,
        deductionAmount, deductionReason, photos, handler, remark
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      recordData.recordId,
      recordData.batchId,
      recordData.sampleId,
      recordData.sampleName,
      recordData.influencerId,
      recordData.influencerName,
      recordData.sendDate,
      recordData.expectedReturnDate,
      recordData.actualReturnDate,
      recordData.status || 'pending',
      recordData.deposit,
      recordData.deductionAmount,
      recordData.deductionReason,
      recordData.photos,
      recordData.handler,
      recordData.remark,
      function(this: any, err: Error | null) {
        if (err) reject(err);
        else resolve({ ...recordData, id: this.lastID } as SampleRecord);
      }
    );
    stmt.finalize();
  });
}

export async function addOperationLog(logData: Omit<OperationLog, 'id' | 'createdAt'>): Promise<OperationLog> {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(`
      INSERT INTO operation_logs (recordId, operation, operator, reason, remark)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(
      logData.recordId,
      logData.operation,
      logData.operator,
      logData.reason,
      logData.remark,
      function(this: any, err: Error | null) {
        if (err) reject(err);
        else resolve({ ...logData, id: this.lastID } as OperationLog);
      }
    );
    stmt.finalize();
  });
}

export async function getSampleRecord(recordId: string): Promise<SampleRecord | null> {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM sample_records WHERE recordId = ?', [recordId], (err: Error | null, row: any) => {
      if (err) reject(err);
      else resolve(row as SampleRecord || null);
    });
  });
}

export async function updateSampleRecord(recordId: string, updates: Partial<SampleRecord>, operator: string, operation: OperationLog['operation'], reason?: string): Promise<void> {
  const setClauses = Object.keys(updates).map(key => `${key} = ?`).join(', ');
  const values = [...Object.values(updates), recordId];

  return new Promise((resolve, reject) => {
    db.run(`UPDATE sample_records SET ${setClauses}, updatedAt = CURRENT_TIMESTAMP WHERE recordId = ?`, values, async (err: Error | null) => {
      if (err) reject(err);
      else {
        await addOperationLog({ recordId, operation, operator, reason });
        resolve();
      }
    });
  });
}

export async function getRecordsByQuery(params: {
  brand?: string;
  batchId?: string;
  influencerId?: string;
  status?: string;
  hasDeduction?: boolean;
}): Promise<SampleRecord[]> {
  let query = 'SELECT sr.* FROM sample_records sr';
  const values: any[] = [];
  const conditions: string[] = [];

  if (params.brand) {
    query += ' JOIN batches b ON sr.batchId = b.batchId';
    conditions.push('b.brand = ?');
    values.push(params.brand);
  }

  if (params.batchId) {
    conditions.push('sr.batchId = ?');
    values.push(params.batchId);
  }
  if (params.influencerId) {
    conditions.push('sr.influencerId = ?');
    values.push(params.influencerId);
  }
  if (params.status) {
    conditions.push('sr.status = ?');
    values.push(params.status);
  }
  if (params.hasDeduction) {
    conditions.push('sr.deductionAmount > 0');
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  return new Promise((resolve, reject) => {
    db.all(query, values, (err: Error | null, rows: any[]) => {
      if (err) reject(err);
      else resolve(rows as SampleRecord[]);
    });
  });
}

export async function getOperationLogs(recordId: string): Promise<OperationLog[]> {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM operation_logs WHERE recordId = ? ORDER BY createdAt DESC', [recordId], (err: Error | null, rows: any[]) => {
      if (err) reject(err);
      else resolve(rows as OperationLog[]);
    });
  });
}

export async function importInfluencers(influencers: Omit<Influencer, 'id' | 'createdAt'>[]): Promise<void> {
  for (const influencer of influencers) {
    await new Promise<void>((resolve, reject) => {
      db.run(`
        INSERT OR REPLACE INTO influencers (influencerId, name, platform, followers, category, contact)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [influencer.influencerId, influencer.name, influencer.platform, influencer.followers, influencer.category, influencer.contact], (err: Error | null) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}

export async function checkDuplicateSample(sampleId: string, influencerId: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    db.get(`
      SELECT COUNT(*) as count FROM sample_records
      WHERE sampleId = ? AND influencerId = ? AND status != 'returned'
    `, [sampleId, influencerId], (err: Error | null, row: any) => {
      if (err) reject(err);
      else resolve(row.count > 0);
    });
  });
}

export async function getInfluencer(influencerId: string): Promise<Influencer | null> {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM influencers WHERE influencerId = ?', [influencerId], (err: Error | null, row: any) => {
      if (err) reject(err);
      else resolve(row as Influencer || null);
    });
  });
}

export async function getBatch(batchId: string): Promise<Batch | null> {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM batches WHERE batchId = ?', [batchId], (err: Error | null, row: any) => {
      if (err) reject(err);
      else resolve(row as Batch || null);
    });
  });
}

export async function getAllBatches(): Promise<Batch[]> {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM batches ORDER BY createdAt DESC', (err: Error | null, rows: any[]) => {
      if (err) reject(err);
      else resolve(rows as Batch[]);
    });
  });
}

export async function updateOverdueRecords(): Promise<void> {
  const records = await new Promise<SampleRecord[]>((resolve, reject) => {
    db.all(`
      SELECT * FROM sample_records
      WHERE status IN ('pending', 'sent', 'received') AND actualReturnDate IS NULL
    `, (err: Error | null, rows: any[]) => {
      if (err) reject(err);
      else resolve(rows as SampleRecord[]);
    });
  });

  for (const record of records) {
    if (isOverdue(record.expectedReturnDate) && record.status !== 'overdue') {
      await updateSampleRecord(
        record.recordId,
        { status: 'overdue' },
        'system',
        'processed',
        '系统自动标记为超期未还'
      );
    }
  }
}
