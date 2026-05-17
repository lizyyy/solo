const OrderFreeze = require('../models/OrderFreeze');
const FreezeOperationLog = require('../models/FreezeOperationLog');
const { FulfillmentIntercept, InterceptStatus } = require('../models/FulfillmentIntercept');
const { OrderFreezeStatus, OperationType } = require('../models/database');

class OrderFreezeService {
  static async createFreeze(data, operatorInfo = {}) {
    const activeFreezes = await OrderFreeze.findActiveByOrderNo(data.orderNo);
    if (activeFreezes.length > 0) {
      throw new Error(`订单 ${data.orderNo} 已存在活跃冻结记录`);
    }

    const freeze = await OrderFreeze.create(data);

    await FreezeOperationLog.create({
      freezeId: freeze.id,
      operationType: OperationType.CREATE,
      operator: operatorInfo.operator,
      beforeStatus: null,
      afterStatus: OrderFreezeStatus.FROZEN,
      operationDetails: `创建订单冻结，风险原因：${data.riskReason}，冻结动作：${data.freezeAction}`,
      originalInput: data,
      processingBasis: data.processingBasis,
      ipAddress: operatorInfo.ipAddress,
      userAgent: operatorInfo.userAgent
    });

    return freeze;
  }

  static async submitForReview(id, reviewer, operatorInfo = {}) {
    const freeze = await OrderFreeze.findById(id);
    if (!freeze) {
      throw new Error('冻结记录不存在');
    }

    if (freeze.status !== OrderFreezeStatus.FROZEN) {
      throw new Error('只有FROZEN状态的记录才能提交复核');
    }

    const beforeStatus = freeze.status;
    const updated = await OrderFreeze.updateStatus(id, OrderFreezeStatus.UNDER_REVIEW, {
      reviewer: reviewer
    });

    await FreezeOperationLog.create({
      freezeId: id,
      operationType: OperationType.SUBMIT_FOR_REVIEW,
      operator: operatorInfo.operator || reviewer,
      beforeStatus: beforeStatus,
      afterStatus: OrderFreezeStatus.UNDER_REVIEW,
      operationDetails: `提交人工复核，复核人：${reviewer}`,
      ipAddress: operatorInfo.ipAddress,
      userAgent: operatorInfo.userAgent
    });

    return updated;
  }

  static async release(id, finalConclusion, operatorInfo = {}) {
    const freeze = await OrderFreeze.findById(id);
    if (!freeze) {
      throw new Error('冻结记录不存在');
    }

    if (freeze.status === OrderFreezeStatus.RELEASED) {
      return freeze;
    }

    if (![OrderFreezeStatus.UNDER_REVIEW, OrderFreezeStatus.FROZEN].includes(freeze.status)) {
      throw new Error('只有UNDER_REVIEW或FROZEN状态的记录才能释放');
    }

    const beforeStatus = freeze.status;
    const updated = await OrderFreeze.updateStatus(id, OrderFreezeStatus.RELEASED, {
      finalConclusion: finalConclusion
    });

    await FreezeOperationLog.create({
      freezeId: id,
      operationType: OperationType.RELEASE,
      operator: operatorInfo.operator,
      beforeStatus: beforeStatus,
      afterStatus: OrderFreezeStatus.RELEASED,
      operationDetails: `释放订单冻结，最终结论：${finalConclusion}`,
      processingBasis: finalConclusion,
      ipAddress: operatorInfo.ipAddress,
      userAgent: operatorInfo.userAgent
    });

    return updated;
  }

  static async cancel(id, finalConclusion, operatorInfo = {}) {
    const freeze = await OrderFreeze.findById(id);
    if (!freeze) {
      throw new Error('冻结记录不存在');
    }

    if (freeze.status === OrderFreezeStatus.CANCELLED) {
      return freeze;
    }

    const beforeStatus = freeze.status;
    const updated = await OrderFreeze.updateStatus(id, OrderFreezeStatus.CANCELLED, {
      finalConclusion: finalConclusion
    });

    await FreezeOperationLog.create({
      freezeId: id,
      operationType: OperationType.CANCEL,
      operator: operatorInfo.operator,
      beforeStatus: beforeStatus,
      afterStatus: OrderFreezeStatus.CANCELLED,
      operationDetails: `取消订单冻结，最终结论：${finalConclusion}`,
      processingBasis: finalConclusion,
      ipAddress: operatorInfo.ipAddress,
      userAgent: operatorInfo.userAgent
    });

    return updated;
  }

  static async manualCorrect(id, correctionData, operatorInfo = {}) {
    const freeze = await OrderFreeze.findById(id);
    if (!freeze) {
      throw new Error('冻结记录不存在');
    }

    const beforeStatus = freeze.status;
    const updated = await OrderFreeze.manualCorrect(id, correctionData);

    await FreezeOperationLog.create({
      freezeId: id,
      operationType: OperationType.MANUAL_CORRECT,
      operator: operatorInfo.operator,
      beforeStatus: beforeStatus,
      afterStatus: OrderFreezeStatus.MANUALLY_CORRECTED,
      operationDetails: `人工修正冻结记录`,
      originalInput: correctionData,
      processingBasis: correctionData.processingBasis,
      ipAddress: operatorInfo.ipAddress,
      userAgent: operatorInfo.userAgent
    });

    return updated;
  }

  static async checkAndIntercept(orderNo, interceptType, requestData = {}) {
    const activeFreezes = await OrderFreeze.findActiveByOrderNo(orderNo);
    
    if (activeFreezes.length === 0) {
      return { shouldIntercept: false, message: '订单无活跃冻结记录' };
    }

    const freeze = activeFreezes[0];
    
    if (freeze.freeze_action !== 'ALL' && !freeze.freeze_action.includes(interceptType)) {
      return { shouldIntercept: false, message: '当前冻结类型不包含该履约动作' };
    }

    await FulfillmentIntercept.create({
      freezeId: freeze.id,
      orderNo: orderNo,
      interceptType: interceptType,
      interceptStatus: InterceptStatus.INTERCEPTED,
      interceptDetails: `拦截履约动作：${interceptType}`,
      originalRequest: requestData
    });

    await FreezeOperationLog.create({
      freezeId: freeze.id,
      operationType: OperationType.INTERCEPT,
      beforeStatus: freeze.status,
      afterStatus: freeze.status,
      operationDetails: `拦截履约动作：${interceptType}`,
      originalInput: requestData
    });

    return {
      shouldIntercept: true,
      freezeId: freeze.id,
      orderNo: orderNo,
      riskReason: freeze.risk_reason,
      message: '订单已被冻结，履约动作被拦截'
    };
  }

  static async getById(id) {
    const freeze = await OrderFreeze.findById(id);
    if (!freeze) return null;

    const logs = await FreezeOperationLog.findByFreezeId(id);
    const intercepts = await FulfillmentIntercept.findByFreezeId(id);

    return {
      ...freeze,
      operationLogs: logs,
      fulfillmentIntercepts: intercepts
    };
  }

  static async query(filters = {}, pagination = {}) {
    const list = await OrderFreeze.findAll(filters, pagination);
    const total = await OrderFreeze.count(filters);

    return {
      list: list,
      total: total,
      page: Math.floor(pagination.offset / pagination.limit) + 1,
      pageSize: pagination.limit
    };
  }

  static async getOperationLogs(freezeId) {
    return FreezeOperationLog.findByFreezeId(freezeId);
  }

  static async addProcessingSummary(id, summary, operatorInfo = {}) {
    const freeze = await OrderFreeze.addProcessingSummary(id, summary);
    
    await FreezeOperationLog.create({
      freezeId: id,
      operationType: OperationType.EXCEPTION,
      operator: operatorInfo.operator,
      beforeStatus: freeze.status,
      afterStatus: freeze.status,
      operationDetails: `添加处理摘要：${summary}`,
      ipAddress: operatorInfo.ipAddress,
      userAgent: operatorInfo.userAgent
    });

    return freeze;
  }

  static async recordException(id, errorInfo, originalInput, operatorInfo = {}) {
    const freeze = await OrderFreeze.findById(id);
    if (!freeze) {
      throw new Error('冻结记录不存在');
    }

    const summary = `异常记录: ${errorInfo.message || errorInfo}`;
    await OrderFreeze.addProcessingSummary(id, summary);

    await FreezeOperationLog.create({
      freezeId: id,
      operationType: OperationType.EXCEPTION,
      operator: operatorInfo.operator,
      beforeStatus: freeze.status,
      afterStatus: freeze.status,
      operationDetails: summary,
      originalInput: originalInput,
      processingBasis: JSON.stringify(errorInfo),
      ipAddress: operatorInfo.ipAddress,
      userAgent: operatorInfo.userAgent
    });

    return this.getById(id);
  }
}

module.exports = OrderFreezeService;
