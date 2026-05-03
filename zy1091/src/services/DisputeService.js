const { Op } = require('sequelize');
const moment = require('moment');
const {
  Dispute,
  Bill,
  SplitRule,
  PaymentRecord,
  ChoreTask,
  Flatmate,
  PointAdjustment,
  Notification,
} = require('../models');
const {
  STATUS_MAP,
  ERROR_CODES,
  NOTIFICATION_TYPES,
} = require('../config/constants');
const BillService = require('./BillService');

class DisputeService {
  static async createDispute(disputeData, raisedById, options = {}) {
    const transaction = options.transaction || await Dispute.sequelize.transaction();
    
    try {
      // 1. 验证数据
      await this.validateDisputeData(disputeData);
      
      // 2. 检查关联的资源是否存在
      const relatedEntity = await this.getRelatedEntity(disputeData, transaction);
      
      // 3. 创建争议单
      const dispute = await Dispute.create(
        {
          dispute_type: disputeData.dispute_type,
          bill_id: disputeData.bill_id || null,
          split_rule_id: disputeData.split_rule_id || null,
          payment_id: disputeData.payment_id || null,
          task_id: disputeData.task_id || null,
          raised_by_id: raisedById,
          title: disputeData.title,
          description: disputeData.description,
          status: STATUS_MAP.DISPUTE.OPEN,
          priority: disputeData.priority || 'medium',
          proposed_solution: disputeData.proposed_solution || null,
          evidence_image_urls: disputeData.evidence_image_urls ? JSON.stringify(disputeData.evidence_image_urls) : null,
          notes: disputeData.notes || null,
        },
        { transaction }
      );
      
      // 4. 更新关联资源的状态
      await this.updateRelatedEntityStatus(relatedEntity, disputeData, transaction);
      
      // 5. 发送通知
      await this.sendDisputeCreatedNotifications(dispute, raisedById, transaction);
      
      if (!options.transaction) {
        await transaction.commit();
      }
      
      return dispute;
    } catch (error) {
      if (!options.transaction) {
        await transaction.rollback();
      }
      throw error;
    }
  }

  static async validateDisputeData(disputeData) {
    if (!disputeData.dispute_type) {
      throw { code: ERROR_CODES.INVALID_INPUT, message: '争议类型不能为空' };
    }
    
    const validTypes = ['bill', 'payment', 'chore', 'point'];
    if (!validTypes.includes(disputeData.dispute_type)) {
      throw { code: ERROR_CODES.INVALID_INPUT, message: '无效的争议类型' };
    }
    
    if (!disputeData.title || disputeData.title.trim() === '') {
      throw { code: ERROR_CODES.INVALID_INPUT, message: '争议标题不能为空' };
    }
    
    if (!disputeData.description || disputeData.description.trim() === '') {
      throw { code: ERROR_CODES.INVALID_INPUT, message: '争议描述不能为空' };
    }
    
    // 根据争议类型验证关联ID
    switch (disputeData.dispute_type) {
      case 'bill':
        if (!disputeData.bill_id) {
          throw { code: ERROR_CODES.INVALID_INPUT, message: '账单争议需要指定账单ID' };
        }
        break;
      case 'payment':
        if (!disputeData.payment_id) {
          throw { code: ERROR_CODES.INVALID_INPUT, message: '付款争议需要指定付款记录ID' };
        }
        break;
      case 'chore':
        if (!disputeData.task_id) {
          throw { code: ERROR_CODES.INVALID_INPUT, message: '家务争议需要指定任务ID' };
        }
        break;
      case 'point':
        // 积分争议可以没有特定关联ID
        break;
    }
  }

  static async getRelatedEntity(disputeData, transaction) {
    let entity = null;
    
    switch (disputeData.dispute_type) {
      case 'bill':
        entity = await Bill.findOne({
          where: { id: disputeData.bill_id },
          include: [
            { model: SplitRule, as: 'splitRules' },
          ],
          transaction,
        });
        if (!entity) {
          throw { code: ERROR_CODES.BILL_NOT_FOUND, message: '账单不存在' };
        }
        break;
        
      case 'payment':
        entity = await PaymentRecord.findOne({
          where: { id: disputeData.payment_id },
          include: [
            { model: Bill, as: 'bill' },
          ],
          transaction,
        });
        if (!entity) {
          throw { code: ERROR_CODES.PAYMENT_NOT_FOUND, message: '付款记录不存在' };
        }
        break;
        
      case 'chore':
        entity = await ChoreTask.findOne({
          where: { id: disputeData.task_id },
          transaction,
        });
        if (!entity) {
          throw { code: ERROR_CODES.CHORE_NOT_FOUND, message: '任务不存在' };
        }
        break;
    }
    
    return entity;
  }

  static async updateRelatedEntityStatus(entity, disputeData, transaction) {
    if (!entity) return;
    
    switch (disputeData.dispute_type) {
      case 'bill':
        // 更新账单状态为有争议
        await entity.update(
          {
            has_dispute: true,
            status: STATUS_MAP.BILL.DISPUTED,
          },
          { transaction }
        );
        
        // 更新所有关联的分摊规则
        await SplitRule.update(
          { status: STATUS_MAP.SPLIT_RULE.DISPUTED },
          {
            where: { bill_id: entity.id },
            transaction,
          }
        );
        break;
        
      case 'payment':
        // 更新付款记录状态
        await entity.update(
          { status: STATUS_MAP.PAYMENT.DISPUTED },
          { transaction }
        );
        break;
        
      case 'chore':
        // 更新任务状态
        await entity.update(
          { status: STATUS_MAP.CHORE.DISPUTED },
          { transaction }
        );
        break;
    }
  }

  static async resolveDispute(disputeId, resolutionData, resolvedById, options = {}) {
    const transaction = options.transaction || await Dispute.sequelize.transaction();
    
    try {
      const dispute = await Dispute.findOne({
        where: { id: disputeId },
        include: [
          { model: Bill, as: 'bill' },
          { model: PaymentRecord, as: 'payment' },
          { model: ChoreTask, as: 'task' },
          { model: Flatmate, as: 'raisedBy' },
        ],
        transaction,
      });
      
      if (!dispute) {
        throw { code: ERROR_CODES.DISPUTE_NOT_FOUND, message: '争议单不存在' };
      }
      
      if (dispute.status === STATUS_MAP.DISPUTE.RESOLVED ||
          dispute.status === STATUS_MAP.DISPUTE.CLOSED) {
        throw { code: ERROR_CODES.DISPUTE_ALREADY_RESOLVED, message: '争议单已解决或已关闭' };
      }
      
      if (!resolutionData.resolution || resolutionData.resolution.trim() === '') {
        throw { code: ERROR_CODES.INVALID_INPUT, message: '解决方案不能为空' };
      }
      
      // 更新争议单
      await dispute.update(
        {
          status: STATUS_MAP.DISPUTE.RESOLVED,
          resolution: resolutionData.resolution,
          resolved_by_id: resolvedById,
          resolved_at: moment().toDate(),
          requires_balance_recalculation: resolutionData.requires_balance_recalculation || false,
          notes: resolutionData.notes || dispute.notes,
        },
        { transaction }
      );
      
      // 如果需要重新计算余额
      if (resolutionData.requires_balance_recalculation) {
        await this.recalculateBalances(dispute, resolutionData, resolvedById, transaction);
      }
      
      // 恢复关联实体的状态
      await this.restoreRelatedEntityStatus(dispute, transaction);
      
      // 发送通知
      await this.sendDisputeResolvedNotifications(dispute, transaction);
      
      if (!options.transaction) {
        await transaction.commit();
      }
      
      return dispute;
    } catch (error) {
      if (!options.transaction) {
        await transaction.rollback();
      }
      throw error;
    }
  }

  static async recalculateBalances(dispute, resolutionData, resolvedById, transaction) {
    // 根据争议类型执行不同的重新计算逻辑
    
    switch (dispute.dispute_type) {
      case 'bill':
        await this.recalculateBillBalances(dispute, resolutionData, resolvedById, transaction);
        break;
        
      case 'payment':
        await this.recalculatePaymentBalances(dispute, resolutionData, resolvedById, transaction);
        break;
        
      case 'chore':
        await this.recalculateChoreBalances(dispute, resolutionData, resolvedById, transaction);
        break;
        
      case 'point':
        await this.recalculatePointBalances(dispute, resolutionData, resolvedById, transaction);
        break;
    }
  }

  static async recalculateBillBalances(dispute, resolutionData, resolvedById, transaction) {
    const bill = dispute.bill;
    if (!bill) return;
    
    // 如果有新的分摊规则
    if (resolutionData.new_split_rules) {
      // 删除旧的分摊规则
      await SplitRule.destroy({
        where: { bill_id: bill.id },
        transaction,
      });
      
      // 创建新的分摊规则
      for (const ruleData of resolutionData.new_split_rules) {
        await SplitRule.create(
          {
            bill_id: bill.id,
            flatmate_id: ruleData.flatmate_id,
            split_type: ruleData.split_type || bill.split_type,
            ratio: ruleData.ratio,
            amount: ruleData.amount,
            status: STATUS_MAP.SPLIT_RULE.PENDING,
            due_date: bill.due_date,
          },
          { transaction }
        );
      }
      
      // 更新账单状态
      await bill.update(
        {
          total_paid_amount: 0,
          points_deducted: 0,
          has_dispute: false,
        },
        { transaction }
      );
      
      // 重新计算账单状态
      await BillService.updateBillStatus(bill.id, transaction);
    }
  }

  static async recalculatePaymentBalances(dispute, resolutionData, resolvedById, transaction) {
    const payment = dispute.payment;
    if (!payment) return;
    
    // 根据解决方案处理付款记录
    if (resolutionData.reject_payment) {
      // 拒绝付款，将状态设为 rejected
      await payment.update(
        {
          status: STATUS_MAP.PAYMENT.REJECTED,
          rejected_at: moment().toDate(),
          rejection_reason: resolutionData.rejection_reason || '争议解决后拒绝',
        },
        { transaction }
      );
      
      // 更新对应的分摊规则
      if (payment.split_rule_id) {
        const splitRule = await SplitRule.findOne({
          where: { id: payment.split_rule_id },
          transaction,
        });
        
        if (splitRule) {
          const newPaidAmount = Math.max(
            0,
            parseFloat(splitRule.paid_amount) - parseFloat(payment.amount)
          ).toFixed(2);
          
          await splitRule.update(
            {
              paid_amount: newPaidAmount,
              status: newPaidAmount >= parseFloat(splitRule.amount) 
                ? STATUS_MAP.SPLIT_RULE.PAID 
                : (newPaidAmount > 0 ? STATUS_MAP.SPLIT_RULE.PARTIAL : STATUS_MAP.SPLIT_RULE.PENDING,
            },
            { transaction }
          );
        }
      }
      
      // 更新账单状态
      if (payment.bill_id) {
        await BillService.updateBillStatus(payment.bill_id, transaction);
      }
    } else if (resolutionData.confirm_payment) {
      // 确认付款
      await payment.update(
        {
          status: STATUS_MAP.PAYMENT.CONFIRMED,
          confirmed_by_id: resolvedById,
          confirmed_at: moment().toDate(),
        },
        { transaction }
      );
    }
  }

  static async recalculateChoreBalances(dispute, resolutionData, resolvedById, transaction) {
    const task = dispute.task;
    if (!task) return;
    
    if (resolutionData.mark_as_completed) {
      // 标记任务为已完成
      const flatmateId = task.assigned_to_id || resolvedById;
      const flatmate = await Flatmate.findOne({
        where: { id: flatmateId },
        transaction,
      });
      
      if (flatmate) {
        const oldPoints = flatmate.points;
        const newPoints = oldPoints + task.points_reward;
        
        await PointAdjustment.create(
          {
            flatmate_id: flatmateId,
            task_id: task.id,
            adjustment_type: 'reward',
            points: task.points_reward,
            balance_before: oldPoints,
            balance_after: newPoints,
            monetary_value: (task.points_reward * 0.1).toFixed(2),
            reason: `争议解决后，家务任务 "${task.title}" 被标记为完成`,
            is_system_generated: true,
          },
          { transaction }
        );
        
        await flatmate.update(
          { points: newPoints },
          { transaction }
        );
      }
      
      await task.update(
        {
          status: STATUS_MAP.CHORE.COMPLETED,
          completed_at: moment().toDate(),
          completed_by_id: flatmateId,
        },
        { transaction }
      );
    } else if (resolutionData.mark_as_missed) {
      // 标记任务为爽约
      if (task.assigned_to_id) {
        const flatmate = await Flatmate.findOne({
          where: { id: task.assigned_to_id },
          transaction,
        });
        
        if (flatmate) {
          const oldPoints = flatmate.points;
          const newPoints = Math.max(0, oldPoints - task.points_penalty);
          
          await PointAdjustment.create(
            {
              flatmate_id: task.assigned_to_id,
              task_id: task.id,
              adjustment_type: 'penalty',
              points: -task.points_penalty,
              balance_before: oldPoints,
              balance_after: newPoints,
              monetary_value: (task.points_penalty * 0.1).toFixed(2),
              reason: `争议解决后，家务任务 "${task.title}" 被标记为爽约`,
              is_system_generated: true,
            },
            { transaction }
          );
          
          await flatmate.update(
            { points: newPoints },
            { transaction }
          );
        }
      }
      
      await task.update(
        { status: STATUS_MAP.CHORE.MISSED },
        { transaction }
      );
    }
  }

  static async recalculatePointBalances(dispute, resolutionData, resolvedById, transaction) {
    // 积分争议处理
    if (resolutionData.point_adjustment) {
      const { flatmateId = resolutionData.flatmate_id;
      const flatmate = await Flatmate.findOne({
        where: { id: flatmateId },
        transaction,
      });
      
      if (flatmate) {
        const oldPoints = flatmate.points;
        const adjustment = resolutionData.point_adjustment;
        const newPoints = Math.max(0, oldPoints + adjustment);
        
        await PointAdjustment.create(
          {
            flatmate_id: flatmateId,
            adjustment_type: adjustment > 0 ? 'manual_add' : 'manual_subtract',
            points: adjustment,
            balance_before: oldPoints,
            balance_after: newPoints,
            reason: `争议解决后的积分调整: ${resolutionData.resolution`,
            operator_id: resolvedById,
            is_system_generated: false,
          },
          { transaction }
        );
        
        await flatmate.update(
          { points: newPoints },
          { transaction }
        );
      }
    }
  }

  static async restoreRelatedEntityStatus(dispute, transaction) {
    // 恢复关联实体的状态
    switch (dispute.dispute_type) {
      case 'bill':
        if (dispute.bill) {
          // 重新计算账单状态，它会自动更新 has_dispute 等
          await BillService.updateBillStatus(dispute.bill.id, transaction);
        }
        break;
        
      case 'payment':
        if (dispute.payment && dispute.payment.bill_id) {
          await BillService.updateBillStatus(dispute.payment.bill_id, transaction);
        }
        break;
    }
  }

  static async getDisputeWithDetails(disputeId) {
    const dispute = await Dispute.findOne({
      where: { id: disputeId },
      include: [
        {
          model: Flatmate,
          as: 'raisedBy',
          attributes: ['id', 'name', 'email'],
        },
        {
          model: Flatmate,
          as: 'assignedTo',
          attributes: ['id', 'name'],
        },
        {
          model: Flatmate,
          as: 'resolvedBy',
          attributes: ['id', 'name'],
        },
        {
          model: Bill,
          as: 'bill',
          include: [
            { model: SplitRule, as: 'splitRules' },
          ],
        },
        {
          model: PaymentRecord,
          as: 'payment',
          include: [
            { model: Flatmate, as: 'payer', attributes: ['id', 'name'] },
          ],
        },
        {
          model: ChoreTask,
          as: 'task',
          include: [
            { model: Flatmate, as: 'assignedTo', attributes: ['id', 'name'] },
          ],
        },
      ],
    });
    
    if (!dispute) {
      throw { code: ERROR_CODES.DISPUTE_NOT_FOUND, message: '争议单不存在' };
    }
    
    return dispute;
  }

  static async getDisputes(options = {}) {
    const { status, dispute_type, raised_by, assigned_to, limit = 20, offset = 0 } = options;
    
    const whereClause = {};
    
    if (status) {
      whereClause.status = status;
    }
    
    if (dispute_type) {
      whereClause.dispute_type = dispute_type;
    }
    
    if (raised_by) {
      whereClause.raised_by_id = raised_by;
    }
    
    if (assigned_to) {
      whereClause.assigned_to_id = assigned_to;
    }
    
    const disputes = await Dispute.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Flatmate,
          as: 'raisedBy',
          attributes: ['id', 'name'],
        },
        {
          model: Flatmate,
          as: 'assignedTo',
          attributes: ['id', 'name'],
        },
      ],
      order: [
        ['priority', 'DESC'],
        ['created_at', 'DESC'],
      ],
      limit,
      offset,
    });
    
    return {
      total: disputes.count,
      items: disputes.rows,
      limit,
      offset,
    };
  }

  static async sendDisputeCreatedNotifications(dispute, raisedById, transaction) {
    // 通知发起人
    await Notification.create(
      {
        recipient_id: raisedById,
        notification_type: NOTIFICATION_TYPES.BILL_DISPUTE_OPENED,
        title: `争议单已创建`,
        content: `您创建的争议单 "${dispute.title}" 已提交，状态: 待处理`,
        is_read: false,
        is_urgent: dispute.priority === 'high',
        dispute_id: dispute.id,
      },
      { transaction }
    );
    
    // 通知所有管理员
    const admins = await Flatmate.findAll({
      where: { is_admin: true, status: 'active' },
      transaction,
    });
    
    for (const admin of admins) {
      await Notification.create(
        {
          recipient_id: admin.id,
          notification_type: NOTIFICATION_TYPES.DISPUTE_ASSIGNED,
          title: `新争议单需要处理`,
          content: `有一个新的争议单 "${dispute.title}" 需要您处理，优先级: ${dispute.priority}`,
          is_read: false,
          is_urgent: dispute.priority === 'high',
          dispute_id: dispute.id,
        },
        { transaction }
      );
    }
  }

  static async sendDisputeResolvedNotifications(dispute, transaction) {
    // 通知发起人
    await Notification.create(
      {
        recipient_id: dispute.raised_by_id,
        notification_type: NOTIFICATION_TYPES.BILL_DISPUTE_RESOLVED,
        title: `争议单已解决`,
        content: `您的争议单 "${dispute.title}" 已解决。解决方案: ${dispute.resolution}`,
        is_read: false,
        is_urgent: false,
        dispute_id: dispute.id,
      },
      { transaction }
    );
  }
}

module.exports = DisputeService;
