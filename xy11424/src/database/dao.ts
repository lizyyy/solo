import sqlite3 from 'sqlite3';
import { v4 as uuidv4 } from 'uuid';
import {
  InspectionOrder,
  RepairQuote,
  PhotoInventory,
  AuditLog,
  FailedRecord,
  PreparationStatus,
  RecordSource,
  UserRole,
  PaginationParams,
  PaginatedResponse
} from '../types';

export class PreparationDAO {
  private db: sqlite3.Database;

  constructor(db: sqlite3.Database) {
    this.db = db;
  }

  private runAsync(sql: string, params: any[] = []): Promise<sqlite3.RunResult> {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(this: sqlite3.RunResult, err: Error | null) {
        if (err) reject(err);
        else resolve(this);
      });
    });
  }

  private getAsync<T>(sql: string, params: any[] = []): Promise<T | undefined> {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row as T | undefined);
      });
    });
  }

  private allAsync<T>(sql: string, params: any[] = []): Promise<T[]> {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows as T[]);
      });
    });
  }

  async upsertInspectionOrder(order: Omit<InspectionOrder, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<InspectionOrder> {
    const now = Date.now();
    const id = order.id || uuidv4();
    
    const existing = await this.getInspectionOrderByRequestId(order.requestId);
    
    if (existing) {
      await this.runAsync(
        `UPDATE inspection_orders SET 
          vin = ?, plateNumber = ?, brand = ?, model = ?, year = ?, mileage = ?,
          inspectionDate = ?, inspectorName = ?, items = ?, totalCost = ?, status = ?,
          remarks = ?, updatedBy = ?, updatedAt = ?
         WHERE requestId = ?`,
        [
          order.vin, order.plateNumber, order.brand, order.model, order.year, order.mileage,
          order.inspectionDate, order.inspectorName, JSON.stringify(order.items), order.totalCost, order.status,
          order.remarks, order.updatedBy, now, order.requestId
        ]
      );
      return this.getInspectionOrderByRequestId(order.requestId) as Promise<InspectionOrder>;
    } else {
      await this.runAsync(
        `INSERT INTO inspection_orders (
          id, requestId, vin, plateNumber, brand, model, year, mileage,
          inspectionDate, inspectorName, items, totalCost, status, remarks,
          createdBy, updatedBy, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id, order.requestId, order.vin, order.plateNumber, order.brand, order.model, order.year, order.mileage,
          order.inspectionDate, order.inspectorName, JSON.stringify(order.items), order.totalCost, order.status, order.remarks,
          order.createdBy, order.updatedBy, now, now
        ]
      );
      return this.getInspectionOrderByRequestId(order.requestId) as Promise<InspectionOrder>;
    }
  }

  async getInspectionOrderByRequestId(requestId: string): Promise<InspectionOrder | undefined> {
    const row = await this.getAsync<any>(
      'SELECT * FROM inspection_orders WHERE requestId = ?',
      [requestId]
    );
    if (!row) return undefined;
    return {
      ...row,
      items: JSON.parse(row.items),
      source: RecordSource.INSPECTION
    };
  }

  async getInspectionOrders(params: PaginationParams & { status?: PreparationStatus; vin?: string }): Promise<PaginatedResponse<InspectionOrder>> {
    const whereClauses: string[] = [];
    const whereParams: any[] = [];
    
    if (params.status) {
      whereClauses.push('status = ?');
      whereParams.push(params.status);
    }
    if (params.vin) {
      whereClauses.push('vin LIKE ?');
      whereParams.push(`%${params.vin}%`);
    }
    
    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    
    const countResult = await this.getAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM inspection_orders ${whereSql}`,
      whereParams
    );
    const total = countResult?.count || 0;
    
    const offset = (params.page - 1) * params.pageSize;
    const rows = await this.allAsync<any>(
      `SELECT * FROM inspection_orders ${whereSql} ORDER BY createdAt DESC LIMIT ? OFFSET ?`,
      [...whereParams, params.pageSize, offset]
    );
    
    return {
      items: rows.map(row => ({
        ...row,
        items: JSON.parse(row.items),
        source: RecordSource.INSPECTION
      })),
      total,
      page: params.page,
      pageSize: params.pageSize,
      totalPages: Math.ceil(total / params.pageSize)
    };
  }

  async upsertRepairQuote(quote: Omit<RepairQuote, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<RepairQuote> {
    const now = Date.now();
    const id = quote.id || uuidv4();
    
    const existing = await this.getRepairQuoteByRequestId(quote.requestId);
    
    if (existing) {
      await this.runAsync(
        `UPDATE repair_quotes SET 
          vin = ?, plateNumber = ?, brand = ?, model = ?, year = ?, mileage = ?,
          quoteDate = ?, repairShop = ?, quoteManager = ?, items = ?, laborCost = ?,
          partsCost = ?, totalCost = ?, estimatedDuration = ?, status = ?, remarks = ?,
          updatedBy = ?, updatedAt = ?
         WHERE requestId = ?`,
        [
          quote.vin, quote.plateNumber, quote.brand, quote.model, quote.year, quote.mileage,
          quote.quoteDate, quote.repairShop, quote.quoteManager, JSON.stringify(quote.items), quote.laborCost,
          quote.partsCost, quote.totalCost, quote.estimatedDuration, quote.status, quote.remarks,
          quote.updatedBy, now, quote.requestId
        ]
      );
      return this.getRepairQuoteByRequestId(quote.requestId) as Promise<RepairQuote>;
    } else {
      await this.runAsync(
        `INSERT INTO repair_quotes (
          id, requestId, vin, plateNumber, brand, model, year, mileage,
          quoteDate, repairShop, quoteManager, items, laborCost, partsCost,
          totalCost, estimatedDuration, status, remarks, createdBy, updatedBy,
          createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id, quote.requestId, quote.vin, quote.plateNumber, quote.brand, quote.model, quote.year, quote.mileage,
          quote.quoteDate, quote.repairShop, quote.quoteManager, JSON.stringify(quote.items), quote.laborCost, quote.partsCost,
          quote.totalCost, quote.estimatedDuration, quote.status, quote.remarks, quote.createdBy, quote.updatedBy,
          now, now
        ]
      );
      return this.getRepairQuoteByRequestId(quote.requestId) as Promise<RepairQuote>;
    }
  }

  async getRepairQuoteByRequestId(requestId: string): Promise<RepairQuote | undefined> {
    const row = await this.getAsync<any>(
      'SELECT * FROM repair_quotes WHERE requestId = ?',
      [requestId]
    );
    if (!row) return undefined;
    return {
      ...row,
      items: JSON.parse(row.items),
      source: RecordSource.REPAIR_QUOTE
    };
  }

  async getRepairQuotes(params: PaginationParams & { status?: PreparationStatus; vin?: string }): Promise<PaginatedResponse<RepairQuote>> {
    const whereClauses: string[] = [];
    const whereParams: any[] = [];
    
    if (params.status) {
      whereClauses.push('status = ?');
      whereParams.push(params.status);
    }
    if (params.vin) {
      whereClauses.push('vin LIKE ?');
      whereParams.push(`%${params.vin}%`);
    }
    
    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    
    const countResult = await this.getAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM repair_quotes ${whereSql}`,
      whereParams
    );
    const total = countResult?.count || 0;
    
    const offset = (params.page - 1) * params.pageSize;
    const rows = await this.allAsync<any>(
      `SELECT * FROM repair_quotes ${whereSql} ORDER BY createdAt DESC LIMIT ? OFFSET ?`,
      [...whereParams, params.pageSize, offset]
    );
    
    return {
      items: rows.map(row => ({
        ...row,
        items: JSON.parse(row.items),
        source: RecordSource.REPAIR_QUOTE
      })),
      total,
      page: params.page,
      pageSize: params.pageSize,
      totalPages: Math.ceil(total / params.pageSize)
    };
  }

  async upsertPhotoInventory(inventory: Omit<PhotoInventory, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<PhotoInventory> {
    const now = Date.now();
    const id = inventory.id || uuidv4();
    
    const existing = await this.getPhotoInventoryByRequestId(inventory.requestId);
    
    if (existing) {
      await this.runAsync(
        `UPDATE photo_inventories SET 
          vin = ?, plateNumber = ?, photoDate = ?, uploader = ?, photos = ?,
          status = ?, remarks = ?, updatedBy = ?, updatedAt = ?
         WHERE requestId = ?`,
        [
          inventory.vin, inventory.plateNumber, inventory.photoDate, inventory.uploader,
          JSON.stringify(inventory.photos), inventory.status, inventory.remarks,
          inventory.updatedBy, now, inventory.requestId
        ]
      );
      return this.getPhotoInventoryByRequestId(inventory.requestId) as Promise<PhotoInventory>;
    } else {
      await this.runAsync(
        `INSERT INTO photo_inventories (
          id, requestId, vin, plateNumber, photoDate, uploader, photos,
          status, remarks, createdBy, updatedBy, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id, inventory.requestId, inventory.vin, inventory.plateNumber,
          inventory.photoDate, inventory.uploader, JSON.stringify(inventory.photos),
          inventory.status, inventory.remarks, inventory.createdBy, inventory.updatedBy,
          now, now
        ]
      );
      return this.getPhotoInventoryByRequestId(inventory.requestId) as Promise<PhotoInventory>;
    }
  }

  async getPhotoInventoryByRequestId(requestId: string): Promise<PhotoInventory | undefined> {
    const row = await this.getAsync<any>(
      'SELECT * FROM photo_inventories WHERE requestId = ?',
      [requestId]
    );
    if (!row) return undefined;
    return {
      ...row,
      photos: JSON.parse(row.photos),
      source: RecordSource.PHOTO
    };
  }

  async getPhotoInventories(params: PaginationParams & { status?: PreparationStatus; vin?: string }): Promise<PaginatedResponse<PhotoInventory>> {
    const whereClauses: string[] = [];
    const whereParams: any[] = [];
    
    if (params.status) {
      whereClauses.push('status = ?');
      whereParams.push(params.status);
    }
    if (params.vin) {
      whereClauses.push('vin LIKE ?');
      whereParams.push(`%${params.vin}%`);
    }
    
    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    
    const countResult = await this.getAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM photo_inventories ${whereSql}`,
      whereParams
    );
    const total = countResult?.count || 0;
    
    const offset = (params.page - 1) * params.pageSize;
    const rows = await this.allAsync<any>(
      `SELECT * FROM photo_inventories ${whereSql} ORDER BY createdAt DESC LIMIT ? OFFSET ?`,
      [...whereParams, params.pageSize, offset]
    );
    
    return {
      items: rows.map(row => ({
        ...row,
        photos: JSON.parse(row.photos),
        source: RecordSource.PHOTO
      })),
      total,
      page: params.page,
      pageSize: params.pageSize,
      totalPages: Math.ceil(total / params.pageSize)
    };
  }

  async createAuditLog(log: Omit<AuditLog, 'id'>): Promise<AuditLog> {
    const id = uuidv4();
    const timestamp = log.timestamp || Date.now();
    
    await this.runAsync(
      `INSERT INTO audit_logs (
        id, requestId, source, action, oldStatus, newStatus,
        operatorId, operatorName, operatorRole, changeReason,
        fieldChanges, timestamp, ipAddress
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, log.requestId, log.source, log.action, log.oldStatus, log.newStatus,
        log.operatorId, log.operatorName, log.operatorRole, log.changeReason,
        log.fieldChanges ? JSON.stringify(log.fieldChanges) : null, timestamp, log.ipAddress
      ]
    );
    
    return { ...log, id, timestamp };
  }

  async getAuditLogsByRequestId(requestId: string): Promise<AuditLog[]> {
    const rows = await this.allAsync<any>(
      'SELECT * FROM audit_logs WHERE requestId = ? ORDER BY timestamp DESC',
      [requestId]
    );
    return rows.map(row => ({
      ...row,
      fieldChanges: row.fieldChanges ? JSON.parse(row.fieldChanges) : undefined
    }));
  }

  async createFailedRecord(record: Omit<FailedRecord, 'id'>): Promise<FailedRecord> {
    const id = uuidv4();
    
    await this.runAsync(
      `INSERT INTO failed_records (
        id, requestId, source, rawData, errorType, errorMessage,
        validationErrors, receivedAt, operatorId, resolved
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [
        id, record.requestId, record.source, record.rawData, record.errorType,
        record.errorMessage, JSON.stringify(record.validationErrors),
        record.receivedAt, record.operatorId
      ]
    );
    
    return { ...record, id, resolved: false };
  }

  async getFailedRecords(params: PaginationParams & { resolved?: boolean }): Promise<PaginatedResponse<FailedRecord>> {
    const whereClauses: string[] = [];
    const whereParams: any[] = [];
    
    if (params.resolved !== undefined) {
      whereClauses.push('resolved = ?');
      whereParams.push(params.resolved ? 1 : 0);
    }
    
    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    
    const countResult = await this.getAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM failed_records ${whereSql}`,
      whereParams
    );
    const total = countResult?.count || 0;
    
    const offset = (params.page - 1) * params.pageSize;
    const rows = await this.allAsync<any>(
      `SELECT * FROM failed_records ${whereSql} ORDER BY receivedAt DESC LIMIT ? OFFSET ?`,
      [...whereParams, params.pageSize, offset]
    );
    
    return {
      items: rows.map(row => ({
        ...row,
        validationErrors: JSON.parse(row.validationErrors),
        resolved: row.resolved === 1
      })),
      total,
      page: params.page,
      pageSize: params.pageSize,
      totalPages: Math.ceil(total / params.pageSize)
    };
  }

  async resolveFailedRecord(id: string, resolutionNote: string, operatorId: string): Promise<boolean> {
    const result = await this.runAsync(
      `UPDATE failed_records SET resolved = 1, resolvedAt = ?, resolutionNote = ?, operatorId = ? WHERE id = ?`,
      [Date.now(), resolutionNote, operatorId, id]
    );
    return result.changes ? result.changes > 0 : false;
  }
}

export default PreparationDAO;
