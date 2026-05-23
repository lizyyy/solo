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
exports.exportWeighingRecordsToCSV = exports.exportSettlementReportToCSV = void 0;
const json2csv_1 = require("json2csv");
const settlementDao = __importStar(require("../dao/settlementDao"));
const weighingDao = __importStar(require("../dao/weighingDao"));
const customerDao = __importStar(require("../dao/customerDao"));
const categoryDao = __importStar(require("../dao/categoryDao"));
const settlementDao_1 = require("../dao/settlementDao");
const exportSettlementReportToCSV = async (reportId) => {
    try {
        const report = await settlementDao.getSettlementReportById(reportId);
        if (!report) {
            throw new Error('结算报告不存在');
        }
        const customer = await customerDao.getCustomerById(report.customer_id);
        const items = await settlementDao.getSettlementItemsByReportId(reportId);
        const detailedItems = [];
        for (const item of items) {
            const record = await weighingDao.getWeighingRecordById(item.weighing_record_id);
            if (record) {
                const category = await categoryDao.getCategoryById(record.category_id);
                detailedItems.push({
                    record_no: record.record_no,
                    category: category?.name || '未知',
                    gross_weight: record.gross_weight,
                    tare_weight: record.tare_weight,
                    net_weight: item.net_weight.toFixed(2),
                    unit_price: item.unit_price.toFixed(2),
                    amount: item.amount.toFixed(2),
                    weigh_time: record.weigh_time
                });
            }
        }
        const reportInfo = [
            { field: '结算单号', value: report.report_no },
            { field: '客户名称', value: customer?.name || '未知' },
            { field: '开始日期', value: report.start_date },
            { field: '结束日期', value: report.end_date },
            { field: '总金额', value: report.total_amount.toFixed(2) },
            { field: '状态', value: report.status === 'confirmed' ? '已确认' : '草稿' },
            { field: '生成时间', value: report.generated_at },
            {},
            { field: '称重单号', value: '品类', net_weight: '净重(kg)', unit_price: '单价(元/kg)', amount: '金额(元)', weigh_time: '称重时间' }
        ];
        const fields = ['record_no', 'category', 'gross_weight', 'tare_weight', 'net_weight', 'unit_price', 'amount', 'weigh_time'];
        const json2csvParser = new json2csv_1.Parser({ fields });
        const csv = json2csvParser.parse(detailedItems);
        return csv;
    }
    catch (error) {
        await (0, settlementDao_1.createExceptionRecord)({
            type: 'EXPORT_ERROR',
            original_input: JSON.stringify({ reportId }),
            error_message: error.message
        });
        throw error;
    }
};
exports.exportSettlementReportToCSV = exportSettlementReportToCSV;
const exportWeighingRecordsToCSV = async (customerId, status) => {
    try {
        let records;
        if (customerId) {
            records = await weighingDao.getWeighingRecordsByCustomer(customerId);
        }
        else if (status) {
            records = await weighingDao.getWeighingRecordsByStatus(status);
        }
        else {
            records = await weighingDao.getAllWeighingRecords();
        }
        const detailedRecords = [];
        for (const record of records) {
            const customer = await customerDao.getCustomerById(record.customer_id);
            const category = await categoryDao.getCategoryById(record.category_id);
            detailedRecords.push({
                record_no: record.record_no,
                customer: customer?.name || '未知',
                category: category?.name || '未知',
                gross_weight: record.gross_weight.toFixed(2),
                tare_weight: record.tare_weight.toFixed(2),
                net_weight: (record.net_weight || 0).toFixed(2),
                deduction_ratio: ((record.deduction_ratio || 0) * 100).toFixed(1) + '%',
                status: getStatusText(record.status || ''),
                created_at: record.created_at
            });
        }
        const fields = ['record_no', 'customer', 'category', 'gross_weight', 'tare_weight', 'net_weight', 'deduction_ratio', 'status', 'created_at'];
        const json2csvParser = new json2csv_1.Parser({ fields });
        const csv = json2csvParser.parse(detailedRecords);
        return csv;
    }
    catch (error) {
        await (0, settlementDao_1.createExceptionRecord)({
            type: 'EXPORT_ERROR',
            original_input: JSON.stringify({ customerId, status }),
            error_message: error.message
        });
        throw error;
    }
};
exports.exportWeighingRecordsToCSV = exportWeighingRecordsToCSV;
function getStatusText(status) {
    const statusMap = {
        'pending': '待复核',
        'verified': '已复核',
        'priced': '已录价',
        'settled': '已结算'
    };
    return statusMap[status] || status;
}
