import { db } from '../models/database';
import { v4 as uuidv4 } from 'uuid';
import {
  Material,
  Booth,
  BorrowRecord,
  Operator,
  MaterialType,
  OperationType
} from '../models/types';
import { idempotentService } from './IdempotentService';
import { auditService } from './AuditService';
import { ruleEngine } from './RuleEngine';

import csv from 'csv-parser';
import { Readable } from 'stream';
import { Parser } from 'json2csv';

export interface OperationResult<T = any> {
  success: boolean;
  data?: T;
  reason: string;
  code: string;
  isDuplicate?: boolean;
}

export class MaterialService {
  async importMaterials(
    csvContent: string,
    operator: Operator,
    requestId: string
  ): Promise<OperationResult<Material[]>> {
    const idempotentCheck = await idempotentService.checkRequest(
      requestId,
      'import',
      operator.id
    );

    if (idempotentCheck.exists) {
      await auditService.log(
        requestId,
        'import',
        operator,
        'duplicate',
        '重复导入请求',
        { csvContentLength: csvContent.length },
        idempotentCheck.result
      );
      return {
        ...idempotentCheck.result,
        isDuplicate: true
      };
    }

    try {
      const validation = await ruleEngine.validate({
        operationType: 'import',
        operator
      });

      if (!validation.passed) {
        const result = { success: false, reason: validation.reason, code: validation.code };
        await idempotentService.completeRequest(requestId, result, 'failed');
        await auditService.log(
          requestId,
          'import',
          operator,
          'rejected',
          validation.reason,
          { csvContentLength: csvContent.length },
          result
        );
        return result;
      }

      const materials = await this.parseCsv(csvContent);
      const imported: Material[] = [];

      for (const mat of materials) {
        const existing = await db.get<Material>(
          `SELECT * FROM materials WHERE code = ?`,
          [mat.code]
        );

        if (existing) {
          await db.run(
            `UPDATE materials 
             SET totalQuantity = totalQuantity + ?, 
                 availableQuantity = availableQuantity + ?, 
                 updatedAt = ? 
             WHERE code = ?`,
            [mat.totalQuantity, mat.totalQuantity, Date.now(), mat.code]
          );
          const updated = await db.get<Material>(`SELECT * FROM materials WHERE code = ?`, [mat.code]);
          if (updated) imported.push(updated);
        } else {
          const id = uuidv4();
          const now = Date.now();
          await db.run(
            `INSERT INTO materials 
             (id, code, type, name, specs, totalQuantity, availableQuantity, status, createdAt, updatedAt) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              id,
              mat.code,
              mat.type,
              mat.name,
              mat.specs,
              mat.totalQuantity,
              mat.totalQuantity,
              'normal',
              now,
              now
            ]
          );
          imported.push({ ...mat, id, status: 'normal', createdAt: now, updatedAt: now } as Material);
        }
      }

      const result = {
        success: true,
        data: imported,
        reason: `成功导入 ${imported.length} 种物资`,
        code: 'IMPORT_SUCCESS'
      };

      await idempotentService.completeRequest(requestId, result, 'completed');
      await auditService.log(
        requestId,
        'import',
        operator,
        'approved',
        result.reason,
        { csvContentLength: csvContent.length, count: materials.length },
        result
      );

      return result;
    } catch (error: any) {
      const result = { success: false, reason: error.message, code: 'IMPORT_ERROR' };
      await idempotentService.completeRequest(requestId, result, 'failed');
      return result;
    }
  }

  async createBooth(
    code: string,
    name: string,
    exhibitor: string,
    contact?: string
  ): Promise<OperationResult<Booth>> {
    const existing = await db.get<Booth>(`SELECT * FROM booths WHERE code = ?`, [code]);
    if (existing) {
      return { success: false, reason: '展位编码已存在', code: 'BOOTH_EXISTS' };
    }

    const id = uuidv4();
    await db.run(
      `INSERT INTO booths (id, code, name, exhibitor, contact, createdAt) VALUES (?, ?, ?, ?, ?, ?)`,
      [id, code, name, exhibitor, contact || null, Date.now()]
    );

    const booth = await db.get<Booth>(`SELECT * FROM booths WHERE id = ?`, [id]);
    return { success: true, data: booth, reason: '展位创建成功', code: 'BOOTH_CREATED' };
  }

  async occupy(
    materialCode: string,
    boothId: string,
    quantity: number,
    operator: Operator,
    requestId: string,
    reason: string = ''
  ): Promise<OperationResult<BorrowRecord>> {
    const idempotentCheck = await idempotentService.checkRequest(
      requestId,
      'occupy',
      operator.id
    );

    if (idempotentCheck.exists) {
      await auditService.log(
        requestId,
        'occupy',
        operator,
        'duplicate',
        '重复借用请求',
        { materialCode, boothId, quantity },
        idempotentCheck.result
      );
      return {
        ...idempotentCheck.result,
        isDuplicate: true
      };
    }

    try {
      const validation = await ruleEngine.validate({
        operationType: 'occupy',
        operator,
        materialCode,
        toBoothId: boothId,
        quantity
      });

      if (!validation.passed) {
        const result = { success: false, reason: validation.reason, code: validation.code };
        await idempotentService.completeRequest(requestId, result, 'failed');
        await auditService.log(
          requestId,
          'occupy',
          operator,
          'rejected',
          validation.reason,
          { materialCode, boothId, quantity },
          result
        );
        return result;
      }

      const material = await db.get<Material>(
        `SELECT * FROM materials WHERE code = ?`,
        [materialCode]
      );

      await db.run(
        `UPDATE materials SET availableQuantity = availableQuantity - ?, updatedAt = ? WHERE code = ?`,
        [quantity, Date.now(), materialCode]
      );

      const recordId = uuidv4();
      const now = Date.now();
      await db.run(
        `INSERT INTO borrow_records 
         (id, requestId, materialId, materialCode, fromBoothId, toBoothId, quantity, status, 
          operatorId, operatorName, operatorRole, operationType, reason, createdAt, updatedAt) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          recordId,
          requestId,
          material!.id,
          materialCode,
          null,
          boothId,
          quantity,
          'approved',
          operator.id,
          operator.name,
          operator.role,
          'occupy',
          reason,
          now,
          now
        ]
      );

      const record = await db.get<BorrowRecord>(`SELECT * FROM borrow_records WHERE id = ?`, [recordId]);
      const result = {
        success: true,
        data: record,
        reason: `成功借用 ${quantity} 件 ${materialCode}`,
        code: 'OCCUPY_SUCCESS'
      };

      await idempotentService.completeRequest(requestId, result, 'completed');
      await auditService.log(
        requestId,
        'occupy',
        operator,
        'approved',
        result.reason,
        { materialCode, boothId, quantity },
        result
      );

      return result;
    } catch (error: any) {
      const result = { success: false, reason: error.message, code: 'OCCUPY_ERROR' };
      await idempotentService.completeRequest(requestId, result, 'failed');
      return result;
    }
  }

  async transfer(
    materialCode: string,
    fromBoothId: string,
    toBoothId: string,
    quantity: number,
    operator: Operator,
    requestId: string,
    reason: string = ''
  ): Promise<OperationResult<BorrowRecord>> {
    const idempotentCheck = await idempotentService.checkRequest(
      requestId,
      'transfer',
      operator.id
    );

    if (idempotentCheck.exists) {
      await auditService.log(
        requestId,
        'transfer',
        operator,
        'duplicate',
        '重复调拨请求',
        { materialCode, fromBoothId, toBoothId, quantity },
        idempotentCheck.result
      );
      return {
        ...idempotentCheck.result,
        isDuplicate: true
      };
    }

    try {
      const validation = await ruleEngine.validate({
        operationType: 'transfer',
        operator,
        materialCode,
        fromBoothId,
        toBoothId,
        quantity
      });

      if (!validation.passed) {
        const result = { success: false, reason: validation.reason, code: validation.code };
        await idempotentService.completeRequest(requestId, result, 'failed');
        await auditService.log(
          requestId,
          'transfer',
          operator,
          'rejected',
          validation.reason,
          { materialCode, fromBoothId, toBoothId, quantity },
          result
        );
        return result;
      }

      const material = await db.get<Material>(
        `SELECT * FROM materials WHERE code = ?`,
        [materialCode]
      );

      const recordId = uuidv4();
      const now = Date.now();
      await db.run(
        `INSERT INTO borrow_records 
         (id, requestId, materialId, materialCode, fromBoothId, toBoothId, quantity, status, 
          operatorId, operatorName, operatorRole, operationType, reason, createdAt, updatedAt) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          recordId,
          requestId,
          material!.id,
          materialCode,
          fromBoothId,
          toBoothId,
          quantity,
          'approved',
          operator.id,
          operator.name,
          operator.role,
          'transfer',
          reason,
          now,
          now
        ]
      );

      const record = await db.get<BorrowRecord>(`SELECT * FROM borrow_records WHERE id = ?`, [recordId]);
      const result = {
        success: true,
        data: record,
        reason: `成功调拨 ${quantity} 件 ${materialCode}`,
        code: 'TRANSFER_SUCCESS'
      };

      await idempotentService.completeRequest(requestId, result, 'completed');
      await auditService.log(
        requestId,
        'transfer',
        operator,
        'approved',
        result.reason,
        { materialCode, fromBoothId, toBoothId, quantity },
        result
      );

      return result;
    } catch (error: any) {
      const result = { success: false, reason: error.message, code: 'TRANSFER_ERROR' };
      await idempotentService.completeRequest(requestId, result, 'failed');
      return result;
    }
  }

  async return(
    recordId: string,
    quantity: number,
    operator: Operator,
    requestId: string,
    reason: string = ''
  ): Promise<OperationResult<BorrowRecord>> {
    const idempotentCheck = await idempotentService.checkRequest(
      requestId,
      'return',
      operator.id
    );

    if (idempotentCheck.exists) {
      await auditService.log(
        requestId,
        'return',
        operator,
        'duplicate',
        '重复归还请求',
        { recordId, quantity },
        idempotentCheck.result
      );
      return {
        ...idempotentCheck.result,
        isDuplicate: true
      };
    }

    try {
      const validation = await ruleEngine.validate({
        operationType: 'return',
        operator,
        recordId,
        quantity
      });

      if (!validation.passed) {
        const result = { success: false, reason: validation.reason, code: validation.code };
        await idempotentService.completeRequest(requestId, result, 'failed');
        await auditService.log(
          requestId,
          'return',
          operator,
          'rejected',
          validation.reason,
          { recordId, quantity },
          result
        );
        return result;
      }

      const record = await db.get<BorrowRecord>(
        `SELECT * FROM borrow_records WHERE id = ?`,
        [recordId]
      );

      await db.run(
        `UPDATE materials SET availableQuantity = availableQuantity + ?, updatedAt = ? WHERE id = ?`,
        [quantity, Date.now(), record!.materialId]
      );

      const newStatus = quantity === record!.quantity ? 'returned' : 'approved';
      await db.run(
        `UPDATE borrow_records SET status = ?, updatedAt = ?, returnedAt = ? WHERE id = ?`,
        [newStatus, Date.now(), Date.now(), recordId]
      );

      if (quantity < record!.quantity) {
        const partialReturnId = uuidv4();
        await db.run(
          `INSERT INTO borrow_records 
           (id, requestId, materialId, materialCode, fromBoothId, toBoothId, quantity, status, 
            operatorId, operatorName, operatorRole, operationType, reason, createdAt, updatedAt, returnedAt) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            partialReturnId,
            requestId,
            record!.materialId,
            record!.materialCode,
            record!.toBoothId,
            null,
            quantity,
            'returned',
            operator.id,
            operator.name,
            operator.role,
            'return',
            reason,
            Date.now(),
            Date.now(),
            Date.now()
          ]
        );
      }

      const updatedRecord = await db.get<BorrowRecord>(`SELECT * FROM borrow_records WHERE id = ?`, [recordId]);
      const result = {
        success: true,
        data: updatedRecord,
        reason: `成功归还 ${quantity} 件`,
        code: 'RETURN_SUCCESS'
      };

      await idempotentService.completeRequest(requestId, result, 'completed');
      await auditService.log(
        requestId,
        'return',
        operator,
        'approved',
        result.reason,
        { recordId, quantity },
        result
      );

      return result;
    } catch (error: any) {
      const result = { success: false, reason: error.message, code: 'RETURN_ERROR' };
      await idempotentService.completeRequest(requestId, result, 'failed');
      return result;
    }
  }

  async reportDamage(
    recordId: string,
    quantity: number,
    damageType: 'broken' | 'lost' | 'worn',
    description: string,
    deductionAmount: number,
    operator: Operator,
    requestId: string
  ): Promise<OperationResult<any>> {
    const idempotentCheck = await idempotentService.checkRequest(
      requestId,
      'damage',
      operator.id
    );

    if (idempotentCheck.exists) {
      await auditService.log(
        requestId,
        'damage',
        operator,
        'duplicate',
        '重复报损请求',
        { recordId, quantity, damageType },
        idempotentCheck.result
      );
      return {
        ...idempotentCheck.result,
        isDuplicate: true
      };
    }

    try {
      const validation = await ruleEngine.validate({
        operationType: 'damage',
        operator,
        recordId,
        quantity
      });

      if (!validation.passed) {
        const result = { success: false, reason: validation.reason, code: validation.code };
        await idempotentService.completeRequest(requestId, result, 'failed');
        await auditService.log(
          requestId,
          'damage',
          operator,
          'rejected',
          validation.reason,
          { recordId, quantity, damageType },
          result
        );
        return result;
      }

      const record = await db.get<BorrowRecord>(
        `SELECT * FROM borrow_records WHERE id = ?`,
        [recordId]
      );

      await db.run(
        `UPDATE materials 
         SET totalQuantity = totalQuantity - ?, 
             updatedAt = ? 
         WHERE id = ?`,
        [quantity, Date.now(), record!.materialId]
      );

      await db.run(
        `UPDATE borrow_records SET status = 'damaged', damagedQuantity = ?, updatedAt = ? WHERE id = ?`,
        [quantity, Date.now(), recordId]
      );

      const damageId = uuidv4();
      await db.run(
        `INSERT INTO damage_reports 
         (id, recordId, materialId, boothId, quantity, damageType, description, deductionAmount, operatorId, createdAt) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          damageId,
          recordId,
          record!.materialId,
          record!.toBoothId,
          quantity,
          damageType,
          description,
          deductionAmount,
          operator.id,
          Date.now()
        ]
      );

      const damageReport = await db.get(`SELECT * FROM damage_reports WHERE id = ?`, [damageId]);
      const result = {
        success: true,
        data: damageReport,
        reason: `成功报损 ${quantity} 件，扣款 ${deductionAmount} 元`,
        code: 'DAMAGE_REPORTED'
      };

      await idempotentService.completeRequest(requestId, result, 'completed');
      await auditService.log(
        requestId,
        'damage',
        operator,
        'approved',
        result.reason,
        { recordId, quantity, damageType, deductionAmount },
        result
      );

      return result;
    } catch (error: any) {
      const result = { success: false, reason: error.message, code: 'DAMAGE_ERROR' };
      await idempotentService.completeRequest(requestId, result, 'failed');
      return result;
    }
  }

  async rollback(
    recordId: string,
    operator: Operator,
    requestId: string,
    reason: string = ''
  ): Promise<OperationResult<BorrowRecord>> {
    const idempotentCheck = await idempotentService.checkRequest(
      requestId,
      'rollback',
      operator.id
    );

    if (idempotentCheck.exists) {
      await auditService.log(
        requestId,
        'rollback',
        operator,
        'duplicate',
        '重复回滚请求',
        { recordId },
        idempotentCheck.result
      );
      return {
        ...idempotentCheck.result,
        isDuplicate: true
      };
    }

    try {
      const validation = await ruleEngine.validate({
        operationType: 'rollback',
        operator,
        recordId
      });

      if (!validation.passed) {
        const result = { success: false, reason: validation.reason, code: validation.code };
        await idempotentService.completeRequest(requestId, result, 'failed');
        await auditService.log(
          requestId,
          'rollback',
          operator,
          'rejected',
          validation.reason,
          { recordId },
          result
        );
        return result;
      }

      const record = await db.get<BorrowRecord>(
        `SELECT * FROM borrow_records WHERE id = ?`,
        [recordId]
      );

      await db.run(
        `UPDATE materials SET availableQuantity = availableQuantity + ?, updatedAt = ? WHERE id = ?`,
        [record!.quantity, Date.now(), record!.materialId]
      );

      await db.run(
        `UPDATE borrow_records SET status = 'rolled_back', updatedAt = ?, reason = ? WHERE id = ?`,
        [Date.now(), reason, recordId]
      );

      const updatedRecord = await db.get<BorrowRecord>(`SELECT * FROM borrow_records WHERE id = ?`, [recordId]);
      const result = {
        success: true,
        data: updatedRecord,
        reason: '回滚成功，物资已归还库存',
        code: 'ROLLBACK_SUCCESS'
      };

      await idempotentService.completeRequest(requestId, result, 'completed');
      await auditService.log(
        requestId,
        'rollback',
        operator,
        'approved',
        result.reason,
        { recordId },
        result
      );

      return result;
    } catch (error: any) {
      const result = { success: false, reason: error.message, code: 'ROLLBACK_ERROR' };
      await idempotentService.completeRequest(requestId, result, 'failed');
      return result;
    }
  }

  async getMaterials(filters: { type?: MaterialType; status?: string } = {}): Promise<Material[]> {
    let sql = `SELECT * FROM materials WHERE 1=1`;
    const params: any[] = [];

    if (filters.type) {
      sql += ` AND type = ?`;
      params.push(filters.type);
    }
    if (filters.status) {
      sql += ` AND status = ?`;
      params.push(filters.status);
    }

    return db.all(sql, params);
  }

  async getBooths(): Promise<Booth[]> {
    return db.all(`SELECT * FROM booths`);
  }

  async getBorrowRecords(filters: {
    boothId?: string;
    materialCode?: string;
    status?: string;
    operationType?: OperationType;
  } = {}): Promise<BorrowRecord[]> {
    let sql = `SELECT * FROM borrow_records WHERE 1=1`;
    const params: any[] = [];

    if (filters.boothId) {
      sql += ` AND (fromBoothId = ? OR toBoothId = ?)`;
      params.push(filters.boothId, filters.boothId);
    }
    if (filters.materialCode) {
      sql += ` AND materialCode = ?`;
      params.push(filters.materialCode);
    }
    if (filters.status) {
      sql += ` AND status = ?`;
      params.push(filters.status);
    }
    if (filters.operationType) {
      sql += ` AND operationType = ?`;
      params.push(filters.operationType);
    }

    sql += ` ORDER BY createdAt DESC`;
    return db.all(sql, params);
  }

  async exportReport(format: 'csv' | 'json', filters: any = {}): Promise<string> {
    const records = await this.getBorrowRecords(filters);
    const maskedRecords = records.map(r => auditService.maskData(r));

    if (format === 'json') {
      return JSON.stringify(maskedRecords, null, 2);
    }

    const parser = new Parser();
    return parser.parse(maskedRecords);
  }

  private async parseCsv(csvContent: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const results: any[] = [];
      const stream = Readable.from(csvContent);

      stream
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', () => resolve(results))
        .on('error', reject);
    });
  }
}

export const materialService = new MaterialService();
