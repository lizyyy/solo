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
exports.ReportService = void 0;
const XLSX = __importStar(require("xlsx"));
const dataStore_1 = __importDefault(require("../store/dataStore"));
class ReportService {
    generateSummary(batchId) {
        const batch = dataStore_1.default.getBatch(batchId);
        if (!batch) {
            throw new Error(`批次不存在: ${batchId}`);
        }
        const records = dataStore_1.default.getRecordsByBatch(batchId);
        const discrepancyBreakdown = this.countByDiscrepancyType(records);
        return {
            batchId: batch.id,
            batchName: batch.name,
            periodStart: batch.periodStart,
            periodEnd: batch.periodEnd,
            totalOrders: batch.totalRecords,
            totalAmount: this.calculateTotalAmount(records),
            matchedRate: batch.totalRecords > 0
                ? Math.round((batch.matchedCount / batch.totalRecords) * 10000) / 100
                : 0,
            statusBreakdown: this.countByStatus(records),
            discrepancyBreakdown,
            generatedAt: new Date(),
        };
    }
    generateDetails(batchId) {
        const records = dataStore_1.default.getRecordsByBatch(batchId);
        return records.map(r => this.createReportDetail(r));
    }
    createReportDetail(record) {
        return {
            recordId: record.id,
            orderNo: record.serviceOrder.orderNo,
            elderName: record.serviceOrder.elderName,
            nurseName: record.serviceOrder.nurseName,
            serviceDate: record.serviceOrder.serviceDate,
            serviceItems: record.serviceOrder.serviceItems,
            status: record.status,
            discrepancies: record.discrepancies,
            reviewRemark: record.reviewRemark,
            traceability: this.buildTraceability(record),
        };
    }
    buildTraceability(record) {
        const links = [];
        links.push({
            level: '原始数据',
            source: '服务单',
            data: `${record.serviceOrder.orderNo} - ${record.serviceOrder.elderName}`,
            timestamp: record.serviceOrder.createdAt,
        });
        if (record.matchedSchedule) {
            links.push({
                level: '原始数据',
                source: '护士排班',
                data: `${record.matchedSchedule.nurseName} - ${record.matchedSchedule.date}`,
                timestamp: new Date(),
            });
        }
        links.push({
            level: '原始数据',
            source: '老人档案',
            data: `${record.elderProfile.name} - ${record.elderProfile.careLevel}`,
            timestamp: record.elderProfile.createdAt,
        });
        links.push({
            level: '对账处理',
            source: '自动比对',
            data: `发现 ${record.discrepancies.length} 处差异`,
            timestamp: record.createdAt,
        });
        for (const log of record.auditLogs) {
            links.push({
                level: '人工处理',
                source: `${log.operator} - ${log.action}`,
                data: log.remark || log.newValue || '',
                timestamp: log.timestamp,
            });
        }
        return links.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    }
    getTraceability(recordId) {
        const record = dataStore_1.default.getReconciliationRecord(recordId);
        if (!record) {
            throw new Error(`对账记录不存在: ${recordId}`);
        }
        return this.buildTraceability(record);
    }
    getFullTraceabilityChain(recordId) {
        const record = dataStore_1.default.getReconciliationRecord(recordId);
        if (!record) {
            throw new Error(`对账记录不存在: ${recordId}`);
        }
        const links = this.buildTraceability(record);
        const lines = [];
        lines.push(`【服务单 ${record.serviceOrder.orderNo} 全链路追溯】`);
        lines.push(``);
        for (const link of links) {
            lines.push(`[${link.timestamp.toLocaleString()}]`);
            lines.push(`  层级: ${link.level}`);
            lines.push(`  来源: ${link.source}`);
            lines.push(`  内容: ${link.data}`);
            lines.push(``);
        }
        lines.push(`最终状态: ${this.getStatusText(record.status)}`);
        if (record.reviewRemark) {
            lines.push(`复核意见: ${record.reviewRemark}`);
        }
        return lines.join('\n');
    }
    exportToExcel(batchId, outputPath) {
        const summary = this.generateSummary(batchId);
        const details = this.generateDetails(batchId);
        const wb = XLSX.utils.book_new();
        const summaryData = [
            ['对账汇总报告', ''],
            ['', ''],
            ['批次名称', summary.batchName],
            ['统计周期', `${summary.periodStart} 至 ${summary.periodEnd}`],
            ['生成时间', summary.generatedAt.toLocaleString()],
            ['', ''],
            ['统计指标', ''],
            ['服务单总数', summary.totalOrders],
            ['匹配率', `${summary.matchedRate}%`],
            ['', ''],
            ['状态分布', ''],
            ...Object.entries(summary.statusBreakdown).map(([k, v]) => [this.getStatusText(k), v]),
            ['', ''],
            ['差异分布', ''],
            ...Object.entries(summary.discrepancyBreakdown).map(([k, v]) => [this.getDiscrepancyText(k), v]),
        ];
        const detailData = [
            ['记录ID', '服务单号', '老人姓名', '护士姓名', '服务日期', '服务项目', '状态', '差异数量', '复核意见'],
            ...details.map(d => [
                d.recordId,
                d.orderNo,
                d.elderName,
                d.nurseName,
                d.serviceDate,
                d.serviceItems.join(';'),
                this.getStatusText(d.status),
                d.discrepancies.length,
                d.reviewRemark || '',
            ]),
        ];
        const discrepancyData = [
            ['服务单号', '老人姓名', '差异类型', '严重程度', '差异描述', '详细说明'],
            ...details.flatMap(d => d.discrepancies.map(disc => [
                d.orderNo,
                d.elderName,
                this.getDiscrepancyText(disc.type),
                this.getSeverityText(disc.severity),
                disc.description,
                disc.explanation,
            ])),
        ];
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryData), '汇总');
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(detailData), '明细');
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(discrepancyData), '差异详情');
        XLSX.writeFile(wb, outputPath);
        return outputPath;
    }
    exportToCSV(batchId, outputPath) {
        const details = this.generateDetails(batchId);
        const rows = [
            ['记录ID', '服务单号', '老人姓名', '护士姓名', '服务日期', '服务项目', '状态', '差异数量', '复核意见'].join(','),
            ...details.map(d => [
                d.recordId,
                d.orderNo,
                d.elderName,
                d.nurseName,
                d.serviceDate,
                `"${d.serviceItems.join(';')}"`,
                this.getStatusText(d.status),
                d.discrepancies.length,
                d.reviewRemark ? `"${d.reviewRemark}"` : '',
            ].join(',')),
        ];
        const fs = require('fs');
        fs.writeFileSync(outputPath, '\ufeff' + rows.join('\n'), 'utf8');
        return outputPath;
    }
    countByStatus(records) {
        const result = {
            matched: 0,
            discrepancy: 0,
            reviewing: 0,
            approved: 0,
            rejected: 0,
            supplement: 0,
        };
        for (const r of records) {
            result[r.status]++;
        }
        return result;
    }
    countByDiscrepancyType(records) {
        const result = {
            nurse_mismatch: 0,
            skill_mismatch: 0,
            time_mismatch: 0,
            service_mismatch: 0,
            cancelled_without_notice: 0,
            cross_region: 0,
            duplicate_order: 0,
            missing_record: 0,
            other: 0,
        };
        for (const r of records) {
            for (const d of r.discrepancies) {
                result[d.type]++;
            }
        }
        return result;
    }
    calculateTotalAmount(records) {
        let total = 0;
        const priceMap = {
            '压疮护理': 80,
            '鼻饲': 50,
            '导尿': 60,
            '造口护理': 70,
            '输液': 40,
            '打针': 30,
            '康复训练': 100,
            '临终关怀': 150,
            '基础护理': 30,
            '生命体征监测': 25,
        };
        for (const r of records) {
            if (r.status === 'approved' || r.status === 'matched') {
                for (const item of r.serviceOrder.serviceItems) {
                    total += priceMap[item] || 50;
                }
            }
        }
        return total;
    }
    getStatusText(status) {
        const map = {
            matched: '已匹配',
            discrepancy: '存在差异',
            reviewing: '复核中',
            approved: '已放行',
            rejected: '已退回',
            supplement: '待补材料',
        };
        return map[status] || status;
    }
    getDiscrepancyText(type) {
        const map = {
            nurse_mismatch: '护士不匹配',
            skill_mismatch: '技能不匹配',
            time_mismatch: '时间不匹配',
            service_mismatch: '服务项目不匹配',
            cancelled_without_notice: '未报备取消',
            cross_region: '跨区服务',
            duplicate_order: '重复订单',
            missing_record: '缺少排班记录',
            other: '其他',
        };
        return map[type] || type;
    }
    getSeverityText(severity) {
        const map = {
            low: '低',
            medium: '中',
            high: '高',
        };
        return map[severity] || severity;
    }
}
exports.ReportService = ReportService;
exports.default = new ReportService();
