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
const DataStore_1 = require("../store/DataStore");
const types_1 = require("../types");
const stream_1 = require("stream");
class ImportService {
    async importAppointmentsFromCSV(filePath, batchId) {
        const results = [];
        const errors = [];
        let imported = 0;
        let failed = 0;
        return new Promise((resolve) => {
            fs.createReadStream(filePath)
                .pipe((0, csv_parser_1.default)())
                .on('data', (data) => results.push(data))
                .on('end', async () => {
                const importedRecords = [];
                for (let i = 0; i < results.length; i++) {
                    try {
                        const row = results[i];
                        const record = await this.processAppointmentRow(row, batchId, i + 1);
                        importedRecords.push(record);
                        imported++;
                    }
                    catch (error) {
                        failed++;
                        errors.push(`第 ${i + 1} 行: ${error.message}`);
                    }
                }
                resolve({
                    success: errors.length === 0,
                    total: results.length,
                    imported,
                    failed,
                    errors,
                    data: importedRecords
                });
            })
                .on('error', (error) => {
                resolve({
                    success: false,
                    total: 0,
                    imported: 0,
                    failed: 0,
                    errors: [`CSV文件读取失败: ${error.message}`],
                    data: []
                });
            });
        });
    }
    async importAppointmentsFromCSVString(csvContent, batchId) {
        const results = [];
        const errors = [];
        let imported = 0;
        let failed = 0;
        return new Promise((resolve) => {
            const stream = stream_1.Readable.from(csvContent);
            stream
                .pipe((0, csv_parser_1.default)())
                .on('data', (data) => results.push(data))
                .on('end', async () => {
                const importedRecords = [];
                for (let i = 0; i < results.length; i++) {
                    try {
                        const row = results[i];
                        const record = await this.processAppointmentRow(row, batchId, i + 1);
                        importedRecords.push(record);
                        imported++;
                    }
                    catch (error) {
                        failed++;
                        errors.push(`第 ${i + 1} 行: ${error.message}`);
                    }
                }
                resolve({
                    success: errors.length === 0,
                    total: results.length,
                    imported,
                    failed,
                    errors,
                    data: importedRecords
                });
            })
                .on('error', (error) => {
                resolve({
                    success: false,
                    total: 0,
                    imported: 0,
                    failed: 0,
                    errors: [`CSV解析失败: ${error.message}`],
                    data: []
                });
            });
        });
    }
    async processAppointmentRow(row, batchId, rowNumber) {
        const childName = row['儿童姓名'] || row['childName'];
        const childIdCard = row['身份证号'] || row['idCard'];
        const vaccineCode = row['疫苗编码'] || row['vaccineCode'];
        const vaccineName = row['疫苗名称'] || row['vaccineName'];
        const doseNumber = parseInt(row['剂次'] || row['doseNumber'] || '1');
        const appointmentDate = row['预约日期'] || row['appointmentDate'];
        if (!childName || !childIdCard || !vaccineCode) {
            throw new Error(`缺少必要字段: 儿童姓名、身份证号、疫苗编码`);
        }
        const healthConditionsRaw = row['健康状况'] || row['healthConditions'] || '';
        const healthConditions = healthConditionsRaw
            ? healthConditionsRaw.split(/[,，;；]/).map((c) => c.trim()).filter((c) => c)
            : [];
        let childId;
        let childProfile = DataStore_1.dataStore.getChildProfileByIdCard(childIdCard);
        if (!childProfile) {
            childProfile = DataStore_1.dataStore.createChildProfile({
                name: childName,
                idCard: childIdCard,
                birthDate: row['出生日期'] || row['birthDate'] || '',
                gender: (row['性别'] || row['gender'] || 'male'),
                guardianName: row['监护人姓名'] || row['guardianName'] || '',
                guardianPhone: row['监护人电话'] || row['guardianPhone'] || '',
                address: row['住址'] || row['address'] || '',
                healthConditions
            });
        }
        else if (healthConditions.length > 0 && childProfile.healthConditions.length === 0) {
            childProfile = DataStore_1.dataStore.updateChildProfile(childProfile.id, { healthConditions }) || childProfile;
        }
        childId = childProfile.id;
        const record = DataStore_1.dataStore.createAppointmentRecord({
            batchId,
            childId,
            childName,
            childIdCard,
            vaccineCode,
            vaccineName: vaccineName || '',
            doseNumber,
            appointmentDate: appointmentDate || new Date().toISOString().split('T')[0],
            status: types_1.RecordStatus.PENDING
        });
        DataStore_1.dataStore.addOperationLog(record.id, {
            operationType: types_1.OperationType.IMPORT,
            operator: 'system',
            reason: `从CSV导入，行号: ${rowNumber}`,
            previousStatus: undefined,
            newStatus: types_1.RecordStatus.PENDING
        });
        return record;
    }
    importVaccineInventoryFromJSON(jsonContent) {
        try {
            const data = JSON.parse(jsonContent);
            const inventoryList = Array.isArray(data) ? data : [data];
            const errors = [];
            const importedInventories = [];
            for (let i = 0; i < inventoryList.length; i++) {
                try {
                    const item = inventoryList[i];
                    const inventory = DataStore_1.dataStore.createVaccineInventory({
                        vaccineCode: item.vaccineCode || item['疫苗编码'],
                        vaccineName: item.vaccineName || item['疫苗名称'],
                        manufacturer: item.manufacturer || item['生产厂家'] || '',
                        batchNo: item.batchNo || item['批号'] || '',
                        expirationDate: item.expirationDate || item['有效期'] || '',
                        quantity: parseInt(item.quantity || item['数量'] || '0'),
                        availableQuantity: parseInt(item.availableQuantity || item['可用数量'] || item.quantity || '0'),
                        minimumAgeMonths: parseInt(item.minimumAgeMonths || item['最小月龄'] || '0'),
                        intervalDays: parseInt(item.intervalDays || item['间隔天数'] || '30')
                    });
                    importedInventories.push(inventory);
                }
                catch (error) {
                    errors.push(`第 ${i + 1} 条: ${error.message}`);
                }
            }
            return {
                success: errors.length === 0,
                total: inventoryList.length,
                imported: importedInventories.length,
                failed: errors.length,
                errors,
                data: importedInventories
            };
        }
        catch (error) {
            return {
                success: false,
                total: 0,
                imported: 0,
                failed: 1,
                errors: [`JSON解析失败: ${error.message}`],
                data: []
            };
        }
    }
    importContraindicationRules(jsonContent) {
        try {
            const data = JSON.parse(jsonContent);
            const rulesList = Array.isArray(data) ? data : [data];
            const errors = [];
            const importedRules = [];
            for (let i = 0; i < rulesList.length; i++) {
                try {
                    const item = rulesList[i];
                    const rule = DataStore_1.dataStore.createContraindicationRule({
                        vaccineCode: item.vaccineCode || item['疫苗编码'],
                        vaccineName: item.vaccineName || item['疫苗名称'] || '',
                        condition: item.condition || item['条件'],
                        description: item.description || item['描述'] || '',
                        severity: (item.severity || item['严重程度'] || 'medium')
                    });
                    importedRules.push(rule);
                }
                catch (error) {
                    errors.push(`第 ${i + 1} 条: ${error.message}`);
                }
            }
            return {
                success: errors.length === 0,
                total: rulesList.length,
                imported: importedRules.length,
                failed: errors.length,
                errors,
                data: importedRules
            };
        }
        catch (error) {
            return {
                success: false,
                total: 0,
                imported: 0,
                failed: 1,
                errors: [`JSON解析失败: ${error.message}`],
                data: []
            };
        }
    }
}
exports.ImportService = ImportService;
exports.importService = new ImportService();
