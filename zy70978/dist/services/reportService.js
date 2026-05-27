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
exports.reportService = exports.ReportService = void 0;
const dayjs_1 = __importDefault(require("dayjs"));
const XLSX = __importStar(require("xlsx"));
const dataStore_1 = require("../store/dataStore");
const reconciliationEngine_1 = require("./reconciliationEngine");
const reviewService_1 = require("./reviewService");
class ReportService {
    generateDetailedReport(orderNo) {
        let result = dataStore_1.dataStore.getReconciliationResult(orderNo);
        if (!result) {
            result = reconciliationEngine_1.reconciliationEngine.reconcileOrder(orderNo);
        }
        const order = dataStore_1.dataStore.getRentalOrderByNo(orderNo);
        if (!order) {
            throw new Error(`订单不存在: ${orderNo}`);
        }
        const repairRecords = dataStore_1.dataStore.getRepairRecordsBySerialNo(order.equipmentSerialNo);
        return {
            reportTitle: '设备租赁对账详情报告',
            generatedAt: (0, dayjs_1.default)().format('YYYY-MM-DD HH:mm:ss'),
            orderInfo: {
                orderNo: order.orderNo,
                tenantName: order.tenantName,
                tenantId: order.tenantId,
                equipmentName: order.equipmentName,
                equipmentSerialNo: order.equipmentSerialNo,
                rentalPeriod: `${order.startDate} 至 ${order.endDate}`,
                actualReturnDate: order.actualReturnDate || '未归还',
                monthlyRent: order.monthlyRent,
                depositAmount: order.depositAmount,
                actualDepositPaid: order.actualDepositPaid,
            },
            currentStatus: {
                status: result.status,
                statusExplanation: reviewService_1.reviewService.getStatusExplanation(result.status),
            },
            summary: {
                ...result.summary,
                explanations: {
                    totalRent: `租期内应付租金总额，共 ${result.breakdown.rentDetails.length} 期`,
                    overdueRent: result.summary.overdueRent > 0
                        ? `逾期产生的租金及罚息。${result.breakdown.rentDetails.find((d) => d.isOverdue)?.explanation || ''}`
                        : '无逾期',
                    totalRepairCost: `租期内设备维修总费用，共 ${repairRecords.length} 条维修记录`,
                    tenantLiabilityRepairCost: '应由租客承担的维修费用',
                    totalDeductions: '应从押金中扣除的总金额（逾期租金 + 租客责任维修费）',
                    depositRefund: result.summary.depositRefund >= 0
                        ? `应退还租客押金: ${result.summary.depositRefund.toFixed(2)} 元`
                        : `租客需补交: ${Math.abs(result.summary.depositRefund).toFixed(2)} 元`,
                },
            },
            discrepancies: result.discrepancies.map((d) => ({
                ...d,
                typeExplanation: reconciliationEngine_1.reconciliationEngine.getDiscrepancyExplanation(d.type),
            })),
            rentBreakdown: result.breakdown.rentDetails,
            repairBreakdown: result.breakdown.repairDetails,
            deductionBreakdown: result.breakdown.deductionDetails,
            reviewHistory: result.reviewRecords.map((r) => ({
                ...r,
                previousStatusExplanation: reviewService_1.reviewService.getStatusExplanation(r.previousStatus),
                newStatusExplanation: reviewService_1.reviewService.getStatusExplanation(r.newStatus),
            })),
            conclusion: this.generateConclusion(result),
        };
    }
    generateConclusion(result) {
        const parts = [];
        parts.push(`订单 ${result.orderNo} 对账结果：`);
        if (result.discrepancies.length > 0) {
            const openDiscrepancies = result.discrepancies.filter((d) => d.status === 'open' || d.status === 'pending_review');
            if (openDiscrepancies.length > 0) {
                parts.push(`存在 ${openDiscrepancies.length} 项待处理差异：` +
                    openDiscrepancies.map((d) => d.description).join('；'));
            }
        }
        if (result.summary.overdueRent > 0) {
            parts.push(`逾期租金 ${result.summary.overdueRent.toFixed(2)} 元需从押金扣除`);
        }
        if (result.summary.tenantLiabilityRepairCost > 0) {
            parts.push(`租客责任维修费用 ${result.summary.tenantLiabilityRepairCost.toFixed(2)} 元需从押金扣除`);
        }
        if (result.summary.depositRefund >= 0) {
            parts.push(`押金扣除后应退还租客 ${result.summary.depositRefund.toFixed(2)} 元`);
        }
        else {
            parts.push(`押金不足以抵扣，租客需补交 ${Math.abs(result.summary.depositRefund).toFixed(2)} 元`);
        }
        parts.push(`当前状态：${reviewService_1.reviewService.getStatusExplanation(result.status)}`);
        return parts.join('。');
    }
    generateSummaryReport() {
        const results = dataStore_1.dataStore.getAllReconciliationResults();
        const orders = dataStore_1.dataStore.getAllRentalOrders();
        const statusCounts = {
            pending: 0,
            approved: 0,
            rejected: 0,
            need_more_info: 0,
        };
        let totalRent = 0;
        let totalOverdueRent = 0;
        let totalRepairCost = 0;
        let totalTenantLiability = 0;
        let totalDeductions = 0;
        let totalDepositRefund = 0;
        let totalDiscrepancies = 0;
        results.forEach((result) => {
            statusCounts[result.status]++;
            totalRent += result.summary.totalRent;
            totalOverdueRent += result.summary.overdueRent;
            totalRepairCost += result.summary.totalRepairCost;
            totalTenantLiability += result.summary.tenantLiabilityRepairCost;
            totalDeductions += result.summary.totalDeductions;
            totalDepositRefund += result.summary.depositRefund;
            totalDiscrepancies += result.discrepancies.length;
        });
        return {
            reportTitle: '设备租赁对账汇总报告',
            generatedAt: (0, dayjs_1.default)().format('YYYY-MM-DD HH:mm:ss'),
            overview: {
                totalOrders: orders.length,
                reconciledOrders: results.length,
                pendingOrders: statusCounts.pending,
                approvedOrders: statusCounts.approved,
                rejectedOrders: statusCounts.rejected,
                needMoreInfoOrders: statusCounts.need_more_info,
            },
            financialSummary: {
                totalRent,
                totalOverdueRent,
                totalRepairCost,
                totalTenantLiability,
                totalDeductions,
                totalDepositRefund,
                totalDiscrepancies,
            },
            orderSummary: results.map((r) => ({
                orderNo: r.orderNo,
                tenantName: r.tenantName,
                equipmentSerialNo: r.equipmentSerialNo,
                status: r.status,
                statusExplanation: reviewService_1.reviewService.getStatusExplanation(r.status),
                totalDeductions: r.summary.totalDeductions,
                depositRefund: r.summary.depositRefund,
                discrepancyCount: r.discrepancies.length,
                lastUpdated: r.lastUpdated,
            })),
        };
    }
    exportToExcel(orderNo) {
        const report = this.generateDetailedReport(orderNo);
        const wb = XLSX.utils.book_new();
        const summaryData = [
            ['设备租赁对账详情报告'],
            ['生成时间', report.generatedAt],
            [],
            ['订单信息'],
            ['订单号', report.orderInfo.orderNo],
            ['租客名称', report.orderInfo.tenantName],
            ['租客ID', report.orderInfo.tenantId],
            ['设备名称', report.orderInfo.equipmentName],
            ['设备序列号', report.orderInfo.equipmentSerialNo],
            ['租赁期限', report.orderInfo.rentalPeriod],
            ['实际归还日期', report.orderInfo.actualReturnDate],
            ['月租金', report.orderInfo.monthlyRent],
            ['应缴押金', report.orderInfo.depositAmount],
            ['实缴押金', report.orderInfo.actualDepositPaid],
            [],
            ['当前状态', report.currentStatus.status],
            ['状态说明', report.currentStatus.statusExplanation],
            [],
            ['金额汇总'],
            ['项目', '金额(元)', '说明'],
            ['租金总额', report.summary.totalRent, report.summary.explanations.totalRent],
            ['逾期租金', report.summary.overdueRent, report.summary.explanations.overdueRent],
            ['维修总费用', report.summary.totalRepairCost, report.summary.explanations.totalRepairCost],
            ['租客责任维修费', report.summary.tenantLiabilityRepairCost, report.summary.explanations.tenantLiabilityRepairCost],
            ['扣款总额', report.summary.totalDeductions, report.summary.explanations.totalDeductions],
            ['押金退还', report.summary.depositRefund, report.summary.explanations.depositRefund],
            [],
            ['结论', report.conclusion],
        ];
        const ws1 = XLSX.utils.aoa_to_sheet(summaryData);
        XLSX.utils.book_append_sheet(wb, ws1, '汇总');
        if (report.discrepancies.length > 0) {
            const discrepancyData = [
                ['差异记录'],
                ['类型', '描述', '详情', '预期金额', '实际金额', '差额', '状态', '说明'],
                ...report.discrepancies.map((d) => [
                    d.type,
                    d.description,
                    d.detail,
                    d.expectedAmount,
                    d.actualAmount,
                    d.difference,
                    d.status,
                    d.typeExplanation,
                ]),
            ];
            const ws2 = XLSX.utils.aoa_to_sheet(discrepancyData);
            XLSX.utils.book_append_sheet(wb, ws2, '差异记录');
        }
        const rentData = [
            ['租金明细'],
            ['期数', '开始日期', '结束日期', '天数', '金额(元)', '是否逾期', '说明'],
            ...report.rentBreakdown.map((d) => [
                d.period,
                d.startDate,
                d.endDate,
                d.days,
                d.amount,
                d.isOverdue ? '是' : '否',
                d.explanation,
            ]),
        ];
        const ws3 = XLSX.utils.aoa_to_sheet(rentData);
        XLSX.utils.book_append_sheet(wb, ws3, '租金明细');
        if (report.repairBreakdown.length > 0) {
            const repairData = [
                ['维修明细'],
                ['维修单号', '维修日期', '维修内容', '费用(元)', '责任归属', '设备序列号', '说明'],
                ...report.repairBreakdown.map((d) => [
                    d.repairNo,
                    d.repairDate,
                    d.content,
                    d.cost,
                    d.liability,
                    d.boundToSerialNo,
                    d.explanation,
                ]),
            ];
            const ws4 = XLSX.utils.aoa_to_sheet(repairData);
            XLSX.utils.book_append_sheet(wb, ws4, '维修明细');
        }
        if (report.deductionBreakdown.length > 0) {
            const deductionData = [
                ['扣款明细'],
                ['类型', '金额(元)', '来源', '依据', '证据'],
                ...report.deductionBreakdown.map((d) => [
                    d.type,
                    d.amount,
                    d.source,
                    d.basis,
                    d.evidence.join('; '),
                ]),
            ];
            const ws5 = XLSX.utils.aoa_to_sheet(deductionData);
            XLSX.utils.book_append_sheet(wb, ws5, '扣款明细');
        }
        if (report.reviewHistory.length > 0) {
            const reviewData = [
                ['复核历史'],
                ['复核时间', '复核人', '原状态', '新状态', '备注'],
                ...report.reviewHistory.map((r) => [
                    (0, dayjs_1.default)(r.reviewDate).format('YYYY-MM-DD HH:mm:ss'),
                    r.reviewer,
                    r.previousStatusExplanation,
                    r.newStatusExplanation,
                    r.comments,
                ]),
            ];
            const ws6 = XLSX.utils.aoa_to_sheet(reviewData);
            XLSX.utils.book_append_sheet(wb, ws6, '复核历史');
        }
        return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    }
    exportSummaryToExcel() {
        const report = this.generateSummaryReport();
        const wb = XLSX.utils.book_new();
        const overviewData = [
            ['设备租赁对账汇总报告'],
            ['生成时间', report.generatedAt],
            [],
            ['订单概览'],
            ['总订单数', report.overview.totalOrders],
            ['已对账订单数', report.overview.reconciledOrders],
            ['待复核', report.overview.pendingOrders],
            ['已通过', report.overview.approvedOrders],
            ['已退回', report.overview.rejectedOrders],
            ['待补充材料', report.overview.needMoreInfoOrders],
            [],
            ['财务汇总'],
            ['项目', '金额(元)'],
            ['租金总额', report.financialSummary.totalRent],
            ['逾期租金总额', report.financialSummary.totalOverdueRent],
            ['维修费用总额', report.financialSummary.totalRepairCost],
            ['租客责任维修费', report.financialSummary.totalTenantLiability],
            ['扣款总额', report.financialSummary.totalDeductions],
            ['应退押金总额', report.financialSummary.totalDepositRefund],
            ['差异总数', report.financialSummary.totalDiscrepancies],
        ];
        const ws1 = XLSX.utils.aoa_to_sheet(overviewData);
        XLSX.utils.book_append_sheet(wb, ws1, '汇总');
        const orderData = [
            ['订单列表'],
            ['订单号', '租客名称', '设备序列号', '状态', '扣款总额', '押金退还', '差异数', '最后更新'],
            ...report.orderSummary.map((o) => [
                o.orderNo,
                o.tenantName,
                o.equipmentSerialNo,
                o.statusExplanation,
                o.totalDeductions,
                o.depositRefund,
                o.discrepancyCount,
                (0, dayjs_1.default)(o.lastUpdated).format('YYYY-MM-DD HH:mm:ss'),
            ]),
        ];
        const ws2 = XLSX.utils.aoa_to_sheet(orderData);
        XLSX.utils.book_append_sheet(wb, ws2, '订单列表');
        return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    }
    generateDeductionEvidence(orderNo) {
        const report = this.generateDetailedReport(orderNo);
        return {
            reportTitle: '押金扣款依据报告',
            generatedAt: (0, dayjs_1.default)().format('YYYY-MM-DD HH:mm:ss'),
            orderInfo: report.orderInfo,
            totalDeduction: report.summary.totalDeductions,
            depositPaid: report.orderInfo.actualDepositPaid,
            refundAmount: report.summary.depositRefund,
            deductions: report.deductionBreakdown.map((d) => ({
                type: d.type === 'overdue' ? '逾期租金' : d.type === 'repair' ? '维修费用' : '其他',
                amount: d.amount,
                source: d.source,
                basis: d.basis,
                evidence: d.evidence,
            })),
            disclaimer: '本报告依据租赁协议及相关维修记录生成，如有疑问请在7个工作日内提出。',
        };
    }
}
exports.ReportService = ReportService;
exports.reportService = new ReportService();
