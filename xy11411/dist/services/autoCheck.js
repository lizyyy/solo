"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutoCheckService = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const database_1 = require("./database");
const fileUtils_1 = require("../utils/fileUtils");
const types_1 = require("../models/types");
class AutoCheckService {
    constructor(stateManager) {
        this.stateManager = stateManager;
    }
    async checkDuplicateImport(filePath) {
        const fileHash = (0, fileUtils_1.calculateFileHash)(filePath);
        const existingBatch = await database_1.dbService.getImportBatchByHash(fileHash);
        if (existingBatch) {
            return {
                isDuplicate: true,
                existingBatch,
                message: `文件已在 ${new Date(existingBatch.timestamp).toLocaleString('zh-CN')} 导入过，批次号: ${existingBatch.id}`
            };
        }
        return {
            isDuplicate: false,
            message: '文件未导入过'
        };
    }
    async checkPermission(action, resource) {
        const permissionMap = {
            'import': types_1.PermissionLevel.OPERATOR,
            'check': types_1.PermissionLevel.OPERATOR,
            'fix': types_1.PermissionLevel.MANAGER,
            'export': types_1.PermissionLevel.OPERATOR,
            'delete': types_1.PermissionLevel.MANAGER,
            'admin': types_1.PermissionLevel.ADMIN
        };
        const required = permissionMap[action] || types_1.PermissionLevel.VIEWER;
        return this.stateManager.hasPermission(required);
    }
    async validateRecordIntegrity(record) {
        const issues = [];
        const stateChanges = record.stateChanges;
        if (stateChanges.length > 0) {
            let prevStatus = stateChanges[0].fromStatus;
            for (const change of stateChanges) {
                if (change.fromStatus !== prevStatus) {
                    issues.push(`状态变更不连续: 期望从 ${prevStatus} 变更, 实际从 ${change.fromStatus} 变更`);
                }
                prevStatus = change.toStatus;
            }
            if (stateChanges[stateChanges.length - 1].toStatus !== record.status) {
                issues.push(`最终状态不匹配: 记录状态为 ${record.status}, 最后一次变更为 ${stateChanges[stateChanges.length - 1].toStatus}`);
            }
        }
        const rawContentHash = (0, fileUtils_1.calculateContentHash)(JSON.stringify(record.rawData.rawContent));
        const storedHash = record.rawData.fileHash;
        if (rawContentHash && storedHash && rawContentHash !== storedHash) {
            issues.push('原始内容哈希校验失败，数据可能被篡改');
        }
        return {
            valid: issues.length === 0,
            issues
        };
    }
    async checkDataConsistency() {
        const inconsistencies = [];
        const allRecords = await database_1.dbService.getAllRecords({ includeDeleted: true });
        for (const record of allRecords) {
            const { valid, issues } = await this.validateRecordIntegrity(record);
            if (!valid) {
                for (const issue of issues) {
                    inconsistencies.push({
                        type: 'integrity',
                        recordId: record.id,
                        message: issue
                    });
                }
            }
        }
        const records = await database_1.dbService.getAllRecords();
        const exportDir = database_1.dbService.getConfig().exportDir;
        if (fs_1.default.existsSync(exportDir)) {
            const exportFiles = fs_1.default.readdirSync(exportDir).filter(f => f.endsWith('.json'));
            for (const exportFile of exportFiles) {
                try {
                    const exportPath = path_1.default.join(exportDir, exportFile);
                    const exportData = JSON.parse(fs_1.default.readFileSync(exportPath, 'utf-8'));
                    if (exportData.records && Array.isArray(exportData.records)) {
                        for (const exportedRecord of exportData.records) {
                            const currentRecord = records.find(r => r.id === exportedRecord.id);
                            if (currentRecord) {
                                if (currentRecord.status !== exportedRecord.status) {
                                    inconsistencies.push({
                                        type: 'export_consistency',
                                        recordId: exportedRecord.id,
                                        message: `导出文件 ${exportFile} 中的记录状态与数据库不一致: 导出=${exportedRecord.status}, 当前=${currentRecord.status}`
                                    });
                                }
                            }
                        }
                    }
                }
                catch (e) {
                    inconsistencies.push({
                        type: 'export_file_error',
                        message: `导出文件 ${exportFile} 解析失败: ${e.message}`
                    });
                }
            }
        }
        return {
            consistent: inconsistencies.length === 0,
            inconsistencies
        };
    }
    async detectAnomalies(record) {
        const anomalies = [];
        if (record.quantity !== undefined && record.quantity < 0) {
            anomalies.push({
                type: 'negative_quantity',
                severity: 'high',
                message: `数量为负数: ${record.quantity}`,
                details: { quantity: record.quantity }
            });
        }
        if (record.price !== undefined && record.price < 0) {
            anomalies.push({
                type: 'negative_price',
                severity: 'high',
                message: `单价为负数: ${record.price}`,
                details: { price: record.price }
            });
        }
        if (record.quantity !== undefined && record.quantity > 10000) {
            anomalies.push({
                type: 'abnormal_quantity',
                severity: 'medium',
                message: `数量异常大: ${record.quantity}`,
                details: { quantity: record.quantity, threshold: 10000 }
            });
        }
        if (record.totalAmount !== undefined && record.quantity !== undefined && record.price !== undefined) {
            const calculated = record.quantity * record.price;
            const diff = Math.abs(calculated - record.totalAmount);
            if (diff > 0.01) {
                anomalies.push({
                    type: 'amount_mismatch',
                    severity: 'medium',
                    message: `总金额不匹配: 计算值=${calculated.toFixed(2)}, 记录值=${record.totalAmount.toFixed(2)}`,
                    details: {
                        calculated,
                        recorded: record.totalAmount,
                        difference: diff
                    }
                });
            }
        }
        if (record.expiryDate && record.productionDate) {
            const expiry = new Date(record.expiryDate);
            const production = new Date(record.productionDate);
            if (expiry < production) {
                anomalies.push({
                    type: 'expiry_before_production',
                    severity: 'high',
                    message: '保质期早于生产日期',
                    details: {
                        productionDate: record.productionDate,
                        expiryDate: record.expiryDate
                    }
                });
            }
        }
        return anomalies;
    }
    async runAllChecks() {
        const allRecords = await database_1.dbService.getAllRecords();
        const consistencyResult = await this.checkDataConsistency();
        let anomalyCount = 0;
        const anomalyRecords = [];
        for (const record of allRecords) {
            const anomalies = await this.detectAnomalies(record);
            if (anomalies.length > 0) {
                anomalyCount += anomalies.length;
                anomalyRecords.push(record.id);
            }
        }
        const batches = await database_1.dbService.getImportBatches(10);
        const duplicateChecks = await Promise.all(batches.slice(0, 5).map(b => ({
            batchId: b.id,
            file: b.sourceFile,
            hash: b.fileHash
        })));
        return {
            summary: {
                totalRecords: allRecords.length,
                consistentRecords: allRecords.length - anomalyRecords.length,
                inconsistentRecords: anomalyRecords.length,
                totalAnomalies: anomalyCount,
                dataConsistent: consistencyResult.consistent,
                inconsistenciesFound: consistencyResult.inconsistencies.length
            },
            details: {
                consistencyIssues: consistencyResult.inconsistencies,
                anomalyRecords,
                recentBatches: duplicateChecks
            }
        };
    }
    async verifyRestartConsistency() {
        const issues = [];
        const config = database_1.dbService.getConfig();
        if (!fs_1.default.existsSync(config.path)) {
            issues.push('数据库文件不存在');
            return { consistent: false, issues };
        }
        const requiredDirs = [config.workDir, config.importDir, config.exportDir, config.photoDir];
        for (const dir of requiredDirs) {
            if (!fs_1.default.existsSync(dir)) {
                issues.push(`工作目录不存在: ${dir}`);
            }
        }
        const records = await database_1.dbService.getAllRecords({ includeDeleted: true });
        for (const record of records) {
            if (!record.stateChanges || record.stateChanges.length === 0) {
                issues.push(`记录 ${record.id} 没有状态变更历史`);
            }
        }
        const operator = await database_1.dbService.getOperatorById('default-admin');
        if (!operator) {
            issues.push('默认管理员账户不存在');
        }
        return {
            consistent: issues.length === 0,
            issues
        };
    }
}
exports.AutoCheckService = AutoCheckService;
