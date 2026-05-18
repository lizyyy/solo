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
exports.readCouponBatches = readCouponBatches;
exports.readCouponRecords = readCouponRecords;
exports.readOrderDetails = readOrderDetails;
exports.writeImpactResult = writeImpactResult;
exports.writeStatistics = writeStatistics;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const sync_1 = require("csv-parse/sync");
const sync_2 = require("csv-stringify/sync");
function readCouponBatches(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const records = (0, sync_1.parse)(content, {
        columns: true,
        skip_empty_lines: true,
        trim: true
    });
    return records.map((r) => ({
        batchId: String(r.batchId || r.批次ID || ''),
        batchName: String(r.batchName || r.批次名称 || ''),
        anchorId: String(r.anchorId || r.主播ID || ''),
        anchorName: String(r.anchorName || r.主播名称 || ''),
        couponType: String(r.couponType || r.券类型 || ''),
        totalCount: parseInt(r.totalCount || r.总数量 || '0', 10),
        grantedCount: parseInt(r.grantedCount || r.已发放数量 || '0', 10),
        withdrawalTime: String(r.withdrawalTime || r.撤券时间 || ''),
        status: String(r.status || r.状态 || '')
    }));
}
function readCouponRecords(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const records = (0, sync_1.parse)(content, {
        columns: true,
        skip_empty_lines: true,
        trim: true
    });
    return records.map((r) => ({
        recordId: String(r.recordId || r.记录ID || ''),
        batchId: String(r.batchId || r.批次ID || ''),
        userId: String(r.userId || r.用户ID || ''),
        userName: String(r.userName || r.用户名称 || ''),
        couponCode: String(r.couponCode || r.券码 || ''),
        receiveTime: String(r.receiveTime || r.领取时间 || ''),
        expireTime: String(r.expireTime || r.过期时间 || ''),
        useStatus: (r.useStatus || r.使用状态 || 'UNUSED'),
        orderId: r.orderId || r.订单ID || undefined,
        useTime: r.useTime || r.使用时间 || undefined
    }));
}
function readOrderDetails(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const records = (0, sync_1.parse)(content, {
        columns: true,
        skip_empty_lines: true,
        trim: true
    });
    return records.map((r) => ({
        orderId: String(r.orderId || r.订单ID || ''),
        userId: String(r.userId || r.用户ID || ''),
        batchId: String(r.batchId || r.批次ID || ''),
        couponCode: String(r.couponCode || r.券码 || ''),
        orderAmount: parseFloat(r.orderAmount || r.订单金额 || '0'),
        discountAmount: parseFloat(r.discountAmount || r.优惠金额 || '0'),
        payAmount: parseFloat(r.payAmount || r.实付金额 || '0'),
        orderTime: String(r.orderTime || r.下单时间 || ''),
        refundStatus: (r.refundStatus || r.退款状态 || 'NONE'),
        refundAmount: parseFloat(r.refundAmount || r.退款金额 || '0'),
        refundTime: r.refundTime || r.退款时间 || undefined
    }));
}
function writeImpactResult(filePath, impacts) {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    const records = impacts.map(i => ({
        '批次ID': i.batchId,
        '批次名称': i.batchName,
        '主播ID': i.anchorId,
        '主播名称': i.anchorName,
        '用户ID': i.userId,
        '用户名称': i.userName,
        '券码': i.couponCode,
        '领取时间': i.receiveTime,
        '过期时间': i.expireTime,
        '使用状态': i.useStatus,
        '订单ID': i.orderId || '',
        '下单时间': i.orderTime || '',
        '订单金额': i.orderAmount || '',
        '优惠金额': i.discountAmount || '',
        '退款状态': i.refundStatus || '',
        '退款金额': i.refundAmount || '',
        '影响等级': i.impactLevel,
        '影响描述': i.impactDescription,
        '损失金额': i.lossAmount
    }));
    const csv = (0, sync_2.stringify)(records, {
        header: true,
        quoted_string: true,
        encoding: 'utf8'
    });
    fs.writeFileSync(filePath, '\uFEFF' + csv, 'utf8');
}
function writeStatistics(filePath, stats) {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    const content = [
        '优惠券发放包主播撤券影响统计报告',
        '='.repeat(50),
        '',
        `统计时间: ${new Date().toLocaleString('zh-CN')}`,
        '',
        '一、总体统计',
        '-'.repeat(30),
        `受影响用户数: ${stats.totalAffectedUsers}`,
        `受影响券数: ${stats.totalAffectedCoupons}`,
        `总损失金额: ¥${stats.totalLossAmount.toFixed(2)}`,
        '',
        '二、按影响等级分布',
        '-'.repeat(30),
        `高影响 (HIGH): ${stats.byImpactLevel.HIGH}`,
        `中影响 (MEDIUM): ${stats.byImpactLevel.MEDIUM}`,
        `低影响 (LOW): ${stats.byImpactLevel.LOW}`,
        '',
        '三、按使用状态分布',
        '-'.repeat(30),
        ...Object.entries(stats.byUseStatus).map(([k, v]) => `${k}: ${v}`)
    ].join('\n');
    fs.writeFileSync(filePath, content, 'utf8');
}
