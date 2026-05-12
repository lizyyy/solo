"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const dayjs_1 = __importDefault(require("dayjs"));
const prisma = new client_1.PrismaClient();
async function main() {
    console.log('开始创建演示数据...');
    console.log('1. 创建商户...');
    const merchant1 = await prisma.merchant.create({
        data: {
            merchantNo: 'M000001',
            name: '测试商户A - 正常结算',
            phone: '13800138001',
            contactName: '张经理',
            bankAccount: '6222021234567890001',
            bankName: '中国工商银行',
        },
    });
    const merchant2 = await prisma.merchant.create({
        data: {
            merchantNo: 'M000002',
            name: '测试商户B - 扣罚冻结',
            phone: '13800138002',
            contactName: '李经理',
            bankAccount: '6222021234567890002',
            bankName: '中国建设银行',
        },
    });
    const merchant3 = await prisma.merchant.create({
        data: {
            merchantNo: 'M000003',
            name: '测试商户C - 申诉通过',
            phone: '13800138003',
            contactName: '王经理',
            bankAccount: '6222021234567890003',
            bankName: '中国农业银行',
        },
    });
    const merchant4 = await prisma.merchant.create({
        data: {
            merchantNo: 'M000004',
            name: '测试商户D - 申诉失败',
            phone: '13800138004',
            contactName: '赵经理',
            bankAccount: '6222021234567890004',
            bankName: '中国银行',
        },
    });
    const merchant5 = await prisma.merchant.create({
        data: {
            merchantNo: 'M000005',
            name: '测试商户E - 跨期抵扣',
            phone: '13800138005',
            contactName: '陈经理',
            bankAccount: '6222021234567890005',
            bankName: '招商银行',
        },
    });
    console.log('2. 创建示例1：正常结算（商户A）...');
    await createNormalSettlementScenario(merchant1.id);
    console.log('3. 创建示例2：扣罚冻结（商户B）...');
    await createPenaltyFreezeScenario(merchant2.id);
    console.log('4. 创建示例3：申诉通过（商户C）...');
    await createAppealApprovedScenario(merchant3.id);
    console.log('5. 创建示例4：申诉失败（商户D）...');
    await createAppealRejectedScenario(merchant4.id);
    console.log('6. 创建示例5：跨期抵扣（商户E）...');
    await createCrossPeriodScenario(merchant5.id);
    console.log('✅ 演示数据创建完成！');
    console.log('\n商户编号列表：');
    console.log(`  M000001 - 正常结算`);
    console.log(`  M000002 - 扣罚冻结`);
    console.log(`  M000003 - 申诉通过`);
    console.log(`  M000004 - 申诉失败`);
    console.log(`  M000005 - 跨期抵扣`);
}
async function createNormalSettlementScenario(merchantId) {
    const jan2024 = (0, dayjs_1.default)('2024-01-15');
    const order1 = await prisma.order.create({
        data: {
            orderNo: 'O2024011000001',
            merchantId,
            merchantOrderNo: 'MO-A-001',
            amount: 1000,
            serviceFee: 30,
            platformFee: 20,
            payTime: jan2024.subtract(5, 'day').toDate(),
            status: client_1.OrderStatus.COMPLETED,
        },
    });
    const order2 = await prisma.order.create({
        data: {
            orderNo: 'O2024011200002',
            merchantId,
            merchantOrderNo: 'MO-A-002',
            amount: 2000,
            serviceFee: 60,
            platformFee: 40,
            payTime: jan2024.subtract(3, 'day').toDate(),
            status: client_1.OrderStatus.COMPLETED,
        },
    });
    const order3 = await prisma.order.create({
        data: {
            orderNo: 'O2024011400003',
            merchantId,
            merchantOrderNo: 'MO-A-003',
            amount: 1500,
            serviceFee: 45,
            platformFee: 30,
            payTime: jan2024.subtract(1, 'day').toDate(),
            status: client_1.OrderStatus.COMPLETED,
        },
    });
    const refund = await prisma.refund.create({
        data: {
            refundNo: 'R2024011300001',
            orderId: order2.id,
            merchantId,
            amount: 200,
            reason: '商品质量问题',
            status: client_1.RefundStatus.COMPLETED,
            applyTime: jan2024.subtract(2, 'day').toDate(),
            completeTime: jan2024.subtract(2, 'day').toDate(),
        },
    });
    const settlementDate = jan2024.toDate();
    const settlement = await prisma.settlement.create({
        data: {
            settlementNo: 'S2024011500001',
            merchantId,
            period: '2024-01',
            settlementDate,
            status: client_1.SettlementStatus.CONFIRMED,
            orderAmount: 4500,
            refundAmount: 200,
            serviceFee: 135,
            penaltyAmount: 0,
            previousCarryOver: 0,
            totalAmount: 4165,
            frozenAmount: 0,
            payableAmount: 4165,
            actualPaidAmount: 0,
            nextCarryOver: 0,
            operator: 'system',
        },
    });
    await prisma.settlementItem.createMany({
        data: [
            { settlementId: settlement.id, merchantId, itemType: 'ORDER', itemNo: order1.orderNo, amount: 1000, description: '订单收入' },
            { settlementId: settlement.id, merchantId, itemType: 'SERVICE_FEE', itemNo: order1.orderNo, amount: -50, description: '订单服务费 + 平台费' },
            { settlementId: settlement.id, merchantId, itemType: 'ORDER', itemNo: order2.orderNo, amount: 2000, description: '订单收入' },
            { settlementId: settlement.id, merchantId, itemType: 'SERVICE_FEE', itemNo: order2.orderNo, amount: -100, description: '订单服务费 + 平台费' },
            { settlementId: settlement.id, merchantId, itemType: 'ORDER', itemNo: order3.orderNo, amount: 1500, description: '订单收入' },
            { settlementId: settlement.id, merchantId, itemType: 'SERVICE_FEE', itemNo: order3.orderNo, amount: -75, description: '订单服务费 + 平台费' },
            { settlementId: settlement.id, merchantId, itemType: 'REFUND', itemNo: refund.refundNo, relatedNo: order2.id, amount: -200, description: '退款扣除' },
        ],
    });
    await prisma.settlementStatusHistory.create({
        data: {
            settlementId: settlement.id,
            oldStatus: client_1.SettlementStatus.PENDING,
            newStatus: client_1.SettlementStatus.PENDING,
            reason: '创建结算单',
            operator: 'system',
        },
    });
    await prisma.settlementStatusHistory.create({
        data: {
            settlementId: settlement.id,
            oldStatus: client_1.SettlementStatus.PENDING,
            newStatus: client_1.SettlementStatus.CONFIRMED,
            reason: '确认结算',
            operator: 'admin',
        },
    });
}
async function createPenaltyFreezeScenario(merchantId) {
    const jan2024 = (0, dayjs_1.default)('2024-01-15');
    const order = await prisma.order.create({
        data: {
            orderNo: 'O2024011000004',
            merchantId,
            merchantOrderNo: 'MO-B-001',
            amount: 3000,
            serviceFee: 90,
            platformFee: 60,
            payTime: jan2024.subtract(5, 'day').toDate(),
            status: client_1.OrderStatus.COMPLETED,
        },
    });
    const penalty = await prisma.penalty.create({
        data: {
            penaltyNo: 'P2024011200001',
            merchantId,
            orderId: order.id,
            amount: 500,
            type: client_1.PenaltyType.COMPLAINT,
            reason: '用户投诉虚假宣传',
            status: client_1.PenaltyStatus.CONFIRMED,
            applyTime: jan2024.subtract(3, 'day').toDate(),
            effectiveTime: jan2024.subtract(3, 'day').toDate(),
        },
    });
    await prisma.penaltyStatusHistory.create({
        data: {
            penaltyId: penalty.id,
            oldStatus: client_1.PenaltyStatus.PENDING,
            newStatus: client_1.PenaltyStatus.PENDING,
            reason: '创建扣罚',
        },
    });
    await prisma.penaltyStatusHistory.create({
        data: {
            penaltyId: penalty.id,
            oldStatus: client_1.PenaltyStatus.PENDING,
            newStatus: client_1.PenaltyStatus.CONFIRMED,
            reason: '扣罚确认生效',
            operator: 'complaint_dept',
        },
    });
    const settlement = await prisma.settlement.create({
        data: {
            settlementNo: 'S2024011500002',
            merchantId,
            period: '2024-01',
            settlementDate: jan2024.toDate(),
            status: client_1.SettlementStatus.FROZEN,
            orderAmount: 3000,
            refundAmount: 0,
            serviceFee: 150,
            penaltyAmount: 500,
            previousCarryOver: 0,
            totalAmount: 2350,
            frozenAmount: 2350,
            payableAmount: 0,
            actualPaidAmount: 0,
            nextCarryOver: 0,
            operator: 'risk_dept',
        },
    });
    await prisma.settlementItem.createMany({
        data: [
            { settlementId: settlement.id, merchantId, itemType: 'ORDER', itemNo: order.orderNo, amount: 3000, description: '订单收入' },
            { settlementId: settlement.id, merchantId, itemType: 'SERVICE_FEE', itemNo: order.orderNo, amount: -150, description: '订单服务费 + 平台费' },
            { settlementId: settlement.id, merchantId, itemType: 'PENALTY', itemNo: penalty.penaltyNo, amount: -500, description: '扣罚扣除: 用户投诉虚假宣传' },
        ],
    });
    await prisma.settlementStatusHistory.create({
        data: {
            settlementId: settlement.id,
            oldStatus: client_1.SettlementStatus.PENDING,
            newStatus: client_1.SettlementStatus.PENDING,
            reason: '创建结算单',
            operator: 'system',
        },
    });
    await prisma.settlementStatusHistory.create({
        data: {
            settlementId: settlement.id,
            oldStatus: client_1.SettlementStatus.PENDING,
            newStatus: client_1.SettlementStatus.FROZEN,
            reason: '风控审核中，暂冻结结算',
            operator: 'risk_dept',
        },
    });
}
async function createAppealApprovedScenario(merchantId) {
    const jan2024 = (0, dayjs_1.default)('2024-01-15');
    const order = await prisma.order.create({
        data: {
            orderNo: 'O2024011100005',
            merchantId,
            merchantOrderNo: 'MO-C-001',
            amount: 5000,
            serviceFee: 150,
            platformFee: 100,
            payTime: jan2024.subtract(4, 'day').toDate(),
            status: client_1.OrderStatus.COMPLETED,
        },
    });
    const penalty = await prisma.penalty.create({
        data: {
            penaltyNo: 'P2024011300002',
            merchantId,
            orderId: order.id,
            amount: 1000,
            type: client_1.PenaltyType.PERFORMANCE,
            reason: '超时发货',
            status: client_1.PenaltyStatus.CANCELLED,
            applyTime: jan2024.subtract(2, 'day').toDate(),
        },
    });
    await prisma.penaltyStatusHistory.create({
        data: { penaltyId: penalty.id, oldStatus: client_1.PenaltyStatus.PENDING, newStatus: client_1.PenaltyStatus.PENDING, reason: '创建扣罚' },
    });
    await prisma.penaltyStatusHistory.create({
        data: { penaltyId: penalty.id, oldStatus: client_1.PenaltyStatus.PENDING, newStatus: client_1.PenaltyStatus.APPEALING, reason: '商户提起申诉' },
    });
    await prisma.penaltyStatusHistory.create({
        data: { penaltyId: penalty.id, oldStatus: client_1.PenaltyStatus.APPEALING, newStatus: client_1.PenaltyStatus.CANCELLED, reason: '申诉通过，扣罚取消', operator: 'appeal_dept' },
    });
    const appeal = await prisma.appeal.create({
        data: {
            appealNo: 'A2024011300001',
            penaltyId: penalty.id,
            merchantId,
            reason: '已提供物流凭证，证明在约定时间内发货',
            evidence: '物流单号：SF1234567890',
            status: client_1.AppealStatus.APPROVED,
            applyTime: jan2024.subtract(2, 'day').toDate(),
            reviewTime: jan2024.subtract(1, 'day').toDate(),
            reviewResult: '申诉通过，物流凭证有效，扣罚取消',
            operator: 'appeal_dept',
        },
    });
    await prisma.appealStatusHistory.create({
        data: { appealId: appeal.id, oldStatus: client_1.AppealStatus.PENDING, newStatus: client_1.AppealStatus.PENDING, reason: '创建申诉' },
    });
    await prisma.appealStatusHistory.create({
        data: { appealId: appeal.id, oldStatus: client_1.AppealStatus.PENDING, newStatus: client_1.AppealStatus.REVIEWING, reason: '审核中' },
    });
    await prisma.appealStatusHistory.create({
        data: { appealId: appeal.id, oldStatus: client_1.AppealStatus.REVIEWING, newStatus: client_1.AppealStatus.APPROVED, reason: '申诉通过，物流凭证有效，扣罚取消', operator: 'appeal_dept' },
    });
    const settlement = await prisma.settlement.create({
        data: {
            settlementNo: 'S2024011500003',
            merchantId,
            period: '2024-01',
            settlementDate: jan2024.toDate(),
            status: client_1.SettlementStatus.PAID,
            orderAmount: 5000,
            refundAmount: 0,
            serviceFee: 250,
            penaltyAmount: 0,
            previousCarryOver: 0,
            totalAmount: 4750,
            frozenAmount: 0,
            payableAmount: 4750,
            actualPaidAmount: 4750,
            nextCarryOver: 0,
            operator: 'finance_dept',
        },
    });
    await prisma.settlementItem.createMany({
        data: [
            { settlementId: settlement.id, merchantId, itemType: 'ORDER', itemNo: order.orderNo, amount: 5000, description: '订单收入' },
            { settlementId: settlement.id, merchantId, itemType: 'SERVICE_FEE', itemNo: order.orderNo, amount: -250, description: '订单服务费 + 平台费' },
        ],
    });
    const payment = await prisma.paymentRecord.create({
        data: {
            paymentNo: 'PAY2024011600001',
            settlementId: settlement.id,
            merchantId,
            amount: 4750,
            status: client_1.PaymentStatus.SUCCESS,
            bankAccount: '6222021234567890003',
            bankName: '中国农业银行',
            payTime: jan2024.add(1, 'day').toDate(),
            operator: 'finance_dept',
        },
    });
    await prisma.paymentStatusHistory.create({
        data: { paymentId: payment.id, oldStatus: client_1.PaymentStatus.PENDING, newStatus: client_1.PaymentStatus.PENDING, reason: '创建打款记录', operator: 'finance_dept' },
    });
    await prisma.paymentStatusHistory.create({
        data: { paymentId: payment.id, oldStatus: client_1.PaymentStatus.PENDING, newStatus: client_1.PaymentStatus.PROCESSING, reason: '打款处理中' },
    });
    await prisma.paymentStatusHistory.create({
        data: { paymentId: payment.id, oldStatus: client_1.PaymentStatus.PROCESSING, newStatus: client_1.PaymentStatus.SUCCESS, reason: '打款成功', operator: 'bank' },
    });
    await prisma.settlementStatusHistory.create({
        data: { settlementId: settlement.id, oldStatus: client_1.SettlementStatus.PENDING, newStatus: client_1.SettlementStatus.PENDING, reason: '创建结算单', operator: 'system' },
    });
    await prisma.settlementStatusHistory.create({
        data: { settlementId: settlement.id, oldStatus: client_1.SettlementStatus.PENDING, newStatus: client_1.SettlementStatus.CONFIRMED, reason: '确认结算', operator: 'finance_dept' },
    });
    await prisma.settlementStatusHistory.create({
        data: { settlementId: settlement.id, oldStatus: client_1.SettlementStatus.CONFIRMED, newStatus: client_1.SettlementStatus.PAYING, reason: '发起打款', operator: 'finance_dept' },
    });
    await prisma.settlementStatusHistory.create({
        data: { settlementId: settlement.id, oldStatus: client_1.SettlementStatus.PAYING, newStatus: client_1.SettlementStatus.PAID, reason: '打款成功', operator: 'bank' },
    });
}
async function createAppealRejectedScenario(merchantId) {
    const jan2024 = (0, dayjs_1.default)('2024-01-15');
    const order = await prisma.order.create({
        data: {
            orderNo: 'O2024011000006',
            merchantId,
            merchantOrderNo: 'MO-D-001',
            amount: 2500,
            serviceFee: 75,
            platformFee: 50,
            payTime: jan2024.subtract(5, 'day').toDate(),
            status: client_1.OrderStatus.COMPLETED,
        },
    });
    const penalty = await prisma.penalty.create({
        data: {
            penaltyNo: 'P2024011200003',
            merchantId,
            orderId: order.id,
            amount: 300,
            type: client_1.PenaltyType.FRAUD,
            reason: '疑似刷单行为',
            status: client_1.PenaltyStatus.CONFIRMED,
            applyTime: jan2024.subtract(3, 'day').toDate(),
            effectiveTime: jan2024.subtract(1, 'day').toDate(),
        },
    });
    await prisma.penaltyStatusHistory.create({
        data: { penaltyId: penalty.id, oldStatus: client_1.PenaltyStatus.PENDING, newStatus: client_1.PenaltyStatus.PENDING, reason: '创建扣罚' },
    });
    await prisma.penaltyStatusHistory.create({
        data: { penaltyId: penalty.id, oldStatus: client_1.PenaltyStatus.PENDING, newStatus: client_1.PenaltyStatus.APPEALING, reason: '商户提起申诉' },
    });
    await prisma.penaltyStatusHistory.create({
        data: { penaltyId: penalty.id, oldStatus: client_1.PenaltyStatus.APPEALING, newStatus: client_1.PenaltyStatus.CONFIRMED, reason: '申诉驳回，扣罚生效', operator: 'risk_dept' },
    });
    const appeal = await prisma.appeal.create({
        data: {
            appealNo: 'A2024011200002',
            penaltyId: penalty.id,
            merchantId,
            reason: '订单为正常交易，提供了聊天记录证明',
            evidence: '聊天记录截图',
            status: client_1.AppealStatus.REJECTED,
            applyTime: jan2024.subtract(3, 'day').toDate(),
            reviewTime: jan2024.subtract(1, 'day').toDate(),
            reviewResult: '申诉驳回，风控数据显示异常交易特征',
            operator: 'risk_dept',
        },
    });
    await prisma.appealStatusHistory.create({
        data: { appealId: appeal.id, oldStatus: client_1.AppealStatus.PENDING, newStatus: client_1.AppealStatus.PENDING, reason: '创建申诉' },
    });
    await prisma.appealStatusHistory.create({
        data: { appealId: appeal.id, oldStatus: client_1.AppealStatus.PENDING, newStatus: client_1.AppealStatus.REVIEWING, reason: '审核中' },
    });
    await prisma.appealStatusHistory.create({
        data: { appealId: appeal.id, oldStatus: client_1.AppealStatus.REVIEWING, newStatus: client_1.AppealStatus.REJECTED, reason: '申诉驳回，风控数据显示异常交易特征', operator: 'risk_dept' },
    });
    const settlement = await prisma.settlement.create({
        data: {
            settlementNo: 'S2024011500004',
            merchantId,
            period: '2024-01',
            settlementDate: jan2024.toDate(),
            status: client_1.SettlementStatus.PAID,
            orderAmount: 2500,
            refundAmount: 0,
            serviceFee: 125,
            penaltyAmount: 300,
            previousCarryOver: 0,
            totalAmount: 2075,
            frozenAmount: 0,
            payableAmount: 2075,
            actualPaidAmount: 2075,
            nextCarryOver: 0,
            operator: 'finance_dept',
        },
    });
    await prisma.settlementItem.createMany({
        data: [
            { settlementId: settlement.id, merchantId, itemType: 'ORDER', itemNo: order.orderNo, amount: 2500, description: '订单收入' },
            { settlementId: settlement.id, merchantId, itemType: 'SERVICE_FEE', itemNo: order.orderNo, amount: -125, description: '订单服务费 + 平台费' },
            { settlementId: settlement.id, merchantId, itemType: 'PENALTY', itemNo: penalty.penaltyNo, amount: -300, description: '扣罚扣除: 疑似刷单行为（申诉驳回）' },
        ],
    });
    const payment = await prisma.paymentRecord.create({
        data: {
            paymentNo: 'PAY2024011600002',
            settlementId: settlement.id,
            merchantId,
            amount: 2075,
            status: client_1.PaymentStatus.SUCCESS,
            bankAccount: '6222021234567890004',
            bankName: '中国银行',
            payTime: jan2024.add(1, 'day').toDate(),
            operator: 'finance_dept',
        },
    });
    await prisma.paymentStatusHistory.create({
        data: { paymentId: payment.id, oldStatus: client_1.PaymentStatus.PENDING, newStatus: client_1.PaymentStatus.PENDING, reason: '创建打款记录', operator: 'finance_dept' },
    });
    await prisma.paymentStatusHistory.create({
        data: { paymentId: payment.id, oldStatus: client_1.PaymentStatus.PENDING, newStatus: client_1.PaymentStatus.SUCCESS, reason: '打款成功', operator: 'bank' },
    });
    await prisma.settlementStatusHistory.create({
        data: { settlementId: settlement.id, oldStatus: client_1.SettlementStatus.PENDING, newStatus: client_1.SettlementStatus.PENDING, reason: '创建结算单', operator: 'system' },
    });
    await prisma.settlementStatusHistory.create({
        data: { settlementId: settlement.id, oldStatus: client_1.SettlementStatus.PENDING, newStatus: client_1.SettlementStatus.CONFIRMED, reason: '确认结算', operator: 'finance_dept' },
    });
    await prisma.settlementStatusHistory.create({
        data: { settlementId: settlement.id, oldStatus: client_1.SettlementStatus.CONFIRMED, newStatus: client_1.SettlementStatus.PAID, reason: '打款成功', operator: 'bank' },
    });
}
async function createCrossPeriodScenario(merchantId) {
    const dec2023 = (0, dayjs_1.default)('2023-12-31');
    const jan2024 = (0, dayjs_1.default)('2024-01-15');
    const orderDec = await prisma.order.create({
        data: {
            orderNo: 'O2023122500007',
            merchantId,
            merchantOrderNo: 'MO-E-001',
            amount: 1000,
            serviceFee: 30,
            platformFee: 20,
            payTime: dec2023.subtract(6, 'day').toDate(),
            status: client_1.OrderStatus.COMPLETED,
        },
    });
    const refundDec = await prisma.refund.create({
        data: {
            refundNo: 'R2023122800002',
            orderId: orderDec.id,
            merchantId,
            amount: 500,
            reason: '用户7天无理由退货',
            status: client_1.RefundStatus.COMPLETED,
            applyTime: dec2023.subtract(3, 'day').toDate(),
            completeTime: dec2023.subtract(3, 'day').toDate(),
        },
    });
    const penaltyDec = await prisma.penalty.create({
        data: {
            penaltyNo: 'P2023122900004',
            merchantId,
            orderId: orderDec.id,
            amount: 600,
            type: client_1.PenaltyType.PERFORMANCE,
            reason: '延迟发货违约',
            status: client_1.PenaltyStatus.CONFIRMED,
            applyTime: dec2023.subtract(2, 'day').toDate(),
            effectiveTime: dec2023.subtract(2, 'day').toDate(),
        },
    });
    const settlementDec = await prisma.settlement.create({
        data: {
            settlementNo: 'S2023123100005',
            merchantId,
            period: '2023-12',
            settlementDate: dec2023.toDate(),
            status: client_1.SettlementStatus.PAID,
            orderAmount: 1000,
            refundAmount: 500,
            serviceFee: 50,
            penaltyAmount: 600,
            previousCarryOver: 0,
            totalAmount: -150,
            frozenAmount: 150,
            payableAmount: 0,
            actualPaidAmount: 0,
            nextCarryOver: -150,
            operator: 'system',
        },
    });
    await prisma.settlementItem.createMany({
        data: [
            { settlementId: settlementDec.id, merchantId, itemType: 'ORDER', itemNo: orderDec.orderNo, amount: 1000, description: '订单收入' },
            { settlementId: settlementDec.id, merchantId, itemType: 'SERVICE_FEE', itemNo: orderDec.orderNo, amount: -50, description: '订单服务费 + 平台费' },
            { settlementId: settlementDec.id, merchantId, itemType: 'REFUND', itemNo: refundDec.refundNo, relatedNo: orderDec.id, amount: -500, description: '退款扣除' },
            { settlementId: settlementDec.id, merchantId, itemType: 'PENALTY', itemNo: penaltyDec.penaltyNo, amount: -600, description: '扣罚扣除: 延迟发货违约' },
        ],
    });
    await prisma.settlementStatusHistory.create({
        data: { settlementId: settlementDec.id, oldStatus: client_1.SettlementStatus.PENDING, newStatus: client_1.SettlementStatus.PENDING, reason: '创建结算单', operator: 'system' },
    });
    await prisma.settlementStatusHistory.create({
        data: { settlementId: settlementDec.id, oldStatus: client_1.SettlementStatus.PENDING, newStatus: client_1.SettlementStatus.CONFIRMED, reason: '确认结算，负金额结转下期', operator: 'finance_dept' },
    });
    await prisma.settlementStatusHistory.create({
        data: { settlementId: settlementDec.id, oldStatus: client_1.SettlementStatus.CONFIRMED, newStatus: client_1.SettlementStatus.PAID, reason: '零金额打款完成，-150.00元结转下期', operator: 'system' },
    });
    const orderJan = await prisma.order.create({
        data: {
            orderNo: 'O2024011000008',
            merchantId,
            merchantOrderNo: 'MO-E-002',
            amount: 3000,
            serviceFee: 90,
            platformFee: 60,
            payTime: jan2024.subtract(5, 'day').toDate(),
            status: client_1.OrderStatus.COMPLETED,
        },
    });
    const settlementJan = await prisma.settlement.create({
        data: {
            settlementNo: 'S2024011500006',
            merchantId,
            period: '2024-01',
            settlementDate: jan2024.toDate(),
            status: client_1.SettlementStatus.CONFIRMED,
            orderAmount: 3000,
            refundAmount: 0,
            serviceFee: 150,
            penaltyAmount: 0,
            previousCarryOver: -150,
            totalAmount: 2700,
            frozenAmount: 0,
            payableAmount: 2700,
            actualPaidAmount: 0,
            nextCarryOver: 0,
            operator: 'finance_dept',
        },
    });
    await prisma.settlementItem.createMany({
        data: [
            { settlementId: settlementJan.id, merchantId, itemType: 'CARRY_OVER', itemNo: 'CO-2024-01-PREV', amount: -150, description: '上期负结转金额（2023-12期）' },
            { settlementId: settlementJan.id, merchantId, itemType: 'ORDER', itemNo: orderJan.orderNo, amount: 3000, description: '订单收入' },
            { settlementId: settlementJan.id, merchantId, itemType: 'SERVICE_FEE', itemNo: orderJan.orderNo, amount: -150, description: '订单服务费 + 平台费' },
        ],
    });
    await prisma.manualAdjustment.create({
        data: {
            adjustmentNo: 'MA2024011500001',
            settlementId: settlementJan.id,
            merchantId,
            adjustmentType: client_1.AdjustmentType.INCREASE,
            amount: 50,
            reason: '上期退款手续费优惠返还',
            beforeAmount: 2700,
            afterAmount: 2750,
            operator: 'finance_manager',
        },
    });
    await prisma.settlementStatusHistory.create({
        data: { settlementId: settlementJan.id, oldStatus: client_1.SettlementStatus.PENDING, newStatus: client_1.SettlementStatus.PENDING, reason: '创建结算单', operator: 'system' },
    });
    await prisma.settlementStatusHistory.create({
        data: { settlementId: settlementJan.id, oldStatus: client_1.SettlementStatus.PENDING, newStatus: client_1.SettlementStatus.MANUAL_ADJUSTED, reason: '人工调整: 上期退款手续费优惠返还', operator: 'finance_manager' },
    });
    await prisma.settlementStatusHistory.create({
        data: { settlementId: settlementJan.id, oldStatus: client_1.SettlementStatus.MANUAL_ADJUSTED, newStatus: client_1.SettlementStatus.CONFIRMED, reason: '确认结算', operator: 'finance_dept' },
    });
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=seed.js.map