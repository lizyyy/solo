import { v4 as uuidv4 } from 'uuid';
import { AfterSalesStatus, QaResult, RefundMethod } from '../types';
import AfterSalesOrderModel from '../models/AfterSalesOrder';
import QaRecordModel from '../models/QaRecord';
import RefundRecordModel from '../models/RefundRecord';
import CompensationCouponModel from '../models/CompensationCoupon';
import LedgerRecordModel from '../models/LedgerRecord';

class StateMachineService {
  private async canTransition(currentStatus: AfterSalesStatus, nextStatus: AfterSalesStatus): Promise<boolean> {
    const transitions: Record<AfterSalesStatus, AfterSalesStatus[]> = {
      [AfterSalesStatus.CREATED]: [AfterSalesStatus.QA_IN_PROGRESS, AfterSalesStatus.CANCELLED],
      [AfterSalesStatus.QA_IN_PROGRESS]: [AfterSalesStatus.QA_PASSED, AfterSalesStatus.QA_FAILED],
      [AfterSalesStatus.QA_PASSED]: [AfterSalesStatus.REFUND_IN_PROGRESS, AfterSalesStatus.REVIEW_PENDING],
      [AfterSalesStatus.QA_FAILED]: [AfterSalesStatus.REVIEW_PENDING, AfterSalesStatus.CLOSED],
      [AfterSalesStatus.REFUND_IN_PROGRESS]: [AfterSalesStatus.REFUND_SUCCESS, AfterSalesStatus.REFUND_FAILED],
      [AfterSalesStatus.REFUND_SUCCESS]: [AfterSalesStatus.CLOSED],
      [AfterSalesStatus.REFUND_FAILED]: [AfterSalesStatus.REFUND_IN_PROGRESS, AfterSalesStatus.COMPENSATION_IN_PROGRESS],
      [AfterSalesStatus.COMPENSATION_IN_PROGRESS]: [AfterSalesStatus.COMPENSATION_SUCCESS, AfterSalesStatus.COMPENSATION_FAILED],
      [AfterSalesStatus.COMPENSATION_SUCCESS]: [AfterSalesStatus.CLOSED],
      [AfterSalesStatus.COMPENSATION_FAILED]: [AfterSalesStatus.COMPENSATION_IN_PROGRESS, AfterSalesStatus.REVIEW_PENDING],
      [AfterSalesStatus.REVIEW_PENDING]: [AfterSalesStatus.REVIEW_APPROVED, AfterSalesStatus.REVIEW_REJECTED],
      [AfterSalesStatus.REVIEW_APPROVED]: [AfterSalesStatus.REFUND_IN_PROGRESS, AfterSalesStatus.COMPENSATION_IN_PROGRESS, AfterSalesStatus.CLOSED],
      [AfterSalesStatus.REVIEW_REJECTED]: [AfterSalesStatus.CLOSED],
      [AfterSalesStatus.CLOSED]: [],
      [AfterSalesStatus.CANCELLED]: [],
    };

    return transitions[currentStatus]?.includes(nextStatus) ?? false;
  }

  async createOrder(data: {
    orderNo: string;
    userId: string;
    userName: string;
    productName: string;
    amount: number;
    idempotencyKey: string;
  }) {
    const existing = await AfterSalesOrderModel.findOne({
      where: { idempotencyKey: data.idempotencyKey },
    });
    if (existing) {
      return { order: existing, isNew: false };
    }

    const order = await AfterSalesOrderModel.create({
      id: uuidv4(),
      ...data,
      status: AfterSalesStatus.CREATED,
      retryCount: 0,
      maxRetries: 3,
    });

    await this.addLedgerRecord({
      afterSalesId: order.id,
      orderNo: order.orderNo,
      type: 'CREATE',
      amount: order.amount,
      status: 'SUCCESS',
      operator: data.userName,
      operationTime: new Date(),
      remarks: '创建售后单',
    });

    return { order, isNew: true };
  }

  async startQa(afterSalesId: string, inspectorId: string, inspectorName: string) {
    const order = await AfterSalesOrderModel.findByPk(afterSalesId);
    if (!order) throw new Error('售后单不存在');

    if (!(await this.canTransition(order.status as AfterSalesStatus, AfterSalesStatus.QA_IN_PROGRESS))) {
      throw new Error(`无法从 ${order.status} 进入质检流程`);
    }

    order.status = AfterSalesStatus.QA_IN_PROGRESS;
    await order.save();

    await this.addLedgerRecord({
      afterSalesId: order.id,
      orderNo: order.orderNo,
      type: 'QA_START',
      amount: 0,
      status: 'SUCCESS',
      operator: inspectorName,
      operationTime: new Date(),
      remarks: '开始质检',
    });

    return order;
  }

  async submitQaResult(afterSalesId: string, data: {
    inspectorId: string;
    inspectorName: string;
    result: QaResult;
    remarks?: string;
    rejectReason?: string;
  }) {
    const order = await AfterSalesOrderModel.findByPk(afterSalesId);
    if (!order) throw new Error('售后单不存在');

    if (order.status !== AfterSalesStatus.QA_IN_PROGRESS) {
      throw new Error('当前状态不允许提交质检结果');
    }

    const nextStatus = data.result === QaResult.PASSED 
      ? AfterSalesStatus.QA_PASSED 
      : AfterSalesStatus.QA_FAILED;

    await QaRecordModel.create({
      id: uuidv4(),
      afterSalesId,
      inspectorId: data.inspectorId,
      inspectorName: data.inspectorName,
      result: data.result,
      remarks: data.remarks,
    });

    order.qaResult = data.result;
    order.rejectReason = data.rejectReason as any;
    order.status = nextStatus;
    await order.save();

    await this.addLedgerRecord({
      afterSalesId: order.id,
      orderNo: order.orderNo,
      type: 'QA_RESULT',
      amount: 0,
      status: 'SUCCESS',
      operator: data.inspectorName,
      operationTime: new Date(),
      remarks: `质检结果: ${data.result}`,
    });

    return order;
  }

  async startRefund(afterSalesId: string, method: RefundMethod, operator: string) {
    const order = await AfterSalesOrderModel.findByPk(afterSalesId);
    if (!order) throw new Error('售后单不存在');

    if (!(await this.canTransition(order.status as AfterSalesStatus, AfterSalesStatus.REFUND_IN_PROGRESS))) {
      throw new Error(`无法从 ${order.status} 进入退款流程`);
    }

    if (order.retryCount >= order.maxRetries) {
      throw new Error('已达到最大重试次数，请走补偿券流程');
    }

    order.status = AfterSalesStatus.REFUND_IN_PROGRESS;
    order.refundMethod = method;
    await order.save();

    await RefundRecordModel.create({
      id: uuidv4(),
      afterSalesId,
      method,
      amount: order.amount,
      status: 'PROCESSING',
      retryCount: 0,
    });

    await this.addLedgerRecord({
      afterSalesId: order.id,
      orderNo: order.orderNo,
      type: 'REFUND_START',
      amount: order.amount,
      status: 'PROCESSING',
      operator,
      operationTime: new Date(),
      remarks: `开始退款，方式: ${method}`,
    });

    return order;
  }

  async processRefund(afterSalesId: string, success: boolean, transactionId?: string, errorMessage?: string) {
    const order = await AfterSalesOrderModel.findByPk(afterSalesId);
    if (!order) throw new Error('售后单不存在');

    if (order.status !== AfterSalesStatus.REFUND_IN_PROGRESS) {
      throw new Error('当前状态不允许处理退款');
    }

    const refundRecord = await RefundRecordModel.findOne({
      where: { afterSalesId },
      order: [['createdAt', 'DESC']],
    });

    if (success) {
      order.status = AfterSalesStatus.REFUND_SUCCESS;
      if (refundRecord) {
        refundRecord.status = 'SUCCESS';
        refundRecord.transactionId = transactionId;
        await refundRecord.save();
      }
    } else {
      order.retryCount += 1;
      if (order.retryCount >= order.maxRetries) {
        order.status = AfterSalesStatus.REFUND_FAILED;
      } else {
        order.status = AfterSalesStatus.QA_PASSED;
      }
      if (refundRecord) {
        refundRecord.status = 'FAILED';
        refundRecord.errorMessage = errorMessage;
        refundRecord.retryCount += 1;
        await refundRecord.save();
      }
    }

    await order.save();

    await this.addLedgerRecord({
      afterSalesId: order.id,
      orderNo: order.orderNo,
      type: 'REFUND_RESULT',
      amount: order.amount,
      status: success ? 'SUCCESS' : 'FAILED',
      operator: 'SYSTEM',
      operationTime: new Date(),
      remarks: success ? '退款成功' : `退款失败: ${errorMessage}`,
    });

    return order;
  }

  async startCompensation(afterSalesId: string, operator: string) {
    const order = await AfterSalesOrderModel.findByPk(afterSalesId);
    if (!order) throw new Error('售后单不存在');

    if (!(await this.canTransition(order.status as AfterSalesStatus, AfterSalesStatus.COMPENSATION_IN_PROGRESS))) {
      throw new Error(`无法从 ${order.status} 进入补偿券流程`);
    }

    order.status = AfterSalesStatus.COMPENSATION_IN_PROGRESS;
    order.retryCount = 0;
    await order.save();

    const couponCode = `CPN${Date.now()}${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

    await CompensationCouponModel.create({
      id: uuidv4(),
      afterSalesId,
      couponCode,
      amount: order.amount,
      status: 'PROCESSING',
      userId: order.userId,
      retryCount: 0,
    });

    await this.addLedgerRecord({
      afterSalesId: order.id,
      orderNo: order.orderNo,
      type: 'COMPENSATION_START',
      amount: order.amount,
      status: 'PROCESSING',
      operator,
      operationTime: new Date(),
      remarks: `开始发放补偿券: ${couponCode}`,
    });

    return order;
  }

  async processCompensation(afterSalesId: string, success: boolean, errorMessage?: string) {
    const order = await AfterSalesOrderModel.findByPk(afterSalesId);
    if (!order) throw new Error('售后单不存在');

    if (order.status !== AfterSalesStatus.COMPENSATION_IN_PROGRESS) {
      throw new Error('当前状态不允许处理补偿券');
    }

    const coupon = await CompensationCouponModel.findOne({
      where: { afterSalesId },
      order: [['createdAt', 'DESC']],
    });

    if (success) {
      order.status = AfterSalesStatus.COMPENSATION_SUCCESS;
      if (coupon) {
        coupon.status = 'ISSUED';
        coupon.issuedAt = new Date();
        await coupon.save();
      }
    } else {
      order.retryCount += 1;
      if (order.retryCount >= order.maxRetries) {
        order.status = AfterSalesStatus.COMPENSATION_FAILED;
      } else {
        order.status = AfterSalesStatus.REFUND_FAILED;
      }
      if (coupon) {
        coupon.status = 'FAILED';
        coupon.errorMessage = errorMessage;
        coupon.retryCount += 1;
        await coupon.save();
      }
    }

    await order.save();

    await this.addLedgerRecord({
      afterSalesId: order.id,
      orderNo: order.orderNo,
      type: 'COMPENSATION_RESULT',
      amount: order.amount,
      status: success ? 'SUCCESS' : 'FAILED',
      operator: 'SYSTEM',
      operationTime: new Date(),
      remarks: success ? '补偿券发放成功' : `补偿券发放失败: ${errorMessage}`,
    });

    return order;
  }

  async correctCompensation(afterSalesId: string, data: {
    reason: string;
    operator: string;
    newAmount?: number;
  }) {
    const order = await AfterSalesOrderModel.findByPk(afterSalesId);
    if (!order) throw new Error('售后单不存在');

    if (order.status !== AfterSalesStatus.COMPENSATION_FAILED) {
      throw new Error('只有补偿失败的订单才能进行修正');
    }

    const coupon = await CompensationCouponModel.findOne({
      where: { afterSalesId },
      order: [['createdAt', 'DESC']],
    });

    if (coupon) {
      coupon.correctionReason = data.reason;
      coupon.correctionOperator = data.operator;
      coupon.correctionTime = new Date();
      await coupon.save();
    }

    if (data.newAmount) {
      order.amount = data.newAmount;
    }

    order.status = AfterSalesStatus.REVIEW_PENDING;
    order.retryCount = 0;
    await order.save();

    await this.addLedgerRecord({
      afterSalesId: order.id,
      orderNo: order.orderNo,
      type: 'COMPENSATION_CORRECTION',
      amount: data.newAmount || order.amount,
      status: 'SUCCESS',
      operator: data.operator,
      operationTime: new Date(),
      remarks: `补偿券修正: ${data.reason}`,
    });

    return order;
  }

  async reviewRejectReason(afterSalesId: string, data: {
    approved: boolean;
    reviewer: string;
    reviewComments: string;
  }) {
    const order = await AfterSalesOrderModel.findByPk(afterSalesId);
    if (!order) throw new Error('售后单不存在');

    if (order.status !== AfterSalesStatus.REVIEW_PENDING) {
      throw new Error('当前状态不允许复核拒绝原因');
    }

    order.rejectReasonReview = data.reviewComments;
    order.rejectReasonReviewed = true;
    order.rejectReasonReviewer = data.reviewer;

    if (data.approved) {
      order.status = AfterSalesStatus.REVIEW_APPROVED;
    } else {
      order.status = AfterSalesStatus.REVIEW_REJECTED;
    }

    await order.save();

    await this.addLedgerRecord({
      afterSalesId: order.id,
      orderNo: order.orderNo,
      type: 'REVIEW_RESULT',
      amount: 0,
      status: data.approved ? 'APPROVED' : 'REJECTED',
      operator: data.reviewer,
      operationTime: new Date(),
      remarks: `拒绝原因复核: ${data.approved ? '通过' : '驳回'}, 意见: ${data.reviewComments}`,
    });

    return order;
  }

  async closeOrder(afterSalesId: string, operator: string) {
    const order = await AfterSalesOrderModel.findByPk(afterSalesId);
    if (!order) throw new Error('售后单不存在');

    if (!(await this.canTransition(order.status as AfterSalesStatus, AfterSalesStatus.CLOSED))) {
      throw new Error(`无法从 ${order.status} 关闭订单`);
    }

    order.status = AfterSalesStatus.CLOSED;
    await order.save();

    await this.addLedgerRecord({
      afterSalesId: order.id,
      orderNo: order.orderNo,
      type: 'CLOSE',
      amount: 0,
      status: 'SUCCESS',
      operator,
      operationTime: new Date(),
      remarks: '关闭售后单',
    });

    return order;
  }

  async recalculateAfterQaChange(afterSalesId: string) {
    const order = await AfterSalesOrderModel.findByPk(afterSalesId);
    if (!order) throw new Error('售后单不存在');

    if (order.qaResult === QaResult.PASSED) {
      order.status = AfterSalesStatus.QA_PASSED;
    } else if (order.qaResult === QaResult.FAILED) {
      order.status = AfterSalesStatus.REVIEW_PENDING;
    }

    await order.save();
    return order;
  }

  private async addLedgerRecord(data: any) {
    await LedgerRecordModel.create({
      id: uuidv4(),
      ...data,
    });
  }

  async getOrderDetail(afterSalesId: string) {
    const order = await AfterSalesOrderModel.findByPk(afterSalesId);
    if (!order) throw new Error('售后单不存在');

    const qaRecords = await QaRecordModel.findAll({
      where: { afterSalesId },
      order: [['createdAt', 'DESC']],
    });

    const refundRecords = await RefundRecordModel.findAll({
      where: { afterSalesId },
      order: [['createdAt', 'DESC']],
    });

    const coupons = await CompensationCouponModel.findAll({
      where: { afterSalesId },
      order: [['createdAt', 'DESC']],
    });

    const ledger = await LedgerRecordModel.findAll({
      where: { afterSalesId },
      order: [['operationTime', 'DESC']],
    });

    return {
      order,
      qaRecords,
      refundRecords,
      coupons,
      ledger,
    };
  }

  async getStatistics() {
    const orders = await AfterSalesOrderModel.findAll();
    const statusCounts: Record<string, number> = {};
    orders.forEach(order => {
      statusCounts[order.status] = (statusCounts[order.status] || 0) + 1;
    });

    const totalAmount = orders.reduce((sum, order) => sum + Number(order.amount), 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayOrders = orders.filter(o => new Date(o.createdAt) >= today);

    return {
      total: orders.length,
      todayCount: todayOrders.length,
      totalAmount,
      statusCounts,
    };
  }

  async exportLedger() {
    return await LedgerRecordModel.findAll({
      order: [['operationTime', 'DESC']],
    });
  }
}

export default new StateMachineService();