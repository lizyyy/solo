import axios from 'axios';
import { set, get } from 'lodash';
import {
  ApiMapping,
  SyncBatch,
  SyncRow,
  SyncStatus,
  RowStatus,
  ValidationRule,
  FieldMapping
} from '../types';
import { store } from '../store/memoryStore';

class SyncEngine {
  validateRow(rawData: Record<string, any>, rules: ValidationRule[], mappings: FieldMapping[]): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (const mapping of mappings) {
      if (mapping.required && !rawData[mapping.csvField]) {
        errors.push(`${mapping.csvField}: 字段不能为空`);
      }
    }

    for (const rule of rules) {
      const value = rawData[rule.field];

      switch (rule.type) {
        case 'required':
          if (!value) {
            errors.push(rule.errorMessage);
          }
          break;
        case 'regex':
          if (value && rule.pattern && !new RegExp(rule.pattern).test(value)) {
            errors.push(rule.errorMessage);
          }
          break;
        case 'enum':
          if (value && rule.values && !rule.values.includes(value)) {
            errors.push(rule.errorMessage);
          }
          break;
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  transformRow(rawData: Record<string, any>, mappings: FieldMapping[]): Record<string, any> {
    const result: Record<string, any> = {};

    for (const mapping of mappings) {
      const value = rawData[mapping.csvField];
      if (value !== undefined && value !== null && value !== '') {
        set(result, mapping.apiField, value);
      }
    }

    return result;
  }

  async validateBatch(batchId: string): Promise<void> {
    const batch = store.getBatch(batchId);
    if (!batch) throw new Error('Batch not found');

    const mapping = store.getMapping(batch.mappingId);
    if (!mapping) throw new Error('Mapping not found');

    store.updateBatch(batchId, { status: SyncStatus.VALIDATING });

    const rows = store.getRowsByBatchId(batchId);
    let validCount = 0;
    let invalidCount = 0;

    for (const row of rows) {
      const { valid, errors } = this.validateRow(row.rawData, mapping.validationRules, mapping.fieldMappings);
      const transformedData = this.transformRow(row.rawData, mapping.fieldMappings);

      if (valid) {
        validCount++;
        store.updateRow(row.id, {
          status: RowStatus.VALID,
          transformedData,
          validationErrors: undefined
        });
      } else {
        invalidCount++;
        store.updateRow(row.id, {
          status: RowStatus.INVALID,
          transformedData,
          validationErrors: errors
        });
      }
    }

    store.updateBatch(batchId, {
      status: SyncStatus.VALIDATED,
      validRows: validCount,
      invalidRows: invalidCount
    });
  }

  async processBatch(batchId: string): Promise<void> {
    const batch = store.getBatch(batchId);
    if (!batch) throw new Error('Batch not found');

    const mapping = store.getMapping(batch.mappingId);
    if (!mapping) throw new Error('Mapping not found');

    store.updateBatch(batchId, {
      status: SyncStatus.PROCESSING,
      startedAt: new Date()
    });

    const rows = store.getRowsByBatchId(batchId).filter(r =>
      r.status === RowStatus.VALID || r.status === RowStatus.FAILED
    );

    let successCount = batch.successRows;
    let failedCount = batch.failedRows;

    for (const row of rows) {
      try {
        store.updateRow(row.id, { status: RowStatus.PROCESSING });

        const response = await axios({
          method: mapping.method,
          url: mapping.endpoint,
          headers: mapping.headers,
          data: row.transformedData
        });

        successCount++;
        store.updateRow(row.id, {
          status: RowStatus.SUCCESS,
          apiRequest: row.transformedData,
          apiResponse: response.data,
          syncedAt: new Date(),
          retryCount: row.retryCount + 1
        });
      } catch (error: any) {
        failedCount++;
        store.updateRow(row.id, {
          status: RowStatus.FAILED,
          apiRequest: row.transformedData,
          apiResponse: error.response?.data,
          errorMessage: error.message,
          retryCount: row.retryCount + 1
        });
      }
    }

    const finalStatus = failedCount > 0
      ? (successCount > 0 ? SyncStatus.PARTIAL_SUCCESS : SyncStatus.FAILED)
      : SyncStatus.SUCCESS;

    store.updateBatch(batchId, {
      status: finalStatus,
      successRows: successCount,
      failedRows: failedCount,
      completedAt: new Date()
    });
  }

  async retryFailedRows(batchId: string, rowIds?: string[]): Promise<void> {
    const batch = store.getBatch(batchId);
    if (!batch) throw new Error('Batch not found');

    let rows = store.getRowsByBatchId(batchId).filter(r => r.status === RowStatus.FAILED);
    
    if (rowIds && rowIds.length > 0) {
      rows = rows.filter(r => rowIds.includes(r.id));
    }

    for (const row of rows) {
      store.updateRow(row.id, { status: RowStatus.VALID });
    }

    await this.processBatch(batchId);
  }

  generateReport(batchId: string) {
    const batch = store.getBatch(batchId);
    if (!batch) throw new Error('Batch not found');

    const rows = store.getRowsByBatchId(batchId);

    return {
      batchId,
      summary: {
        total: batch.totalRows,
        valid: batch.validRows,
        invalid: batch.invalidRows,
        success: batch.successRows,
        failed: batch.failedRows
      },
      details: rows.map(row => ({
        rowNumber: row.rowNumber,
        status: row.status,
        rawData: row.rawData,
        errors: row.validationErrors,
        errorMessage: row.errorMessage,
        apiResponse: row.apiResponse
      })),
      generatedAt: new Date()
    };
  }
}

export const syncEngine = new SyncEngine();
