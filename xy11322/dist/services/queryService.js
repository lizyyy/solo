"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.queryService = exports.QueryService = void 0;
const json2csv_1 = require("json2csv");
const fs_1 = __importDefault(require("fs"));
const store_1 = require("../store");
class QueryService {
    queryRecords(filter) {
        let records = store_1.dataStore.getAllRecords();
        if (filter.operator) {
            records = records.filter(r => r.operator === filter.operator);
        }
        if (filter.startDate) {
            records = records.filter(r => r.startTime >= filter.startDate);
        }
        if (filter.endDate) {
            records = records.filter(r => r.endTime <= filter.endDate);
        }
        if (filter.status && filter.status.length > 0) {
            records = records.filter(r => filter.status.includes(r.status));
        }
        if (filter.exceptionType && filter.exceptionType.length > 0) {
            records = records.filter(r => r.exceptions.some(e => filter.exceptionType.includes(e.type)));
        }
        if (filter.tractorNo) {
            records = records.filter(r => r.tractorNo === filter.tractorNo);
        }
        if (filter.operatorName) {
            records = records.filter(r => r.operatorName.includes(filter.operatorName));
        }
        if (filter.isBilled !== undefined) {
            records = records.filter(r => r.isBilled === filter.isBilled);
        }
        return records.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }
    getRecordById(id) {
        return store_1.dataStore.getRecordById(id);
    }
    getRecordByRecordNo(recordNo) {
        return store_1.dataStore.getRecordByRecordNo(recordNo);
    }
    generateReport(filter, operator) {
        const records = this.queryRecords(filter);
        const summary = {
            totalRecords: records.length,
            totalAmount: records.reduce((sum, r) => sum + r.finalAmount, 0),
            validRecords: records.filter(r => r.status === 'valid').length,
            invalidRecords: records.filter(r => r.status === 'invalid').length,
            billedRecords: records.filter(r => r.isBilled).length,
            pendingRecords: records.filter(r => r.status === 'pending').length,
            totalExceptions: records.reduce((sum, r) => sum + r.exceptions.length, 0),
        };
        const report = {
            summary,
            records,
            generatedAt: new Date(),
            generatedBy: operator,
            filters: filter,
        };
        store_1.dataStore.addAuditLog('generate_report', operator, {
            filter,
            recordCount: records.length,
        });
        return report;
    }
    exportToCSV(report, filePath) {
        const records = report.records.map(r => ({
            记录编号: r.recordNo,
            操作人: r.operator,
            拖拉机号: r.tractorNo,
            机手姓名: r.operatorName,
            开始时间: r.startTime.toISOString(),
            结束时间: r.endTime.toISOString(),
            工作小时: r.workHours,
            作业面积: r.workArea,
            油耗: r.fuelConsumption,
            计费类型: r.billingType,
            小时单价: r.hourlyRate,
            面积单价: r.areaRate,
            油价: r.fuelRate,
            最低收费: r.minimumCharge,
            状态: this.getStatusText(r.status),
            计算金额: r.calculatedAmount,
            最终金额: r.finalAmount,
            是否已结算: r.isBilled ? '是' : '否',
            结算时间: r.billedAt?.toISOString() || '',
            异常数量: r.exceptions.length,
            异常信息: r.exceptions.map(e => `${e.type}: ${e.message}`).join('; '),
            创建时间: r.createdAt.toISOString(),
            创建人: r.createdBy,
        }));
        const parser = new json2csv_1.Parser();
        const csv = parser.parse(records);
        fs_1.default.writeFileSync(filePath, csv, 'utf-8');
        store_1.dataStore.addAuditLog('export_csv', report.generatedBy, {
            filePath,
            recordCount: records.length,
        });
    }
    exportToJSON(report, filePath) {
        fs_1.default.writeFileSync(filePath, JSON.stringify(report, null, 2), 'utf-8');
        store_1.dataStore.addAuditLog('export_json', report.generatedBy, {
            filePath,
            recordCount: report.records.length,
        });
    }
    getStatusText(status) {
        const statusMap = {
            pending: '待处理',
            valid: '有效',
            invalid: '无效',
            billed: '已结算',
            reviewed: '已复核',
        };
        return statusMap[status] || status;
    }
    getStatistics(filter) {
        const records = filter ? this.queryRecords(filter) : store_1.dataStore.getAllRecords();
        return {
            totalRecords: records.length,
            totalAmount: records.reduce((sum, r) => sum + r.finalAmount, 0),
            byStatus: this.groupByStatus(records),
            byBillingType: this.groupByBillingType(records),
            byOperator: this.groupByOperator(records),
        };
    }
    groupByStatus(records) {
        return records.reduce((acc, r) => {
            acc[r.status] = (acc[r.status] || 0) + 1;
            return acc;
        }, {});
    }
    groupByBillingType(records) {
        return records.reduce((acc, r) => {
            acc[r.billingType] = (acc[r.billingType] || 0) + 1;
            return acc;
        }, {});
    }
    groupByOperator(records) {
        return records.reduce((acc, r) => {
            acc[r.operator] = (acc[r.operator] || 0) + 1;
            return acc;
        }, {});
    }
}
exports.QueryService = QueryService;
exports.queryService = new QueryService();
