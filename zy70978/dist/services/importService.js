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
const dayjs_1 = __importDefault(require("dayjs"));
const dataStore_1 = require("../store/dataStore");
class ImportService {
    async importRentalOrdersFromCSV(filePath) {
        const results = [];
        const errors = [];
        let rowCount = 0;
        return new Promise((resolve, reject) => {
            fs.createReadStream(filePath)
                .pipe((0, csv_parser_1.default)())
                .on('data', (data) => {
                rowCount++;
                try {
                    const order = this.parseRentalOrder(data, rowCount);
                    results.push(order);
                }
                catch (error) {
                    errors.push({ row: rowCount, message: error.message });
                }
            })
                .on('end', () => {
                results.forEach((order) => {
                    const existing = dataStore_1.dataStore.getRentalOrderByNo(order.orderNo);
                    if (existing) {
                        dataStore_1.dataStore.updateRentalOrder(existing.id, order);
                    }
                    else {
                        dataStore_1.dataStore.addRentalOrder(order);
                    }
                });
                resolve({
                    totalRecords: rowCount,
                    successful: results.length,
                    failed: errors.length,
                    errors,
                });
            })
                .on('error', reject);
        });
    }
    async importRentalOrdersFromCSVBuffer(buffer) {
        const results = [];
        const errors = [];
        let rowCount = 0;
        return new Promise((resolve) => {
            const stream = stream_1.Readable.from(buffer.toString());
            stream
                .pipe((0, csv_parser_1.default)())
                .on('data', (data) => {
                rowCount++;
                try {
                    const order = this.parseRentalOrder(data, rowCount);
                    results.push(order);
                }
                catch (error) {
                    errors.push({ row: rowCount, message: error.message });
                }
            })
                .on('end', () => {
                results.forEach((order) => {
                    const existing = dataStore_1.dataStore.getRentalOrderByNo(order.orderNo);
                    if (existing) {
                        dataStore_1.dataStore.updateRentalOrder(existing.id, order);
                    }
                    else {
                        dataStore_1.dataStore.addRentalOrder(order);
                    }
                });
                resolve({
                    totalRecords: rowCount,
                    successful: results.length,
                    failed: errors.length,
                    errors,
                });
            });
        });
    }
    parseRentalOrder(data, rowNum) {
        const requiredFields = [
            'orderNo',
            'tenantName',
            'tenantId',
            'equipmentSerialNo',
            'equipmentName',
            'startDate',
            'endDate',
            'monthlyRent',
            'depositAmount',
            'actualDepositPaid',
        ];
        for (const field of requiredFields) {
            if (!data[field]) {
                throw new Error(`缺少必填字段: ${field}`);
            }
        }
        const startDate = (0, dayjs_1.default)(data.startDate);
        const endDate = (0, dayjs_1.default)(data.endDate);
        if (!startDate.isValid()) {
            throw new Error(`开始日期格式无效: ${data.startDate}`);
        }
        if (!endDate.isValid()) {
            throw new Error(`结束日期格式无效: ${data.endDate}`);
        }
        const monthlyRent = parseFloat(data.monthlyRent);
        const depositAmount = parseFloat(data.depositAmount);
        const actualDepositPaid = parseFloat(data.actualDepositPaid);
        if (isNaN(monthlyRent)) {
            throw new Error(`月租金必须是数字: ${data.monthlyRent}`);
        }
        if (isNaN(depositAmount)) {
            throw new Error(`押金金额必须是数字: ${data.depositAmount}`);
        }
        if (isNaN(actualDepositPaid)) {
            throw new Error(`实际支付押金必须是数字: ${data.actualDepositPaid}`);
        }
        return {
            orderNo: data.orderNo.trim(),
            tenantName: data.tenantName.trim(),
            tenantId: data.tenantId.trim(),
            equipmentSerialNo: data.equipmentSerialNo.trim(),
            equipmentName: data.equipmentName.trim(),
            startDate: startDate.format('YYYY-MM-DD'),
            endDate: endDate.format('YYYY-MM-DD'),
            actualReturnDate: data.actualReturnDate
                ? (0, dayjs_1.default)(data.actualReturnDate).format('YYYY-MM-DD')
                : undefined,
            monthlyRent,
            depositAmount,
            actualDepositPaid,
            status: data.status || 'pending',
            createdAt: (0, dayjs_1.default)().toISOString(),
            notes: data.notes,
        };
    }
    async importRepairRecordsFromJSON(filePath) {
        const content = fs.readFileSync(filePath, 'utf-8');
        return this.importRepairRecordsFromJSONContent(content);
    }
    async importRepairRecordsFromJSONContent(content) {
        const errors = [];
        let records = [];
        try {
            const parsed = JSON.parse(content);
            records = Array.isArray(parsed) ? parsed : [parsed];
        }
        catch (error) {
            throw new Error(`JSON 解析失败: ${error.message}`);
        }
        const validRecords = [];
        records.forEach((data, index) => {
            try {
                const record = this.parseRepairRecord(data, index + 1);
                validRecords.push(record);
            }
            catch (error) {
                errors.push({ row: index + 1, message: error.message });
            }
        });
        validRecords.forEach((record) => {
            dataStore_1.dataStore.addRepairRecord(record);
        });
        return {
            totalRecords: records.length,
            successful: validRecords.length,
            failed: errors.length,
            errors,
        };
    }
    parseRepairRecord(data, rowNum) {
        const requiredFields = [
            'repairNo',
            'equipmentSerialNo',
            'reportDate',
            'repairDate',
            'repairContent',
            'repairCost',
            'liability',
            'reporter',
        ];
        for (const field of requiredFields) {
            if (data[field] === undefined || data[field] === null || data[field] === '') {
                throw new Error(`第 ${rowNum} 条记录缺少必填字段: ${field}`);
            }
        }
        const reportDate = (0, dayjs_1.default)(data.reportDate);
        const repairDate = (0, dayjs_1.default)(data.repairDate);
        if (!reportDate.isValid()) {
            throw new Error(`第 ${rowNum} 条记录报修日期格式无效: ${data.reportDate}`);
        }
        if (!repairDate.isValid()) {
            throw new Error(`第 ${rowNum} 条记录维修日期格式无效: ${data.repairDate}`);
        }
        const repairCost = parseFloat(data.repairCost);
        if (isNaN(repairCost)) {
            throw new Error(`第 ${rowNum} 条记录维修费用必须是数字: ${data.repairCost}`);
        }
        const validLiabilities = ['tenant', 'owner', 'natural_wear', 'pending'];
        if (!validLiabilities.includes(data.liability)) {
            throw new Error(`第 ${rowNum} 条记录责任归属无效，必须是: ${validLiabilities.join(', ')}`);
        }
        return {
            repairNo: data.repairNo.trim(),
            equipmentSerialNo: data.equipmentSerialNo.trim(),
            reportDate: reportDate.format('YYYY-MM-DD'),
            repairDate: repairDate.format('YYYY-MM-DD'),
            repairContent: data.repairContent.trim(),
            repairCost,
            liability: data.liability,
            reporter: data.reporter.trim(),
            isBoundToOrder: !!data.boundOrderNo,
            boundOrderNo: data.boundOrderNo?.trim(),
            notes: data.notes,
        };
    }
    async importDepositRules(rules) {
        const errors = [];
        const validRules = [];
        rules.forEach((rule, index) => {
            try {
                this.validateDepositRule(rule, index + 1);
                validRules.push(rule);
            }
            catch (error) {
                errors.push({ row: index + 1, message: error.message });
            }
        });
        validRules.forEach((rule) => {
            dataStore_1.dataStore.addDepositRule(rule);
        });
        return {
            totalRecords: rules.length,
            successful: validRules.length,
            failed: errors.length,
            errors,
        };
    }
    validateDepositRule(rule, rowNum) {
        if (!rule.ruleName || !rule.ruleName.trim()) {
            throw new Error(`第 ${rowNum} 条规则缺少规则名称`);
        }
        if (rule.depositRate < 0 || rule.depositRate > 1) {
            throw new Error(`第 ${rowNum} 条规则押金比例必须在 0-1 之间`);
        }
        if (rule.minDeposit < 0) {
            throw new Error(`第 ${rowNum} 条规则最低押金不能为负数`);
        }
        if (rule.overduePenaltyRate < 0) {
            throw new Error(`第 ${rowNum} 条规则逾期罚息比例不能为负数`);
        }
        if (rule.overdueGraceDays < 0) {
            throw new Error(`第 ${rowNum} 条规则逾期宽限天数不能为负数`);
        }
    }
}
exports.ImportService = ImportService;
exports.importService = new ImportService();
