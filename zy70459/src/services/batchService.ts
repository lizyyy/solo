import { v4 as uuidv4 } from 'uuid';
import db from '../database';
import ValidationService from './validationService';
import { BatchOperation, ValidationResult } from '../types';

export class BatchService {
  static async previewBatchValidation(businessNos: string[], operator: string): Promise<{
    operationId: string;
    previewData: {
      total: number;
      willSuccess: string[];
      willFail: { businessNo: string; reason: string }[];
      inWindow: boolean;
      windowInfo: { type: string; start: Date; end: Date };
    };
  }> {
    const operationId = uuidv4();
    const now = new Date();
    const { inWindow, windowType, windowStart, windowEnd } = ValidationService.isInFreezeWindow(now);

    const willSuccess: string[] = [];
    const willFail: { businessNo: string; reason: string }[] = [];

    for (const businessNo of businessNos) {
      const sampleExists = await new Promise<boolean>((resolve) => {
        db.get('SELECT 1 FROM lab_samples WHERE business_no = ?', [businessNo], (err, row) => {
          resolve(!!row);
        });
      });

      if (!sampleExists) {
        willFail.push({ businessNo, reason: '样本不存在' });
      } else if (!inWindow) {
        willFail.push({ businessNo, reason: `不在冻结窗口内，当前窗口类型: ${windowType}` });
      } else {
        willSuccess.push(businessNo);
      }
    }

    const previewData = {
      total: businessNos.length,
      willSuccess,
      willFail,
      inWindow,
      windowInfo: {
        type: windowType,
        start: windowStart,
        end: windowEnd
      }
    };

    await new Promise<void>((resolve) => {
      db.run(`
        INSERT INTO batch_operations (id, operation_type, status, affected_count, preview_data, operator, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        operationId,
        'batch_validation',
        'preview',
        businessNos.length,
        JSON.stringify(previewData),
        operator,
        now.toISOString()
      ], () => resolve());
    });

    return {
      operationId,
      previewData
    };
  }

  static async executeBatchValidation(operationId: string, operator: string): Promise<{
    operationId: string;
    results: ValidationResult[];
    summary: {
      total: number;
      success: number;
      failed: number;
    };
  }> {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM batch_operations WHERE id = ?', [operationId], async (err, row: any) => {
        if (err || !row) {
          reject(new Error('批量操作不存在'));
          return;
        }

        const previewData = JSON.parse(row.preview_data);
        const businessNos = [...previewData.willSuccess, ...previewData.willFail.map((f: any) => f.businessNo)];

        db.run('UPDATE batch_operations SET status = ?, executed_at = ? WHERE id = ?', 
          ['executing', new Date().toISOString(), operationId]);

        const results: ValidationResult[] = [];
        for (const businessNo of businessNos) {
          const result = await ValidationService.validateSample(businessNo, operator);
          results.push(result);
        }

        const successCount = results.filter(r => r.success).length;
        const failedCount = results.filter(r => !r.success).length;

        db.run('UPDATE batch_operations SET status = ? WHERE id = ?', 
          ['completed', operationId]);

        resolve({
          operationId,
          results,
          summary: {
            total: results.length,
            success: successCount,
            failed: failedCount
          }
        });
      });
    });
  }

  static async getBatchOperation(operationId: string): Promise<BatchOperation | null> {
    return new Promise((resolve) => {
      db.get('SELECT * FROM batch_operations WHERE id = ?', [operationId], (err, row) => {
        if (err || !row) {
          resolve(null);
          return;
        }
        resolve(this.mapBatchOperation(row));
      });
    });
  }

  static async listBatchOperations(params: {
    page?: number;
    pageSize?: number;
  } = {}): Promise<{ total: number; items: BatchOperation[] }> {
    const { page = 1, pageSize = 20 } = params;
    const offset = (page - 1) * pageSize;

    return new Promise((resolve, reject) => {
      db.get('SELECT COUNT(*) as total FROM batch_operations', [], (err, countRow: any) => {
        if (err) reject(err);

        db.all(`
          SELECT * FROM batch_operations 
          ORDER BY created_at DESC
          LIMIT ? OFFSET ?
        `, [pageSize, offset], (err, rows) => {
          if (err) reject(err);
          resolve({
            total: countRow.total,
            items: rows.map(r => this.mapBatchOperation(r))
          });
        });
      });
    });
  }

  private static mapBatchOperation(row: any): BatchOperation {
    return {
      id: row.id,
      operationType: row.operation_type,
      status: row.status,
      affectedCount: row.affected_count,
      previewData: row.preview_data,
      operator: row.operator,
      createdAt: new Date(row.created_at),
      executedAt: row.executed_at ? new Date(row.executed_at) : undefined
    };
  }
}

export default BatchService;
