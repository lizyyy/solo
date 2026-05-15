"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BatchService = void 0;
const uuid_1 = require("uuid");
const database_1 = require("../database");
const validationService_1 = __importDefault(require("./validationService"));
class BatchService {
    static async previewBatchValidation(businessNos, operator) {
        const operationId = (0, uuid_1.v4)();
        const now = new Date();
        const { inWindow, windowType, windowStart, windowEnd } = validationService_1.default.isInFreezeWindow(now);
        const willSuccess = [];
        const willFail = [];
        for (const businessNo of businessNos) {
            const sampleExists = await new Promise((resolve) => {
                (0, database_1.getDb)().get('SELECT 1 FROM lab_samples WHERE business_no = ?', [businessNo], (err, row) => {
                    resolve(!!row);
                });
            });
            if (!sampleExists) {
                willFail.push({ businessNo, reason: '样本不存在' });
            }
            else if (!inWindow) {
                willFail.push({ businessNo, reason: `不在冻结窗口内，当前窗口类型: ${windowType}` });
            }
            else {
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
        await new Promise((resolve) => {
            (0, database_1.getDb)().run(`
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
    static async executeBatchValidation(operationId, operator) {
        return new Promise((resolve, reject) => {
            (0, database_1.getDb)().get('SELECT * FROM batch_operations WHERE id = ?', [operationId], async (err, row) => {
                if (err || !row) {
                    reject(new Error('批量操作不存在'));
                    return;
                }
                const previewData = JSON.parse(row.preview_data);
                const businessNos = [...previewData.willSuccess, ...previewData.willFail.map((f) => f.businessNo)];
                (0, database_1.getDb)().run('UPDATE batch_operations SET status = ?, executed_at = ? WHERE id = ?', ['executing', new Date().toISOString(), operationId]);
                const results = [];
                for (const businessNo of businessNos) {
                    const result = await validationService_1.default.validateSample(businessNo, operator);
                    results.push(result);
                }
                const successCount = results.filter(r => r.success).length;
                const failedCount = results.filter(r => !r.success).length;
                (0, database_1.getDb)().run('UPDATE batch_operations SET status = ? WHERE id = ?', ['completed', operationId]);
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
    static async getBatchOperation(operationId) {
        return new Promise((resolve) => {
            (0, database_1.getDb)().get('SELECT * FROM batch_operations WHERE id = ?', [operationId], (err, row) => {
                if (err || !row) {
                    resolve(null);
                    return;
                }
                resolve(this.mapBatchOperation(row));
            });
        });
    }
    static async listBatchOperations(params = {}) {
        const { page = 1, pageSize = 20 } = params;
        const offset = (page - 1) * pageSize;
        return new Promise((resolve, reject) => {
            (0, database_1.getDb)().get('SELECT COUNT(*) as total FROM batch_operations', [], (err, countRow) => {
                if (err)
                    reject(err);
                (0, database_1.getDb)().all(`
          SELECT * FROM batch_operations 
          ORDER BY created_at DESC
          LIMIT ? OFFSET ?
        `, [pageSize, offset], (err, rows) => {
                    if (err)
                        reject(err);
                    resolve({
                        total: countRow.total,
                        items: rows.map(r => this.mapBatchOperation(r))
                    });
                });
            });
        });
    }
    static mapBatchOperation(row) {
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
exports.BatchService = BatchService;
exports.default = BatchService;
