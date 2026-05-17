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
exports.exportService = void 0;
const csv_writer_1 = require("csv-writer");
const path = __importStar(require("path"));
const types_1 = require("../types");
const dataStore_1 = require("../store/dataStore");
const response_1 = require("../utils/response");
const EXPORT_FIELDS = [
    { id: 'orderNo', title: '订单编号' },
    { id: 'goodsName', title: '商品名称' },
    { id: 'userId', title: '用户ID' },
    { id: 'orderAmount', title: '订单金额(元)' },
    { id: 'refundAmount', title: '退款金额(元)' },
    { id: 'refundReason', title: '退款原因' },
    { id: 'refundReasonDetail', title: '退款原因详情' },
    { id: 'riskTags', title: '风控标签' },
    { id: 'status', title: '当前状态' },
    { id: 'reviewConclusion', title: '复核结论' },
    { id: 'reviewerName', title: '复核人' },
    { id: 'reviewTime', title: '复核时间' },
    { id: 'reviewRemark', title: '复核备注' },
    { id: 'manualRemark', title: '人工备注' },
    { id: 'createTime', title: '创建时间' }
];
class ExportService {
    async exportToCsv(filters) {
        const { list, total } = dataStore_1.dataStore.listRefundReviews(1, 10000, filters);
        const records = list.map(review => this.mapToExportRecord(review));
        const fileName = `refund_review_export_${Date.now()}.csv`;
        const filePath = path.join(process.cwd(), 'exports', fileName);
        const csvWriter = (0, csv_writer_1.createObjectCsvWriter)({
            path: filePath,
            header: EXPORT_FIELDS,
            encoding: 'utf-8'
        });
        await csvWriter.writeRecords(records);
        return (0, response_1.createSuccessResponse)({
            filePath,
            recordCount: total
        }, `导出成功，共${total}条记录`);
    }
    mapToExportRecord(review) {
        return {
            orderNo: review.orderInfo.orderNo,
            goodsName: review.orderInfo.goodsName,
            userId: review.orderInfo.userId,
            orderAmount: review.orderInfo.orderAmount.toFixed(2),
            refundAmount: review.orderInfo.refundAmount.toFixed(2),
            refundReason: types_1.RefundReasonLabel[review.refundReason],
            refundReasonDetail: review.refundReasonDetail || '',
            riskTags: review.riskTags.map(tag => types_1.RiskTagLabel[tag]).join(';'),
            status: types_1.RefundReviewStatusLabel[review.status],
            reviewConclusion: review.reviewConclusion ? types_1.ReviewConclusionLabel[review.reviewConclusion] : '',
            reviewerName: review.reviewerName || '',
            reviewTime: review.reviewTime || '',
            reviewRemark: review.reviewRemark || '',
            manualRemark: review.manualRemark || '',
            createTime: review.createTime
        };
    }
    getExportFieldConfig() {
        return (0, response_1.createSuccessResponse)(EXPORT_FIELDS.map(f => ({ field: f.id, label: f.title })), '获取导出字段配置成功');
    }
}
exports.exportService = new ExportService();
