"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.importService = exports.ImportService = void 0;
const fs = __importStar(require("fs"));
const csv_parser_1 = __importDefault(require("csv-parser"));
const stream_1 = require("stream");
const uuid_1 = require("uuid");
const dataStore_1 = require("../store/dataStore");
class ImportService {
    async parseMaintenanceCsv(filePath) {
        return new Promise((resolve, reject) => {
            const records = [];
            const cableCarMap = new Map();
            fs.createReadStream(filePath)
                .pipe((0, csv_parser_1.default)())
                .on('data', (row) => {
                const cableCarId = row.cableCarId || row.缆车编号;
                if (!cableCarId)
                    return;
                if (!cableCarMap.has(cableCarId)) {
                    cableCarMap.set(cableCarId, {
                        cableCarId,
                        maintenanceDate: row.maintenanceDate || row.检修日期 || new Date().toISOString().split('T')[0],
                        maintenanceType: row.maintenanceType || row.检修类型 || 'regular',
                        inspector: row.inspector || row.检查员 || '',
                        remarks: row.remarks || row.备注 || '',
                        items: [],
                    });
                }
                const record = cableCarMap.get(cableCarId);
                const item = {
                    itemCode: row.itemCode || row.项目代码 || (0, uuid_1.v4)().slice(0, 8),
                    itemName: row.itemName || row.项目名称 || '',
                    isKeyItem: (row.isKeyItem || row.是否关键项 || 'false').toString().toLowerCase() === 'true',
                    inspectionResult: (row.inspectionResult || row.检查结果 || 'pass'),
                    signedBy: row.signedBy || row.签字人 || undefined,
                    signedAt: row.signedAt || row.签字时间 || undefined,
                };
                record.items.push(item);
            })
                .on('end', () => {
                for (const data of cableCarMap.values()) {
                    const record = dataStore_1.dataStore.addMaintenanceRecord(data);
                    records.push(record);
                }
                resolve(records);
            })
                .on('error', reject);
        });
    }
    async parseMaintenanceCsvBuffer(buffer) {
        return new Promise((resolve, reject) => {
            const records = [];
            const cableCarMap = new Map();
            const stream = stream_1.Readable.from(buffer.toString());
            stream
                .pipe((0, csv_parser_1.default)())
                .on('data', (row) => {
                const cableCarId = row.cableCarId || row.缆车编号;
                if (!cableCarId)
                    return;
                if (!cableCarMap.has(cableCarId)) {
                    cableCarMap.set(cableCarId, {
                        cableCarId,
                        maintenanceDate: row.maintenanceDate || row.检修日期 || new Date().toISOString().split('T')[0],
                        maintenanceType: row.maintenanceType || row.检修类型 || 'regular',
                        inspector: row.inspector || row.检查员 || '',
                        remarks: row.remarks || row.备注 || '',
                        items: [],
                    });
                }
                const record = cableCarMap.get(cableCarId);
                const item = {
                    itemCode: row.itemCode || row.项目代码 || (0, uuid_1.v4)().slice(0, 8),
                    itemName: row.itemName || row.项目名称 || '',
                    isKeyItem: (row.isKeyItem || row.是否关键项 || 'false').toString().toLowerCase() === 'true',
                    inspectionResult: (row.inspectionResult || row.检查结果 || 'pass'),
                    signedBy: row.signedBy || row.签字人 || undefined,
                    signedAt: row.signedAt || row.签字时间 || undefined,
                };
                record.items.push(item);
            })
                .on('end', () => {
                for (const data of cableCarMap.values()) {
                    const record = dataStore_1.dataStore.addMaintenanceRecord(data);
                    records.push(record);
                }
                resolve(records);
            })
                .on('error', reject);
        });
    }
    async parseSensorJson(filePath) {
        const content = fs.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(content);
        const sensorArray = Array.isArray(data) ? data : [data];
        const records = [];
        for (const item of sensorArray) {
            const record = dataStore_1.dataStore.addSensorData({
                cableCarId: item.cableCarId || item.缆车编号,
                sensorType: item.sensorType || item.传感器类型 || 'unknown',
                sensorId: item.sensorId || item.传感器ID || (0, uuid_1.v4)().slice(0, 8),
                readings: item.readings || item.读数 || [],
                trialRunDuration: item.trialRunDuration || item.试运行时长,
                trialRunPassed: item.trialRunPassed !== undefined ? item.trialRunPassed : item.试运行是否通过,
                collectedAt: item.collectedAt || item.采集时间 || new Date().toISOString(),
            });
            records.push(record);
        }
        return records;
    }
    async parseSensorJsonBuffer(buffer) {
        const content = buffer.toString('utf-8');
        const data = JSON.parse(content);
        const sensorArray = Array.isArray(data) ? data : [data];
        const records = [];
        for (const item of sensorArray) {
            const record = dataStore_1.dataStore.addSensorData({
                cableCarId: item.cableCarId || item.缆车编号,
                sensorType: item.sensorType || item.传感器类型 || 'unknown',
                sensorId: item.sensorId || item.传感器ID || (0, uuid_1.v4)().slice(0, 8),
                readings: item.readings || item.读数 || [],
                trialRunDuration: item.trialRunDuration || item.试运行时长,
                trialRunPassed: item.trialRunPassed !== undefined ? item.trialRunPassed : item.试运行是否通过,
                collectedAt: item.collectedAt || item.采集时间 || new Date().toISOString(),
            });
            records.push(record);
        }
        return records;
    }
    async parseApprovalCsv(filePath) {
        return new Promise((resolve, reject) => {
            const records = [];
            fs.createReadStream(filePath)
                .pipe((0, csv_parser_1.default)())
                .on('data', (row) => {
                const record = dataStore_1.dataStore.addApprovalRecord({
                    cableCarId: row.cableCarId || row.缆车编号,
                    approvalType: (row.approvalType || row.审批类型 || 'release'),
                    applicant: row.applicant || row.申请人 || '',
                    approver: row.approver || row.审批人 || undefined,
                    approvedAt: row.approvedAt || row.审批时间 || undefined,
                    status: (row.status || row.状态 || 'pending'),
                    validFrom: row.validFrom || row.有效期开始 || undefined,
                    validTo: row.validTo || row.有效期结束 || undefined,
                    remarks: row.remarks || row.备注 || undefined,
                    source: 'csv',
                });
                records.push(record);
            })
                .on('end', () => resolve(records))
                .on('error', reject);
        });
    }
    async parseApprovalCsvBuffer(buffer) {
        return new Promise((resolve, reject) => {
            const records = [];
            const stream = stream_1.Readable.from(buffer.toString());
            stream
                .pipe((0, csv_parser_1.default)())
                .on('data', (row) => {
                const record = dataStore_1.dataStore.addApprovalRecord({
                    cableCarId: row.cableCarId || row.缆车编号,
                    approvalType: (row.approvalType || row.审批类型 || 'release'),
                    applicant: row.applicant || row.申请人 || '',
                    approver: row.approver || row.审批人 || undefined,
                    approvedAt: row.approvedAt || row.审批时间 || undefined,
                    status: (row.status || row.状态 || 'pending'),
                    validFrom: row.validFrom || row.有效期开始 || undefined,
                    validTo: row.validTo || row.有效期结束 || undefined,
                    remarks: row.remarks || row.备注 || undefined,
                    source: 'csv',
                });
                records.push(record);
            })
                .on('end', () => resolve(records))
                .on('error', reject);
        });
    }
    async batchImport(maintenanceBuffer, sensorBuffer, approvalBuffer) {
        let maintenanceCount = 0;
        let sensorCount = 0;
        let approvalCount = 0;
        if (maintenanceBuffer) {
            const records = await this.parseMaintenanceCsvBuffer(maintenanceBuffer);
            maintenanceCount = records.length;
        }
        if (sensorBuffer) {
            const records = await this.parseSensorJsonBuffer(sensorBuffer);
            sensorCount = records.length;
        }
        if (approvalBuffer) {
            const records = await this.parseApprovalCsvBuffer(approvalBuffer);
            approvalCount = records.length;
        }
        return dataStore_1.dataStore.addBatchImport({
            maintenanceCount,
            sensorCount,
            approvalCount,
        });
    }
}
exports.ImportService = ImportService;
exports.importService = new ImportService();
//# sourceMappingURL=importService.js.map