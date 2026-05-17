"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupAcceptanceData = setupAcceptanceData;
const uuid_1 = require("uuid");
const refundReviewService_1 = require("../services/refundReviewService");
const dataStore_1 = require("../store/dataStore");
const types_1 = require("../types");
const SPLIT_ORDER_GROUP_ID = 'group_' + (0, uuid_1.v4)();
const userOrders = [
    {
        orderInfo: {
            orderId: (0, uuid_1.v4)(),
            orderNo: 'ORD20250115001',
            userId: 'user_split_001',
            userPhone: '13800138000',
            orderAmount: 999.00,
            refundAmount: 999.00,
            createTime: new Date().toISOString(),
            goodsName: 'iPhone 15 Pro Max 256GB',
            goodsId: 'goods_001'
        },
        refundReason: types_1.RefundReason.QUALITY_ISSUE,
        refundReasonDetail: '屏幕有亮点，影响使用',
        riskTags: [types_1.RiskTag.SPLIT_ORDER_EVASION, types_1.RiskTag.SUSPICIOUS_FREQUENCY],
        splitOrderGroupId: SPLIT_ORDER_GROUP_ID,
        idempotentKey: 'idem_split_001'
    },
    {
        orderInfo: {
            orderId: (0, uuid_1.v4)(),
            orderNo: 'ORD20250115002',
            userId: 'user_split_001',
            userPhone: '13800138000',
            orderAmount: 899.00,
            refundAmount: 899.00,
            createTime: new Date().toISOString(),
            goodsName: 'AirPods Pro 2',
            goodsId: 'goods_002'
        },
        refundReason: types_1.RefundReason.CHANGE_MIND,
        refundReasonDetail: '买错了，不想要了',
        riskTags: [types_1.RiskTag.SPLIT_ORDER_EVASION, types_1.RiskTag.SUSPICIOUS_FREQUENCY],
        splitOrderGroupId: SPLIT_ORDER_GROUP_ID,
        idempotentKey: 'idem_split_002'
    },
    {
        orderInfo: {
            orderId: (0, uuid_1.v4)(),
            orderNo: 'ORD20250115003',
            userId: 'user_normal_001',
            userPhone: '13900139000',
            orderAmount: 299.00,
            refundAmount: 299.00,
            createTime: new Date().toISOString(),
            goodsName: '小米手环8',
            goodsId: 'goods_003'
        },
        refundReason: types_1.RefundReason.WRONG_ITEM,
        refundReasonDetail: '发错型号了',
        riskTags: [],
        idempotentKey: 'idem_normal_001'
    },
    {
        orderInfo: {
            orderId: (0, uuid_1.v4)(),
            orderNo: 'ORD20250115004',
            userId: 'user_risk_001',
            userPhone: '13700137000',
            orderAmount: 5999.00,
            refundAmount: 5999.00,
            createTime: new Date().toISOString(),
            goodsName: 'MacBook Air M2',
            goodsId: 'goods_004'
        },
        refundReason: types_1.RefundReason.DAMAGED,
        refundReasonDetail: '外包装破损，担心机器受损',
        riskTags: [types_1.RiskTag.ABNORMAL_REFUND_AMOUNT, types_1.RiskTag.NEW_USER_RISK],
        idempotentKey: 'idem_risk_001'
    }
];
function setupAcceptanceData() {
    console.log('=== 开始初始化验收测试数据 ===\n');
    const results = userOrders.map(order => {
        const result = refundReviewService_1.refundReviewService.createRefundReview(order);
        console.log(`创建记录: ${order.orderInfo.orderNo} - ${result.success ? '成功' : '失败'}`);
        return result;
    });
    const reviewId = results[3].data?.id;
    console.log('\n=== 场景1: 完整流转流程 ===');
    console.log('1. 创建复核记录');
    console.log('2. 添加人工备注');
    const remarkResult = refundReviewService_1.refundReviewService.addManualRemark(reviewId, {
        manualRemark: '经核实，用户为首次购买，确为外包装轻微破损，可放行',
        operatorId: 'admin_001',
        operatorName: '张经理'
    });
    console.log('   添加备注:', remarkResult.success ? '成功' : '失败', remarkResult.businessMessage);
    console.log('3. 执行复核（放行）');
    const reviewResult = refundReviewService_1.refundReviewService.review(reviewId, {
        reviewConclusion: types_1.ReviewConclusion.MANUAL_APPROVE,
        reviewRemark: '同意放行，已核实情况属实',
        operatorId: 'admin_001',
        operatorName: '张经理'
    });
    console.log('   复核结果:', reviewResult.success ? '成功' : '失败', reviewResult.businessMessage);
    console.log('4. 查询审计日志');
    const auditResult = refundReviewService_1.refundReviewService.getAuditLogs(reviewId);
    console.log('   审计日志条数:', auditResult.data?.length);
    console.log('\n=== 场景2: 冲突记录（拆单绕开阈值，未备注直接复核） ===');
    const splitReviewId = results[0].data?.id;
    const failedReview = refundReviewService_1.refundReviewService.review(splitReviewId, {
        reviewConclusion: types_1.ReviewConclusion.MANUAL_APPROVE,
        operatorId: 'admin_002',
        operatorName: '李主管'
    });
    console.log('   未备注直接复核结果:', failedReview.success ? '成功' : '失败');
    console.log('   业务错误码:', failedReview.businessCode);
    console.log('   业务错误信息:', failedReview.businessMessage);
    dataStore_1.dataStore.saveConflictRecord({
        refundReviewId: splitReviewId,
        conflictType: 'SPLIT_ORDER_REVIEW_BLOCKED',
        conflictMessage: '用户存在拆单绕开阈值风险，未添加人工备注即尝试复核',
        oldValue: types_1.RefundReviewStatus.INTERCEPTING,
        newValue: null,
        operatorId: 'admin_002',
        operatorName: '李主管',
        createTime: new Date().toISOString()
    });
    console.log('   已保存冲突记录\n');
    console.log('=== 场景3: 导入坏行模拟 ===');
    const importBatchId = 'batch_' + (0, uuid_1.v4)();
    const badRows = [
        {
            rowNumber: 3,
            rawData: 'ORD_INVALID,,user_001,999,质量问题',
            errorMessage: '订单编号格式错误，缺少商品名称',
            errorFields: ['orderNo', 'goodsName'],
            importBatchId,
            createTime: new Date().toISOString()
        },
        {
            rowNumber: 7,
            rawData: 'ORD20250115007,商品A,user_002,abc,质量问题',
            errorMessage: '退款金额不是有效数字',
            errorFields: ['refundAmount'],
            importBatchId,
            createTime: new Date().toISOString()
        },
        {
            rowNumber: 12,
            rawData: '',
            errorMessage: '空行数据',
            errorFields: ['all'],
            importBatchId,
            createTime: new Date().toISOString()
        }
    ];
    badRows.forEach(row => {
        dataStore_1.dataStore.saveImportBadRow(row);
        console.log(`   导入坏行 ${row.rowNumber}: ${row.errorMessage}`);
    });
    console.log('\n=== 验收测试数据初始化完成 ===');
    console.log(`   共创建 ${results.length} 条复核记录`);
    console.log(`   完整流转测试记录ID: ${reviewId}`);
    console.log(`   拆单绕开阈值记录ID: ${splitReviewId}`);
    console.log(`   导入坏行批次ID: ${importBatchId}`);
    return {
        reviewId,
        splitReviewId,
        importBatchId
    };
}
