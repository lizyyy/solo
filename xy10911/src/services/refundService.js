const { Refund, REFUND_STATUS } = require('../models/Refund');
const Payment = require('../models/Payment');
const StartEvent = require('../models/StartEvent');

class RefundService {
  static async verifyPayment(paymentId, expectedAmount = null, expectedMachineId = null) {
    const payment = await Payment.findById(paymentId);
    if (!payment) {
      return { valid: false, reason: '支付记录不存在' };
    }
    if (payment.status !== 'success') {
      return { valid: false, reason: '支付状态不成功' };
    }
    if (expectedAmount !== null && Math.abs(payment.amount - expectedAmount) > 0.01) {
      return { valid: false, reason: '支付金额不匹配' };
    }
    if (expectedMachineId !== null && payment.machine_id !== expectedMachineId) {
      return { valid: false, reason: `支付记录所属机器 ${payment.machine_id} 与申请机器 ${expectedMachineId} 不一致` };
    }
    return { valid: true, payment };
  }

  static async matchStartEvent(paymentId, machineId, faultCode = null) {
    const startEvents = await StartEvent.findByPaymentId(paymentId);
    if (startEvents.length === 0) {
      return { matched: false, reason: '未找到对应的启动事件' };
    }

    const failedEvent = startEvents.find(e => !e.success);
    if (!failedEvent) {
      return { matched: false, reason: '启动事件全部成功，无故障记录' };
    }

    if (faultCode && failedEvent.error_code !== faultCode) {
      return { matched: false, reason: '故障代码不匹配' };
    }

    return { matched: true, event: failedEvent };
  }

  static async checkDuplicateRefund(paymentId) {
    const refunds = await Refund.findByPaymentId(paymentId);
    if (refunds.length > 0) {
      const activeRefund = refunds.find(r => 
        [REFUND_STATUS.PENDING, REFUND_STATUS.VERIFYING, REFUND_STATUS.APPROVED, REFUND_STATUS.REFUNDING].includes(r.status)
      );
      if (activeRefund) {
        return { duplicate: true, existingRefund: activeRefund };
      }
    }
    return { duplicate: false };
  }

  static async createRefundApplication(data) {
    const rawInput = JSON.stringify(data);

    const duplicateCheck = await this.checkDuplicateRefund(data.payment_id);
    if (duplicateCheck.duplicate) {
      return {
        success: false,
        error: 'DUPLICATE_REFUND',
        message: '该支付已有进行中的退款申请',
        existingRefundId: duplicateCheck.existingRefund.refund_id
      };
    }

    const paymentCheck = await this.verifyPayment(data.payment_id, data.amount, data.machine_id);
    if (!paymentCheck.valid) {
      const refund = await Refund.create({
        ...data,
        raw_input: rawInput
      });
      await Refund.addLog(
        refund.refund_id,
        'payment_verification_failed',
        'system',
        paymentCheck.reason,
        '支付核验失败，申请记录已保存但需要人工复核'
      );
      await Refund.updateStatus(refund.refund_id, REFUND_STATUS.FAILED, 'system', paymentCheck.reason, '');
      
      return {
        success: false,
        error: 'PAYMENT_VERIFICATION_FAILED',
        message: paymentCheck.reason,
        refund_id: refund.refund_id
      };
    }

    const eventMatch = await this.matchStartEvent(
      data.payment_id, 
      data.machine_id, 
      data.fault_code
    );
    let startEventId = data.start_event_id;
    if (eventMatch.matched) {
      startEventId = eventMatch.event.event_id;
    }

    const refund = await Refund.create({
      ...data,
      start_event_id: startEventId,
      raw_input: rawInput
    });

    await Refund.addLog(
      refund.refund_id,
      'application_created',
      'system',
      eventMatch.matched ? '启动事件匹配成功' : '启动事件未匹配，待人工确认',
      eventMatch.matched ? `匹配到启动事件: ${startEventId}` : '需要人工核实故障情况'
    );

    if (eventMatch.matched) {
      await Refund.updateStatus(refund.refund_id, REFUND_STATUS.VERIFYING, 'system', '进入自动核验流程', '');
    }

    return {
      success: true,
      data: refund
    };
  }

  static async advanceRefundStatus(refundId, targetStatus, operator = 'system', remarks = '') {
    const refund = await Refund.findById(refundId);
    if (!refund) {
      return { success: false, error: 'REFUND_NOT_FOUND', message: '退款申请不存在' };
    }

    const validTransitions = {
      [REFUND_STATUS.PENDING]: [REFUND_STATUS.VERIFYING, REFUND_STATUS.REJECTED],
      [REFUND_STATUS.VERIFYING]: [REFUND_STATUS.APPROVED, REFUND_STATUS.REJECTED],
      [REFUND_STATUS.APPROVED]: [REFUND_STATUS.REFUNDING, REFUND_STATUS.REJECTED],
      [REFUND_STATUS.REFUNDING]: [REFUND_STATUS.COMPLETED, REFUND_STATUS.FAILED],
      [REFUND_STATUS.COMPLETED]: [],
      [REFUND_STATUS.REJECTED]: [],
      [REFUND_STATUS.FAILED]: [REFUND_STATUS.PENDING, REFUND_STATUS.VERIFYING]
    };

    if (!validTransitions[refund.status].includes(targetStatus)) {
      return {
        success: false,
        error: 'INVALID_STATUS_TRANSITION',
        message: `无法从 ${refund.status} 状态转换到 ${targetStatus}`,
        currentStatus: refund.status
      };
    }

    const conclusion = `状态从 ${refund.status} 变更为 ${targetStatus}`;
    await Refund.updateStatus(refundId, targetStatus, operator, conclusion, remarks);

    return {
      success: true,
      data: { refund_id: refundId, status: targetStatus }
    };
  }

  static async manualCorrect(refundId, updateData, operator) {
    const refund = await Refund.findById(refundId);
    if (!refund) {
      return { success: false, error: 'REFUND_NOT_FOUND', message: '退款申请不存在' };
    }

    const updateFields = [];
    const params = [];
    
    const allowedFields = ['amount', 'fault_code', 'reason', 'applicant_name', 'applicant_phone'];
    allowedFields.forEach(field => {
      if (updateData[field] !== undefined) {
        updateFields.push(`${field} = ?`);
        params.push(updateData[field]);
      }
    });

    if (updateFields.length === 0) {
      return { success: false, error: 'NO_FIELDS_TO_UPDATE', message: '没有需要更新的字段' };
    }

    params.push(refundId);

    const db = require('../config/database');
    await new Promise((resolve, reject) => {
      db.run(
        `UPDATE refund_applications SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE refund_id = ?`,
        params,
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    await Refund.addLog(
      refundId,
      'manual_correction',
      operator,
      '人工修正申请信息',
      `更新字段: ${allowedFields.filter(f => updateData[f] !== undefined).join(', ')}`
    );

    const updatedRefund = await Refund.findById(refundId);
    return { success: true, data: updatedRefund };
  }

  static async handleException(refundId, errorDetails, operator) {
    const refund = await Refund.findById(refundId);
    if (!refund) {
      return { success: false, error: 'REFUND_NOT_FOUND', message: '退款申请不存在' };
    }

    await Refund.addLog(
      refundId,
      'exception_occurred',
      operator,
      '处理异常',
      JSON.stringify(errorDetails)
    );

    await Refund.updateStatus(
      refundId, 
      REFUND_STATUS.FAILED, 
      operator, 
      '处理异常，进入失败状态', 
      errorDetails.message || '未知错误'
    );

    return { success: true, message: '异常已记录' };
  }
}

module.exports = RefundService;
