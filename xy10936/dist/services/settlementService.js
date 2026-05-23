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
Object.defineProperty(exports, "__esModule", { value: true });
exports.getReportWithDetails = exports.confirmSettlement = exports.generateSettlementReport = void 0;
const settlementDao = __importStar(require("../dao/settlementDao"));
const weighingDao = __importStar(require("../dao/weighingDao"));
const priceDao = __importStar(require("../dao/priceDao"));
const settlementDao_1 = require("../dao/settlementDao");
const generateSettlementReport = async (customerId, startDate, endDate, generatedBy) => {
    try {
        const unsettledRecords = await weighingDao.getUnsettledRecordsByCustomer(customerId);
        if (unsettledRecords.length === 0) {
            throw new Error('该客户暂无待结算记录');
        }
        const pricedRecords = unsettledRecords.filter(r => r.status === 'priced');
        if (pricedRecords.length === 0) {
            throw new Error('所有记录均未录入价格，无法结算');
        }
        const reportNo = `S${Date.now()}${Math.floor(Math.random() * 1000)}`;
        let totalAmount = 0;
        const items = [];
        for (const record of pricedRecords) {
            const priceVersion = await priceDao.getCurrentPrice(record.category_id, record.weigh_time || new Date().toISOString());
            if (!priceVersion)
                continue;
            const netWeight = record.net_weight || (record.gross_weight - record.tare_weight);
            const deductionRatio = record.deduction_ratio || 0;
            const finalWeight = netWeight * (1 - deductionRatio);
            const amount = finalWeight * priceVersion.price;
            items.push({
                weighing_record_id: record.id,
                net_weight: finalWeight,
                unit_price: priceVersion.price,
                amount
            });
            totalAmount += amount;
        }
        const reportId = await settlementDao.createSettlementReport({
            report_no: reportNo,
            customer_id: customerId,
            start_date: startDate,
            end_date: endDate,
            total_amount: totalAmount,
            status: 'draft',
            generated_by: generatedBy
        });
        for (const item of items) {
            await settlementDao.createSettlementItem({
                ...item,
                report_id: reportId
            });
        }
        return { reportId, reportNo: reportNo };
    }
    catch (error) {
        await (0, settlementDao_1.createExceptionRecord)({
            type: 'GENERATE_SETTLEMENT_ERROR',
            original_input: JSON.stringify({ customerId, startDate, endDate, generatedBy }),
            error_message: error.message
        });
        throw error;
    }
};
exports.generateSettlementReport = generateSettlementReport;
const confirmSettlement = async (reportId) => {
    try {
        const report = await settlementDao.getSettlementReportById(reportId);
        if (!report) {
            throw new Error('结算报告不存在');
        }
        if (report.status === 'confirmed') {
            throw new Error('该报告已确认，不能重复确认');
        }
        const items = await settlementDao.getSettlementItemsByReportId(reportId);
        for (const item of items) {
            const record = await weighingDao.getWeighingRecordById(item.weighing_record_id);
            if (record && record.status === 'settled') {
                throw new Error(`称重记录 ${item.weighing_record_id} 已结算，禁止重复结算`);
            }
        }
        await settlementDao.updateSettlementReportStatus(reportId, 'confirmed');
        for (const item of items) {
            await weighingDao.updateWeighingRecordStatus(item.weighing_record_id, 'settled', {
                settled_time: new Date().toISOString()
            });
        }
    }
    catch (error) {
        await (0, settlementDao_1.createExceptionRecord)({
            type: 'CONFIRM_SETTLEMENT_ERROR',
            original_input: JSON.stringify({ reportId }),
            error_message: error.message
        });
        throw error;
    }
};
exports.confirmSettlement = confirmSettlement;
const getReportWithDetails = async (reportId) => {
    const report = await settlementDao.getSettlementReportById(reportId);
    if (!report) {
        throw new Error('结算报告不存在');
    }
    const items = await settlementDao.getSettlementItemsByReportId(reportId);
    return { report, items };
};
exports.getReportWithDetails = getReportWithDetails;
