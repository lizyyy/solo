import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';
import { PartOrder, RepairOrder, ClaimRule, ClaimRecord, ImportError, ImportHistory, ReviewRecord } from './types';

export class WarehouseDB {
  private db: Database | null = null;
  private dbPath: string;

  constructor(dbPath: string = path.join(process.cwd(), 'warehouse.db')) {
    this.dbPath = dbPath;
  }

  async init(): Promise<void> {
    if (this.db) return;
    
    this.db = await open({
      filename: this.dbPath,
      driver: sqlite3.Database
    });
    
    await this.initTables();
  }

  private async initTables(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS part_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_no TEXT UNIQUE NOT NULL,
        engineer_id TEXT NOT NULL,
        engineer_name TEXT NOT NULL,
        part_code TEXT NOT NULL,
        part_name TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        unit TEXT NOT NULL,
        receive_date TEXT NOT NULL,
        work_order_no TEXT NOT NULL,
        customer_name TEXT NOT NULL,
        customer_phone TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS repair_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        repair_no TEXT UNIQUE NOT NULL,
        work_order_no TEXT NOT NULL,
        engineer_id TEXT NOT NULL,
        engineer_name TEXT NOT NULL,
        fault_type TEXT NOT NULL,
        fault_description TEXT,
        repair_date TEXT NOT NULL,
        parts_used TEXT,
        old_parts_returned TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS claim_rules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        rule_code TEXT UNIQUE NOT NULL,
        rule_name TEXT NOT NULL,
        part_code TEXT NOT NULL,
        part_name TEXT NOT NULL,
        fault_type TEXT NOT NULL,
        claim_amount REAL NOT NULL,
        requires_old_part INTEGER NOT NULL DEFAULT 1,
        effective_date TEXT NOT NULL,
        expiry_date TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS claim_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        claim_no TEXT UNIQUE NOT NULL,
        repair_no TEXT NOT NULL,
        work_order_no TEXT NOT NULL,
        rule_code TEXT NOT NULL,
        part_code TEXT NOT NULL,
        claim_amount REAL NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        rejection_reason TEXT,
        reviewed_by TEXT,
        reviewed_at TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS import_errors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        import_batch TEXT NOT NULL,
        import_type TEXT NOT NULL,
        source_file TEXT NOT NULL,
        row_number INTEGER NOT NULL,
        raw_data TEXT NOT NULL,
        error_type TEXT NOT NULL,
        error_message TEXT NOT NULL,
        suggestion TEXT NOT NULL,
        resolved INTEGER NOT NULL DEFAULT 0,
        resolved_by TEXT,
        resolved_at TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS import_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        import_batch TEXT UNIQUE NOT NULL,
        import_type TEXT NOT NULL,
        source_file TEXT NOT NULL,
        total_records INTEGER NOT NULL,
        success_count INTEGER NOT NULL,
        error_count INTEGER NOT NULL,
        imported_by TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS review_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        claim_id INTEGER NOT NULL,
        claim_no TEXT NOT NULL,
        reviewer TEXT NOT NULL,
        action TEXT NOT NULL,
        reason TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_part_orders_work_order ON part_orders(work_order_no);
      CREATE INDEX IF NOT EXISTS idx_repair_orders_work_order ON repair_orders(work_order_no);
      CREATE INDEX IF NOT EXISTS idx_claim_records_status ON claim_records(status);
      CREATE INDEX IF NOT EXISTS idx_import_errors_batch ON import_errors(import_batch);
    `);
  }

  async insertPartOrder(order: Omit<PartOrder, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> {
    if (!this.db) throw new Error('Database not initialized');
    
    const result = await this.db.run(
      `INSERT INTO part_orders (
        order_no, engineer_id, engineer_name, part_code, part_name,
        quantity, unit, receive_date, work_order_no, customer_name,
        customer_phone, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      order.orderNo, order.engineerId, order.engineerName,
      order.partCode, order.partName, order.quantity, order.unit,
      order.receiveDate, order.workOrderNo, order.customerName,
      order.customerPhone, order.status
    );
    return result.lastID ? Number(result.lastID) : 0;
  }

  async insertRepairOrder(order: Omit<RepairOrder, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> {
    if (!this.db) throw new Error('Database not initialized');
    
    const result = await this.db.run(
      `INSERT INTO repair_orders (
        repair_no, work_order_no, engineer_id, engineer_name,
        fault_type, fault_description, repair_date, parts_used,
        old_parts_returned, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      order.repairNo, order.workOrderNo, order.engineerId,
      order.engineerName, order.faultType, order.faultDescription,
      order.repairDate, JSON.stringify(order.partsUsed),
      JSON.stringify(order.oldPartsReturned), order.status
    );
    return result.lastID ? Number(result.lastID) : 0;
  }

  async insertClaimRule(rule: Omit<ClaimRule, 'id' | 'createdAt'>): Promise<number> {
    if (!this.db) throw new Error('Database not initialized');
    
    const result = await this.db.run(
      `INSERT INTO claim_rules (
        rule_code, rule_name, part_code, part_name, fault_type,
        claim_amount, requires_old_part, effective_date, expiry_date, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      rule.ruleCode, rule.ruleName, rule.partCode, rule.partName,
      rule.faultType, rule.claimAmount, rule.requiresOldPart ? 1 : 0,
      rule.effectiveDate, rule.expiryDate, rule.status
    );
    return result.lastID ? Number(result.lastID) : 0;
  }

  async insertClaimRecord(record: Omit<ClaimRecord, 'id' | 'createdAt'>): Promise<number> {
    if (!this.db) throw new Error('Database not initialized');
    
    const result = await this.db.run(
      `INSERT INTO claim_records (
        claim_no, repair_no, work_order_no, rule_code, part_code,
        claim_amount, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      record.claimNo, record.repairNo, record.workOrderNo,
      record.ruleCode, record.partCode, record.claimAmount, record.status
    );
    return result.lastID ? Number(result.lastID) : 0;
  }

  async insertImportError(error: Omit<ImportError, 'id' | 'createdAt'>): Promise<number> {
    if (!this.db) throw new Error('Database not initialized');
    
    const result = await this.db.run(
      `INSERT INTO import_errors (
        import_batch, import_type, source_file, row_number,
        raw_data, error_type, error_message, suggestion, resolved
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      error.importBatch, error.importType, error.sourceFile,
      error.rowNumber, error.rawData, error.errorType,
      error.errorMessage, error.suggestion, error.resolved ? 1 : 0
    );
    return result.lastID ? Number(result.lastID) : 0;
  }

  async insertImportHistory(history: Omit<ImportHistory, 'id' | 'createdAt'>): Promise<number> {
    if (!this.db) throw new Error('Database not initialized');
    
    const result = await this.db.run(
      `INSERT INTO import_history (
        import_batch, import_type, source_file, total_records,
        success_count, error_count, imported_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      history.importBatch, history.importType, history.sourceFile,
      history.totalRecords, history.successCount, history.errorCount,
      history.importedBy
    );
    return result.lastID ? Number(result.lastID) : 0;
  }

  async insertReviewRecord(record: Omit<ReviewRecord, 'id' | 'createdAt'>): Promise<number> {
    if (!this.db) throw new Error('Database not initialized');
    
    const result = await this.db.run(
      `INSERT INTO review_records (
        claim_id, claim_no, reviewer, action, reason
      ) VALUES (?, ?, ?, ?, ?)`,
      record.claimId, record.claimNo, record.reviewer,
      record.action, record.reason
    );
    return result.lastID ? Number(result.lastID) : 0;
  }

  async getAllPartOrders(): Promise<PartOrder[]> {
    if (!this.db) throw new Error('Database not initialized');
    
    const rows = await this.db.all('SELECT * FROM part_orders ORDER BY created_at DESC');
    return rows.map(row => this.mapPartOrder(row));
  }

  async getAllRepairOrders(): Promise<RepairOrder[]> {
    if (!this.db) throw new Error('Database not initialized');
    
    const rows = await this.db.all('SELECT * FROM repair_orders ORDER BY created_at DESC');
    return rows.map(row => this.mapRepairOrder(row));
  }

  async getAllClaimRules(): Promise<ClaimRule[]> {
    if (!this.db) throw new Error('Database not initialized');
    
    const rows = await this.db.all('SELECT * FROM claim_rules ORDER BY created_at DESC');
    return rows.map(row => this.mapClaimRule(row));
  }

  async getPendingClaims(): Promise<ClaimRecord[]> {
    if (!this.db) throw new Error('Database not initialized');
    
    const rows = await this.db.all("SELECT * FROM claim_records WHERE status = 'pending' ORDER BY created_at DESC");
    return rows.map(row => this.mapClaimRecord(row));
  }

  async getAllClaims(): Promise<ClaimRecord[]> {
    if (!this.db) throw new Error('Database not initialized');
    
    const rows = await this.db.all('SELECT * FROM claim_records ORDER BY created_at DESC');
    return rows.map(row => this.mapClaimRecord(row));
  }

  async getImportErrors(batch?: string): Promise<ImportError[]> {
    if (!this.db) throw new Error('Database not initialized');
    
    let sql = 'SELECT * FROM import_errors ORDER BY created_at DESC';
    const params: any[] = [];
    if (batch) {
      sql = 'SELECT * FROM import_errors WHERE import_batch = ? ORDER BY created_at DESC';
      params.push(batch);
    }
    const rows = await this.db.all(sql, ...params);
    return rows.map(row => this.mapImportError(row));
  }

  async getImportHistory(): Promise<ImportHistory[]> {
    if (!this.db) throw new Error('Database not initialized');
    
    const rows = await this.db.all('SELECT * FROM import_history ORDER BY created_at DESC');
    return rows.map(row => this.mapImportHistory(row));
  }

  async getReviewRecords(): Promise<ReviewRecord[]> {
    if (!this.db) throw new Error('Database not initialized');
    
    return await this.db.all('SELECT * FROM review_records ORDER BY created_at DESC');
  }

  async getPartOrderByWorkOrder(workOrderNo: string): Promise<PartOrder | undefined> {
    if (!this.db) throw new Error('Database not initialized');
    
    const row = await this.db.get('SELECT * FROM part_orders WHERE work_order_no = ?', workOrderNo);
    return row ? this.mapPartOrder(row) : undefined;
  }

  async getRepairOrderByWorkOrder(workOrderNo: string): Promise<RepairOrder | undefined> {
    if (!this.db) throw new Error('Database not initialized');
    
    const row = await this.db.get('SELECT * FROM repair_orders WHERE work_order_no = ?', workOrderNo);
    return row ? this.mapRepairOrder(row) : undefined;
  }

  async getClaimRule(partCode: string, faultType: string): Promise<ClaimRule | undefined> {
    if (!this.db) throw new Error('Database not initialized');
    
    const row = await this.db.get(
      "SELECT * FROM claim_rules WHERE part_code = ? AND fault_type = ? AND status = 'active'",
      partCode, faultType
    );
    return row ? this.mapClaimRule(row) : undefined;
  }

  async updateClaimStatus(claimId: number, status: 'approved' | 'rejected', reviewer: string, reason?: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    await this.db.run(
      `UPDATE claim_records 
      SET status = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, rejection_reason = ?
      WHERE id = ?`,
      status, reviewer, reason || null, claimId
    );
  }

  async partOrderExists(orderNo: string): Promise<boolean> {
    if (!this.db) throw new Error('Database not initialized');
    
    const row = await this.db.get('SELECT 1 FROM part_orders WHERE order_no = ?', orderNo);
    return !!row;
  }

  async repairOrderExists(repairNo: string): Promise<boolean> {
    if (!this.db) throw new Error('Database not initialized');
    
    const row = await this.db.get('SELECT 1 FROM repair_orders WHERE repair_no = ?', repairNo);
    return !!row;
  }

  async claimRuleExists(ruleCode: string): Promise<boolean> {
    if (!this.db) throw new Error('Database not initialized');
    
    const row = await this.db.get('SELECT 1 FROM claim_rules WHERE rule_code = ?', ruleCode);
    return !!row;
  }

  async close(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.db = null;
    }
  }

  private mapPartOrder(row: any): PartOrder {
    return {
      id: row.id,
      orderNo: row.order_no,
      engineerId: row.engineer_id,
      engineerName: row.engineer_name,
      partCode: row.part_code,
      partName: row.part_name,
      quantity: row.quantity,
      unit: row.unit,
      receiveDate: row.receive_date,
      workOrderNo: row.work_order_no,
      customerName: row.customer_name,
      customerPhone: row.customer_phone,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private mapRepairOrder(row: any): RepairOrder {
    return {
      id: row.id,
      repairNo: row.repair_no,
      workOrderNo: row.work_order_no,
      engineerId: row.engineer_id,
      engineerName: row.engineer_name,
      faultType: row.fault_type,
      faultDescription: row.fault_description,
      repairDate: row.repair_date,
      partsUsed: JSON.parse(row.parts_used || '[]'),
      oldPartsReturned: JSON.parse(row.old_parts_returned || '[]'),
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private mapClaimRule(row: any): ClaimRule {
    return {
      id: row.id,
      ruleCode: row.rule_code,
      ruleName: row.rule_name,
      partCode: row.part_code,
      partName: row.part_name,
      faultType: row.fault_type,
      claimAmount: row.claim_amount,
      requiresOldPart: row.requires_old_part === 1,
      effectiveDate: row.effective_date,
      expiryDate: row.expiry_date,
      status: row.status,
      createdAt: row.created_at
    };
  }

  private mapClaimRecord(row: any): ClaimRecord {
    return {
      id: row.id,
      claimNo: row.claim_no,
      repairNo: row.repair_no,
      workOrderNo: row.work_order_no,
      ruleCode: row.rule_code,
      partCode: row.part_code,
      claimAmount: row.claim_amount,
      status: row.status,
      rejectionReason: row.rejection_reason,
      reviewedBy: row.reviewed_by,
      reviewedAt: row.reviewed_at,
      createdAt: row.created_at
    };
  }

  private mapImportError(row: any): ImportError {
    return {
      id: row.id,
      importBatch: row.import_batch,
      importType: row.import_type,
      sourceFile: row.source_file,
      rowNumber: row.row_number,
      rawData: row.raw_data,
      errorType: row.error_type,
      errorMessage: row.error_message,
      suggestion: row.suggestion,
      resolved: row.resolved === 1,
      resolvedBy: row.resolved_by,
      resolvedAt: row.resolved_at,
      createdAt: row.created_at
    };
  }

  private mapImportHistory(row: any): ImportHistory {
    return {
      id: row.id,
      importBatch: row.import_batch,
      importType: row.import_type,
      sourceFile: row.source_file,
      totalRecords: row.total_records,
      successCount: row.success_count,
      errorCount: row.error_count,
      importedBy: row.imported_by,
      createdAt: row.created_at
    };
  }
}
