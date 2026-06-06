import fs from 'fs';
import { parse } from 'csv-parse/sync';
import { getDb, saveDb, getNextTicketId } from '../db/database';
import { TicketRecord, TicketBatch, ImportResult, TicketType } from '../types';

interface CsvRow {
  batch_id: string;
  ticket_no: string;
  ticket_type: string;
  attendee_name: string;
  price: string;
  purchase_date: string;
  audio_file_id?: string;
  audio_remark?: string;
}

export function importTicketsFromCsv(filePath: string): ImportResult {
  const result: ImportResult = {
    success: false,
    totalRecords: 0,
    batchesCreated: [],
    mixedBatches: [],
    errors: []
  };

  try {
    if (!fs.existsSync(filePath)) {
      result.errors.push(`文件不存在: ${filePath}`);
      return result;
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const records = parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    }) as CsvRow[];

    if (records.length === 0) {
      result.errors.push('CSV文件为空');
      return result;
    }

    result.totalRecords = records.length;
    const db = getDb();
    const now = new Date().toISOString();

    const batchMap = new Map<string, { paid: number; complimentary: number; tickets: CsvRow[] }>();

    for (const row of records) {
      if (!row.batch_id || !row.ticket_no || !row.ticket_type) {
        result.errors.push(`行数据不完整: ${JSON.stringify(row)}`);
        continue;
      }

      if (!batchMap.has(row.batch_id)) {
        batchMap.set(row.batch_id, { paid: 0, complimentary: 0, tickets: [] });
      }

      const batchData = batchMap.get(row.batch_id)!;
      batchData.tickets.push(row);

      if (row.ticket_type.toLowerCase() === 'paid' || row.ticket_type === '售票') {
        batchData.paid++;
      } else if (row.ticket_type.toLowerCase() === 'complimentary' || row.ticket_type === '赠票') {
        batchData.complimentary++;
      }
    }

    for (const [batchId, batchData] of batchMap) {
      const hasMixed = batchData.paid > 0 && batchData.complimentary > 0;
      const total = batchData.paid + batchData.complimentary;

      const existingBatchIdx = db.ticketBatches.findIndex(b => b.batchId === batchId);
      const batch: TicketBatch = {
        id: existingBatchIdx >= 0 ? db.ticketBatches[existingBatchIdx].id : undefined,
        batchId,
        totalCount: total,
        paidCount: batchData.paid,
        complimentaryCount: batchData.complimentary,
        hasMixedTypes: hasMixed,
        importDate: now,
        reviewStatus: 'new'
      };

      if (existingBatchIdx >= 0) {
        db.ticketBatches[existingBatchIdx] = { ...db.ticketBatches[existingBatchIdx], ...batch };
      } else {
        db.ticketBatches.push(batch);
      }

      result.batchesCreated.push(batchId);
      if (hasMixed) {
        result.mixedBatches.push(batchId);
      }

      for (const row of batchData.tickets) {
        const ticketType: TicketType = 
          (row.ticket_type.toLowerCase() === 'paid' || row.ticket_type === '售票') 
            ? 'paid' : 'complimentary';

        const existingTicketIdx = db.tickets.findIndex(t => t.ticketNo === row.ticket_no);
        const ticketId = existingTicketIdx >= 0 ? db.tickets[existingTicketIdx].id : getNextTicketId();

        const ticket: TicketRecord = {
          id: ticketId,
          batchId,
          ticketNo: row.ticket_no,
          ticketType,
          attendeeName: row.attendee_name || '',
          price: parseFloat(row.price) || 0,
          purchaseDate: row.purchase_date || now,
          audioFileId: row.audio_file_id || undefined,
          audioRemark: row.audio_remark || undefined,
          authStatus: 'pending',
          createdAt: existingTicketIdx >= 0 ? db.tickets[existingTicketIdx].createdAt : now,
          updatedAt: now
        };

        if (existingTicketIdx >= 0) {
          db.tickets[existingTicketIdx] = { ...db.tickets[existingTicketIdx], ...ticket };
        } else {
          db.tickets.push(ticket);
        }
      }
    }

    saveDb();
    result.success = true;

  } catch (error) {
    result.errors.push(`导入失败: ${error instanceof Error ? error.message : String(error)}`);
  }

  return result;
}

export function getBatchById(batchId: string): TicketBatch | null {
  const db = getDb();
  const batch = db.ticketBatches.find(b => b.batchId === batchId);
  return batch || null;
}

export function getTicketsByBatch(batchId: string): TicketRecord[] {
  const db = getDb();
  return db.tickets
    .filter(t => t.batchId === batchId)
    .sort((a, b) => a.ticketNo.localeCompare(b.ticketNo));
}

export function getAllBatches(): TicketBatch[] {
  const db = getDb();
  return [...db.ticketBatches].sort((a, b) => 
    new Date(b.importDate).getTime() - new Date(a.importDate).getTime()
  );
}

export function getTicketById(ticketId: number): TicketRecord | null {
  const db = getDb();
  const ticket = db.tickets.find(t => t.id === ticketId);
  return ticket || null;
}
