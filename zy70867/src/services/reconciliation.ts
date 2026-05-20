import { v4 as uuidv4 } from 'uuid';
import { runQuery, getOne, getAll } from '../database';
import {
  ReconciliationSubmitRequest,
  ReconciliationRecord,
  ReconciliationResult,
  ProcessingStatus,
  StatisticsResult,
  RoomType,
  LinenType,
  ExportRecord
} from '../types';
import { validateRequest, ErrorCode } from './validator';

interface DbRecord {
  id: string;
  batch_id: string;
  hotel_id: string;
  hotel_name: string;
  submit_date: string;
  wash_date: string;
  return_date: string;
  handler: string;
  room_standards: string;
  billing_items: string;
  processing_status: string;
  status_reason: string;
  error_details: string;
  created_at: string;
  updated_at: string;
}

export async function submitReconciliation(
  data: ReconciliationSubmitRequest
): Promise<ReconciliationResult> {
  const existingRecord = await findByBatchId(data.batchId);
  
  if (existingRecord) {
    return {
      success: true,
      batchId: data.batchId,
      processingStatus: existingRecord.processing_status as ProcessingStatus,
      statusReason: existingRecord.status_reason,
      recordId: existingRecord.id,
      errorDetails: JSON.parse(existingRecord.error_details),
      isDuplicate: true
    };
  }

  const validation = validateRequest(data);

  const recordId = uuidv4();
  const now = new Date().toISOString();

  const record: ReconciliationRecord = {
    id: recordId,
    batchId: data.batchId,
    hotelId: data.hotelId,
    hotelName: data.hotelName,
    submitDate: data.submitDate,
    washDate: data.washDate,
    returnDate: data.returnDate,
    handler: data.handler,
    roomStandards: data.roomStandards,
    billingItems: data.billingItems,
    processingStatus: validation.processingStatus,
    statusReason: validation.statusReason,
    errorDetails: validation.errors,
    createdAt: now,
    updatedAt: now
  };

  await saveRecord(record);

  return {
    success: validation.processingStatus === ProcessingStatus.NORMAL,
    batchId: data.batchId,
    processingStatus: validation.processingStatus,
    statusReason: validation.statusReason,
    recordId,
    errorDetails: validation.errors.length > 0 ? validation.errors : undefined,
    isDuplicate: false
  };
}

export async function findByBatchId(batchId: string): Promise<DbRecord | null> {
  const sql = `SELECT * FROM reconciliation_records WHERE batch_id = ?`;
  return await getOne<DbRecord>(sql, [batchId]);
}

export async function findById(id: string): Promise<ReconciliationRecord | null> {
  const sql = `SELECT * FROM reconciliation_records WHERE id = ?`;
  const record = await getOne<DbRecord>(sql, [id]);
  
  if (!record) return null;
  
  return mapDbToRecord(record);
}

export async function findAll(params?: {
  hotelId?: string;
  status?: ProcessingStatus;
  startDate?: string;
  endDate?: string;
}): Promise<ReconciliationRecord[]> {
  let sql = `SELECT * FROM reconciliation_records WHERE 1=1`;
  const queryParams: any[] = [];

  if (params?.hotelId) {
    sql += ` AND hotel_id = ?`;
    queryParams.push(params.hotelId);
  }

  if (params?.status) {
    sql += ` AND processing_status = ?`;
    queryParams.push(params.status);
  }

  if (params?.startDate) {
    sql += ` AND submit_date >= ?`;
    queryParams.push(params.startDate);
  }

  if (params?.endDate) {
    sql += ` AND submit_date <= ?`;
    queryParams.push(params.endDate);
  }

  sql += ` ORDER BY created_at DESC`;

  const records = await getAll<DbRecord>(sql, queryParams);
  return records.map(mapDbToRecord);
}

export async function calculateStatistics(recordId: string): Promise<StatisticsResult | null> {
  const record = await findById(recordId);
  if (!record) return null;

  let totalSendQuantity = 0;
  let totalReturnQuantity = 0;
  let totalDamagedQuantity = 0;
  let totalDamageCompensation = 0;
  let totalBilledQuantity = 0;
  let totalBilledAmount = 0;

  const byRoomTypeMap = new Map<RoomType, {
    sendQuantity: number;
    returnQuantity: number;
    damagedQuantity: number;
    damageCompensation: number;
  }>();

  const byLinenTypeMap = new Map<LinenType, {
    sendQuantity: number;
    returnQuantity: number;
    damagedQuantity: number;
    damageCompensation: number;
    billedQuantity: number;
    billedAmount: number;
  }>();

  record.roomStandards.forEach(roomStandard => {
    if (!byRoomTypeMap.has(roomStandard.roomType)) {
      byRoomTypeMap.set(roomStandard.roomType, {
        sendQuantity: 0,
        returnQuantity: 0,
        damagedQuantity: 0,
        damageCompensation: 0
      });
    }

    const roomStats = byRoomTypeMap.get(roomStandard.roomType)!;

    roomStandard.linenItems.forEach(item => {
      roomStats.sendQuantity += item.sendQuantity;
      roomStats.returnQuantity += item.returnQuantity;
      roomStats.damagedQuantity += item.damagedQuantity;
      roomStats.damageCompensation += item.damageCompensation;

      totalSendQuantity += item.sendQuantity;
      totalReturnQuantity += item.returnQuantity;
      totalDamagedQuantity += item.damagedQuantity;
      totalDamageCompensation += item.damageCompensation;

      if (!byLinenTypeMap.has(item.linenType)) {
        byLinenTypeMap.set(item.linenType, {
          sendQuantity: 0,
          returnQuantity: 0,
          damagedQuantity: 0,
          damageCompensation: 0,
          billedQuantity: 0,
          billedAmount: 0
        });
      }

      const linenStats = byLinenTypeMap.get(item.linenType)!;
      linenStats.sendQuantity += item.sendQuantity;
      linenStats.returnQuantity += item.returnQuantity;
      linenStats.damagedQuantity += item.damagedQuantity;
      linenStats.damageCompensation += item.damageCompensation;
    });
  });

  record.billingItems.forEach(item => {
    totalBilledQuantity += item.billedQuantity;
    totalBilledAmount += item.billedAmount;

    if (!byLinenTypeMap.has(item.linenType)) {
      byLinenTypeMap.set(item.linenType, {
        sendQuantity: 0,
        returnQuantity: 0,
        damagedQuantity: 0,
        damageCompensation: 0,
        billedQuantity: 0,
        billedAmount: 0
      });
    }

    const linenStats = byLinenTypeMap.get(item.linenType)!;
    linenStats.billedQuantity += item.billedQuantity;
    linenStats.billedAmount += item.billedAmount;
  });

  return {
    totalSendQuantity,
    totalReturnQuantity,
    totalDamagedQuantity,
    totalDamageCompensation,
    totalBilledQuantity,
    totalBilledAmount,
    quantityDiscrepancy: totalReturnQuantity + totalDamagedQuantity - totalSendQuantity,
    amountDiscrepancy: totalDamageCompensation - totalBilledAmount,
    byRoomType: Array.from(byRoomTypeMap.entries()).map(([roomType, stats]) => ({
      roomType,
      ...stats
    })),
    byLinenType: Array.from(byLinenTypeMap.entries()).map(([linenType, stats]) => ({
      linenType,
      ...stats,
      discrepancy: stats.returnQuantity + stats.damagedQuantity - stats.sendQuantity
    }))
  };
}

export async function generateExportData(recordId: string): Promise<ExportRecord[] | null> {
  const record = await findById(recordId);
  if (!record) return null;

  const statistics = await calculateStatistics(recordId);
  if (!statistics) return null;

  const exportRecords: ExportRecord[] = [];

  record.roomStandards.forEach(roomStandard => {
    roomStandard.linenItems.forEach(item => {
      const billingItem = record.billingItems.find(b => b.linenType === item.linenType);
      const linenStats = statistics.byLinenType.find(l => l.linenType === item.linenType);

      exportRecords.push({
        batchId: record.batchId,
        hotelName: record.hotelName,
        submitDate: record.submitDate,
        handler: record.handler,
        linenType: item.linenType,
        roomType: roomStandard.roomType,
        sendQuantity: item.sendQuantity,
        returnQuantity: item.returnQuantity,
        damagedQuantity: item.damagedQuantity,
        damageCompensation: item.damageCompensation,
        billedQuantity: billingItem?.billedQuantity || 0,
        billedAmount: billingItem?.billedAmount || 0,
        discrepancy: linenStats?.discrepancy || 0,
        processingStatus: record.processingStatus,
        statusReason: record.statusReason
      });
    });
  });

  return exportRecords;
}

async function saveRecord(record: ReconciliationRecord): Promise<void> {
  const sql = `
    INSERT INTO reconciliation_records (
      id, batch_id, hotel_id, hotel_name, submit_date, wash_date, return_date,
      handler, room_standards, billing_items, processing_status, status_reason,
      error_details, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  await runQuery(sql, [
    record.id,
    record.batchId,
    record.hotelId,
    record.hotelName,
    record.submitDate,
    record.washDate,
    record.returnDate,
    record.handler,
    JSON.stringify(record.roomStandards),
    JSON.stringify(record.billingItems),
    record.processingStatus,
    record.statusReason,
    JSON.stringify(record.errorDetails),
    record.createdAt,
    record.updatedAt
  ]);
}

function mapDbToRecord(dbRecord: DbRecord): ReconciliationRecord {
  return {
    id: dbRecord.id,
    batchId: dbRecord.batch_id,
    hotelId: dbRecord.hotel_id,
    hotelName: dbRecord.hotel_name,
    submitDate: dbRecord.submit_date,
    washDate: dbRecord.wash_date,
    returnDate: dbRecord.return_date,
    handler: dbRecord.handler,
    roomStandards: JSON.parse(dbRecord.room_standards),
    billingItems: JSON.parse(dbRecord.billing_items),
    processingStatus: dbRecord.processing_status as ProcessingStatus,
    statusReason: dbRecord.status_reason,
    errorDetails: JSON.parse(dbRecord.error_details),
    createdAt: dbRecord.created_at,
    updatedAt: dbRecord.updated_at
  };
}
