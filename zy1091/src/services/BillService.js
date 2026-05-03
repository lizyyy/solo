const { Op, Transaction } = require('sequelize');
const moment = require('moment');
const {
  Bill,
  SplitRule,
  Flatmate,
  PaymentRecord,
  PointAdjustment,
  Notification,
} = require('../models');
const {
  STATUS_MAP,
  SPLIT_TYPES,
  POINTS_CONFIG,
  ERROR_CODES,
  NOTIFICATION_TYPES,
} = require('../config/constants');

class BillService {
  static async createBill(billData, creatorId, options = {}) {
    const transaction = options.transaction || await Bill.sequelize.transaction();
    
    try {
      // 1. 验证输入数据
      await this.validateBillData(billData);
      
      // 2. 创建账单
      const bill = await Bill.create(
        {
          title: billData.title,
          description: billData.description,
          category: billData.category || 'other',
          total_amount: billData.total_amount,
          split_type: billData.split_type,
          status: STATUS_MAP.BILL.PENDING,
          due_date: billData.due_date || null,
          creator_id: creatorId,
          advanced_by_id: billData.advanced_by_id || null,
          notes: billData.notes || null,
        },
        { transaction }
      );
      
      // 3. 生成分摊规则
      const splitRules = await this.generateSplitRules(
        bill,
        billData.split_config,
        creatorId,
        transaction
      );
      
      // 4. 更新账单的分摊规则
      bill.splitRules = splitRules;
      
      // 5. 发送通知给相关室友
      await this.sendBillCreatedNotifications(bill, splitRules, transaction);
      
      if (!options.transaction) {
        await transaction.commit();
      }
      
      return {
        bill,
        splitRules,
      };
    } catch (error) {
      if (!options.transaction) {
        await transaction.rollback();
      }
      throw error;
    }
  }

  static async validateBillData(billData) {
    if (!billData.title || billData.title.trim() === '') {
      throw { code: ERROR_CODES.INVALID_INPUT, message: '账单标题不能为空' };
    }
    
    if (!billData.total_amount || billData.total_amount <= 0) {
      throw { code: ERROR_CODES.INVALID_INPUT, message: '账单金额必须大于0' };
    }
    
    if (!Object.values(SPLIT_TYPES).includes(billData.split_type)) {
      throw { code: ERROR_CODES.INVALID_INPUT, message: '无效的分摊方式' };
    }
    
    if (billData.due_date) {
      const dueDate = moment(billData.due_date);
      if (dueDate.isBefore(moment().startOf('day'))) {
        throw { code: ERROR_CODES.INVALID_INPUT, message: '截止日期不能早于今天' };
      }
    }
  }

  static async generateSplitRules(bill, splitConfig, creatorId, transaction) {
    const flatmates = await Flatmate.findAll({
      where: { status: 'active' },
      transaction,
    });
    
    if (flatmates.length === 0) {
      throw { code: ERROR_CODES.NOT_FOUND, message: '没有活跃的室友' };
    }
    
    let splitRules = [];
    
    switch (bill.split_type) {
      case SPLIT_TYPES.EQUAL:
        splitRules = await this.generateEqualSplitRules(bill, flatmates, transaction);
        break;
        
      case SPLIT_TYPES.RATIO:
        if (!splitConfig || !splitConfig.ratios) {
          throw { code: ERROR_CODES.INVALID_INPUT, message: '按比例分摊需要提供比例配置' };
        }
        splitRules = await this.generateRatioSplitRules(bill, splitConfig.ratios, flatmates, transaction);
        break;
        
      case SPLIT_TYPES.SPECIFIC:
        if (!splitConfig || !splitConfig.assignments) {
          throw { code: ERROR_CODES.INVALID_INPUT, message: '指定人员分摊需要提供人员配置' };
        }
        splitRules = await this.generateSpecificSplitRules(bill, splitConfig.assignments, transaction);
        break;
        
      case SPLIT_TYPES.ADVANCE:
        if (!bill.advanced_by_id) {
          throw { code: ERROR_CODES.INVALID_INPUT, message: '垫付报销需要指定垫付人' };
        }
        splitRules = await this.generateAdvanceSplitRules(bill, flatmates, transaction);
        break;
        
      default:
        throw { code: ERROR_CODES.INVALID_INPUT, message: '不支持的分摊方式' };
    }
    
    return splitRules;
  }

  static async generateEqualSplitRules(bill, flatmates, transaction) {
    const splitRules = [];
    const activeFlatmates = flatmates.filter(f => f.status === 'active');
    const amountPerPerson = (parseFloat(bill.total_amount) / activeFlatmates.length).toFixed(2);
    
    for (const flatmate of activeFlatmates) {
      const rule = await SplitRule.create(
        {
          bill_id: bill.id,
          flatmate_id: flatmate.id,
          split_type: SPLIT_TYPES.EQUAL,
          ratio: (1 / activeFlatmates.length).toFixed(4),
          amount: amountPerPerson,
          status: STATUS_MAP.SPLIT_RULE.PENDING,
          due_date: bill.due_date,
        },
        { transaction }
      );
      splitRules.push(rule);
    }
    
    return splitRules;
  }

  static async generateRatioSplitRules(bill, ratios, flatmates, transaction) {
    const splitRules = [];
    const activeFlatmateMap = {};
    
    for (const flatmate of flatmates) {
      if (flatmate.status === 'active') {
        activeFlatmateMap[flatmate.id] = flatmate;
      }
    }
    
    // 验证比例总和是否为100%
    let totalRatio = 0;
    for (const ratioConfig of ratios) {
      if (!activeFlatmateMap[ratioConfig.flatmate_id]) {
        throw { 
          code: ERROR_CODES.FLATMATE_NOT_ACTIVE, 
          message: `室友ID ${ratioConfig.flatmate_id} 不是活跃状态` 
        };
      }
      totalRatio += ratioConfig.ratio;
    }
    
    // 允许有微小的浮点误差
    if (Math.abs(totalRatio - 1) > 0.0001) {
      throw { 
        code: ERROR_CODES.SPLIT_RATIO_NOT_100, 
        message: '分摊比例总和必须为100%' 
      };
    }
    
    for (const ratioConfig of ratios) {
      const amount = (parseFloat(bill.total_amount) * ratioConfig.ratio).toFixed(2);
      const rule = await SplitRule.create(
        {
          bill_id: bill.id,
          flatmate_id: ratioConfig.flatmate_id,
          split_type: SPLIT_TYPES.RATIO,
          ratio: ratioConfig.ratio.toFixed(4),
          amount: amount,
          status: STATUS_MAP.SPLIT_RULE.PENDING,
          due_date: bill.due_date,
        },
        { transaction }
      );
      splitRules.push(rule);
    }
    
    return splitRules;
  }

  static async generateSpecificSplitRules(bill, assignments, transaction) {
    const splitRules = [];
    
    // 验证分配的总金额是否等于账单总金额
    let totalAmount = 0;
    for (const assignment of assignments) {
      const flatmate = await Flatmate.findOne({
        where: { id: assignment.flatmate_id, status: 'active' },
        transaction,
      });
      
      if (!flatmate) {
        throw { 
          code: ERROR_CODES.FLATMATE_NOT_ACTIVE, 
          message: `室友ID ${assignment.flatmate_id} 不是活跃状态` 
        };
      }
      
      if (!assignment.amount || assignment.amount <= 0) {
        throw { 
          code: ERROR_CODES.INVALID_INPUT, 
          message: '分配金额必须大于0' 
        };
      }
      
      totalAmount += assignment.amount;
    }
    
    if (Math.abs(totalAmount - parseFloat(bill.total_amount)) > 0.01) {
      throw { 
        code: ERROR_CODES.INVALID_SPLIT_RULE, 
        message: '分配总金额必须等于账单总金额' 
      };
    }
    
    for (const assignment of assignments) {
      const rule = await SplitRule.create(
        {
          bill_id: bill.id,
          flatmate_id: assignment.flatmate_id,
          split_type: SPLIT_TYPES.SPECIFIC,
          ratio: null,
          amount: assignment.amount.toFixed(2),
          status: STATUS_MAP.SPLIT_RULE.PENDING,
          due_date: bill.due_date,
        },
        { transaction }
      );
      splitRules.push(rule);
    }
    
    return splitRules;
  }

  static async generateAdvanceSplitRules(bill, flatmates, transaction) {
    const splitRules = [];
    const advancedBy = await Flatmate.findOne({
      where: { id: bill.advanced_by_id, status: 'active' },
      transaction,
    });
    
    if (!advancedBy) {
      throw { 
        code: ERROR_CODES.FLATMATE_NOT_ACTIVE, 
        message: '垫付人不是活跃状态' 
      };
    }
    
    const activeFlatmates = flatmates.filter(f => f.status === 'active');
    const amountPerPerson = (parseFloat(bill.total_amount) / activeFlatmates.length).toFixed(2);
    
    for (const flatmate of activeFlatmates) {
      const isAdvancedBy = flatmate.id === bill.advanced_by_id;
      const rule = await SplitRule.create(
        {
          bill_id: bill.id,
          flatmate_id: flatmate.id,
          split_type: SPLIT_TYPES.ADVANCE,
          ratio: (1 / activeFlatmates.length).toFixed(4),
          amount: amountPerPerson,
          status: isAdvancedBy ? STATUS_MAP.SPLIT_RULE.PAID : STATUS_MAP.SPLIT_RULE.PENDING,
          due_date: bill.due_date,
          is_advanced_by: isAdvancedBy,
        },
        { transaction }
      );
      splitRules.push(rule);
    }
    
    return splitRules;
  }

  static async recordPayment(paymentData, payerId, options = {}) {
    const transaction = options.transaction || await Bill.sequelize.transaction();
    
    try {
      // 1. 验证数据
      const bill = await Bill.findOne({
        where: { id: paymentData.bill_id },
        include: [
          {
            model: SplitRule,
            as: 'splitRules',
          },
        ],
        transaction,
      });
      
      if (!bill) {
        throw { code: ERROR_CODES.BILL_NOT_FOUND, message: '账单不存在' };
      }
      
      if (bill.status === STATUS_MAP.BILL.SETTLED) {
        throw { code: ERROR_CODES.BILL_ALREADY_SETTLED, message: '账单已结清' };
      }
      
      // 2. 查找对应的分摊规则
      let splitRule = null;
      if (paymentData.split_rule_id) {
        splitRule = await SplitRule.findOne({
          where: { id: paymentData.split_rule_id, bill_id: bill.id },
          transaction,
        });
      } else {
        // 如果没有指定分摊规则，查找付款人对应的规则
        splitRule = await SplitRule.findOne({
          where: { bill_id: bill.id, flatmate_id: payerId },
          transaction,
        });
      }
      
      if (!splitRule) {
        throw { code: ERROR_CODES.NOT_FOUND, message: '找不到对应的分摊规则' };
      }
      
      // 3. 验证付款金额
      const remainingAmount = parseFloat(splitRule.amount) - parseFloat(splitRule.paid_amount);
      if (paymentData.amount > remainingAmount) {
        throw { 
          code: ERROR_CODES.PAYMENT_AMOUNT_EXCEEDS, 
          message: `付款金额超过应付金额，最多可付 ${remainingAmount} 元` 
        };
      }
      
      // 4. 处理积分抵扣
      let pointsUsed = 0;
      let monetaryValueUsed = 0;
      
      if (paymentData.use_points && paymentData.points_to_use > 0) {
        const flatmate = await Flatmate.findOne({
          where: { id: payerId },
          transaction,
        });
        
        if (!flatmate) {
          throw { code: ERROR_CODES.FLATMATE_NOT_FOUND, message: '室友不存在' };
        }
        
        const maxPointsByAmount = Math.floor(remainingAmount / POINTS_CONFIG.EXCHANGE_RATE);
        const maxPointsByRate = Math.floor(
          (parseFloat(splitRule.amount) * POINTS_CONFIG.MAX_DEDUCTION_RATE) / POINTS_CONFIG.EXCHANGE_RATE
        );
        const maxPoints = Math.min(
          maxPointsByAmount,
          maxPointsByRate,
          POINTS_CONFIG.MAX_DEDUCTION_POINTS_PER_BILL,
          flatmate.points
        );
        
        pointsUsed = Math.min(paymentData.points_to_use, maxPoints);
        monetaryValueUsed = (pointsUsed * POINTS_CONFIG.EXCHANGE_RATE).toFixed(2);
        
        // 创建积分调整记录
        await PointAdjustment.create(
          {
            flatmate_id: payerId,
            bill_id: bill.id,
            adjustment_type: 'deduction',
            points: -pointsUsed,
            balance_before: flatmate.points,
            balance_after: flatmate.points - pointsUsed,
            monetary_value: parseFloat(monetaryValueUsed),
            reason: `使用积分抵扣账单 "${bill.title}" 的费用`,
            is_system_generated: true,
          },
          { transaction }
        );
        
        // 更新室友积分
        await flatmate.update(
          { points: flatmate.points - pointsUsed },
          { transaction }
        );
      }
      
      // 5. 创建付款记录
      const paymentRecord = await PaymentRecord.create(
        {
          bill_id: bill.id,
          split_rule_id: splitRule.id,
          payer_id: payerId,
          receiver_id: paymentData.receiver_id || null,
          amount: paymentData.amount,
          points_used: monetaryValueUsed,
          status: STATUS_MAP.PAYMENT.PENDING,
          payment_method: paymentData.payment_method || 'other',
          transaction_id: paymentData.transaction_id || null,
          notes: paymentData.notes || null,
        },
        { transaction }
      );
      
      // 6. 更新分摊规则
      const newPaidAmount = (
        parseFloat(splitRule.paid_amount) + 
        paymentData.amount + 
        parseFloat(monetaryValueUsed)
      ).toFixed(2);
      
      let newStatus = splitRule.status;
      if (parseFloat(newPaidAmount) >= parseFloat(splitRule.amount)) {
        newStatus = STATUS_MAP.SPLIT_RULE.PAID;
      } else if (parseFloat(newPaidAmount) > 0) {
        newStatus = STATUS_MAP.SPLIT_RULE.PARTIAL;
      }
      
      await splitRule.update(
        {
          paid_amount: newPaidAmount,
          points_used: (parseFloat(splitRule.points_used) + parseFloat(monetaryValueUsed)).toFixed(2),
          status: newStatus,
        },
        { transaction }
      );
      
      // 7. 更新账单状态
      await this.updateBillStatus(bill.id, transaction);
      
      // 8. 发送通知
      await this.sendPaymentCreatedNotifications(
        bill, 
        splitRule, 
        paymentRecord, 
        payerId,
        transaction
      );
      
      if (!options.transaction) {
        await transaction.commit();
      }
      
      return {
        paymentRecord,
        updatedSplitRule: splitRule,
        pointsUsed,
        monetaryValueUsed,
      };
    } catch (error) {
      if (!options.transaction) {
        await transaction.rollback();
      }
      throw error;
    }
  }

  static async confirmPayment(paymentId, confirmerId, options = {}) {
    const transaction = options.transaction || await Bill.sequelize.transaction();
    
    try {
      const paymentRecord = await PaymentRecord.findOne({
        where: { id: paymentId },
        include: [
          { model: Bill, as: 'bill' },
          { model: SplitRule, as: 'splitRule' },
          { model: Flatmate, as: 'payer' },
        ],
        transaction,
      });
      
      if (!paymentRecord) {
        throw { code: ERROR_CODES.PAYMENT_NOT_FOUND, message: '付款记录不存在' };
      }
      
      if (paymentRecord.status === STATUS_MAP.PAYMENT.CONFIRMED) {
        throw { code: ERROR_CODES.PAYMENT_ALREADY_CONFIRMED, message: '付款已确认' };
      }
      
      // 更新付款记录
      await paymentRecord.update(
        {
          status: STATUS_MAP.PAYMENT.CONFIRMED,
          confirmed_by_id: confirmerId,
          confirmed_at: moment().toDate(),
        },
        { transaction }
      );
      
      // 检查是否所有分摊规则都已结清
      const bill = paymentRecord.bill;
      await this.updateBillStatus(bill.id, transaction);
      
      // 发送通知
      await this.sendPaymentConfirmedNotifications(
        bill,
        paymentRecord,
        transaction
      );
      
      if (!options.transaction) {
        await transaction.commit();
      }
      
      return paymentRecord;
    } catch (error) {
      if (!options.transaction) {
        await transaction.rollback();
      }
      throw error;
    }
  }

  static async updateBillStatus(billId, transaction) {
    const bill = await Bill.findOne({
      where: { id: billId },
      include: [
        {
          model: SplitRule,
          as: 'splitRules',
        },
      ],
      transaction,
    });
    
    if (!bill) return;
    
    const splitRules = bill.splitRules;
    let totalPaid = 0;
    let totalPointsDeducted = 0;
    let allPaid = true;
    let anyPaid = false;
    let hasOverdue = false;
    const now = moment();
    
    for (const rule of splitRules) {
      totalPaid += parseFloat(rule.paid_amount);
      totalPointsDeducted += parseFloat(rule.points_used);
      
      if (rule.status !== STATUS_MAP.SPLIT_RULE.PAID) {
        allPaid = false;
      }
      
      if (rule.status === STATUS_MAP.SPLIT_RULE.PAID || rule.status === STATUS_MAP.SPLIT_RULE.PARTIAL) {
        anyPaid = true;
      }
      
      // 检查是否逾期
      if (rule.due_date && moment(rule.due_date).isBefore(now) && 
          rule.status === STATUS_MAP.SPLIT_RULE.PENDING) {
        hasOverdue = true;
      }
    }
    
    let newStatus = bill.status;
    
    if (bill.has_dispute) {
      newStatus = STATUS_MAP.BILL.DISPUTED;
    } else if (allPaid) {
      newStatus = STATUS_MAP.BILL.SETTLED;
    } else if (hasOverdue) {
      newStatus = STATUS_MAP.BILL.OVERDUE;
    } else if (anyPaid) {
      newStatus = STATUS_MAP.BILL.PARTIAL;
    }
    
    await bill.update(
      {
        status: newStatus,
        total_paid_amount: totalPaid.toFixed(2),
        points_deducted: totalPointsDeducted.toFixed(2),
        paid_date: allPaid ? moment().toDate() : bill.paid_date,
      },
      { transaction }
    );
  }

  static async getBillWithDetails(billId) {
    const bill = await Bill.findOne({
      where: { id: billId },
      include: [
        {
          model: SplitRule,
          as: 'splitRules',
          include: [
            {
              model: Flatmate,
              as: 'flatmate',
              attributes: ['id', 'name', 'email', 'phone'],
            },
          ],
        },
        {
          model: PaymentRecord,
          as: 'paymentRecords',
          include: [
            {
              model: Flatmate,
              as: 'payer',
              attributes: ['id', 'name'],
            },
            {
              model: Flatmate,
              as: 'receiver',
              attributes: ['id', 'name'],
            },
          ],
          order: [['created_at', 'DESC']],
        },
        {
          model: Flatmate,
          as: 'creator',
          attributes: ['id', 'name'],
        },
      ],
    });
    
    if (!bill) {
      throw { code: ERROR_CODES.BILL_NOT_FOUND, message: '账单不存在' };
    }
    
    return bill;
  }

  static async getFlatmateStatement(flatmateId, options = {}) {
    const { startDate, endDate, status } = options;
    
    const whereClause = {
      flatmate_id: flatmateId,
    };
    
    if (status && Object.values(STATUS_MAP.SPLIT_RULE).includes(status)) {
      whereClause.status = status;
    }
    
    const splitRules = await SplitRule.findAll({
      where: whereClause,
      include: [
        {
          model: Bill,
          as: 'bill',
          where: {
            ...(startDate && { created_at: { [Op.gte]: moment(startDate).startOf('day').toDate() } }),
            ...(endDate && { created_at: { [Op.lte]: moment(endDate).endOf('day').toDate() } }),
          },
          include: [
            {
              model: Flatmate,
              as: 'creator',
              attributes: ['id', 'name'],
            },
          ],
        },
        {
          model: PaymentRecord,
          as: 'paymentRecords',
          include: [
            {
              model: Flatmate,
              as: 'payer',
              attributes: ['id', 'name'],
            },
          ],
        },
      ],
      order: [
        [{ model: Bill, as: 'bill' }, 'created_at', 'DESC'],
      ],
    });
    
    // 计算汇总数据
    const summary = {
      total_amount: 0,
      total_paid: 0,
      total_points_used: 0,
      pending_amount: 0,
      overdue_amount: 0,
      bill_count: 0,
      paid_bill_count: 0,
    };
    
    for (const rule of splitRules) {
      const amount = parseFloat(rule.amount);
      const paid = parseFloat(rule.paid_amount);
      const pointsUsed = parseFloat(rule.points_used);
      
      summary.total_amount += amount;
      summary.total_paid += paid;
      summary.total_points_used += pointsUsed;
      summary.bill_count++;
      
      if (rule.status === STATUS_MAP.SPLIT_RULE.PAID) {
        summary.paid_bill_count++;
      } else if (rule.status === STATUS_MAP.SPLIT_RULE.OVERDUE) {
        summary.overdue_amount += (amount - paid);
      } else if (rule.status === STATUS_MAP.SPLIT_RULE.PENDING || rule.status === STATUS_MAP.SPLIT_RULE.PARTIAL) {
        summary.pending_amount += (amount - paid);
      }
    }
    
    return {
      flatmate_id: flatmateId,
      summary: {
        ...summary,
        total_amount: summary.total_amount.toFixed(2),
        total_paid: summary.total_paid.toFixed(2),
        total_points_used: summary.total_points_used.toFixed(2),
        pending_amount: summary.pending_amount.toFixed(2),
        overdue_amount: summary.overdue_amount.toFixed(2),
      },
      transactions: splitRules,
    };
  }

  static async getBalanceSummary() {
    const flatmates = await Flatmate.findAll({
      where: { status: 'active' },
      include: [
        {
          model: SplitRule,
          as: 'splitRules',
          where: {
            status: {
              [Op.in]: [STATUS_MAP.SPLIT_RULE.PENDING, STATUS_MAP.SPLIT_RULE.PARTIAL],
            },
          },
          include: [
            { model: Bill, as: 'bill' },
          ],
          required: false,
        },
        {
          model: PointAdjustment,
          as: 'pointAdjustments',
          order: [['created_at', 'DESC']],
          limit: 5,
        },
      ],
    });
    
    const summary = {
      total_active_flatmates: flatmates.length,
      total_balance: 0,
      total_pending: 0,
      total_overdue: 0,
      total_points: 0,
      flatmate_balances: [],
    };
    
    for (const flatmate of flatmates) {
      const flatmateBalance = {
        flatmate_id: flatmate.id,
        name: flatmate.name,
        points: flatmate.points,
        points_value: (flatmate.points * POINTS_CONFIG.EXCHANGE_RATE).toFixed(2),
        total_debt: 0,
        total_paid: 0,
        pending_amount: 0,
        overdue_amount: 0,
        recent_transactions: [],
      };
      
      for (const rule of flatmate.splitRules) {
        const amount = parseFloat(rule.amount);
        const paid = parseFloat(rule.paid_amount);
        const remaining = amount - paid;
        
        flatmateBalance.total_debt += amount;
        flatmateBalance.total_paid += paid;
        
        if (rule.status === STATUS_MAP.SPLIT_RULE.OVERDUE) {
          flatmateBalance.overdue_amount += remaining;
        } else if (rule.status === STATUS_MAP.SPLIT_RULE.PENDING || rule.status === STATUS_MAP.SPLIT_RULE.PARTIAL) {
          flatmateBalance.pending_amount += remaining;
        }
      }
      
      summary.total_points += flatmate.points;
      summary.total_balance += (flatmateBalance.total_debt - flatmateBalance.total_paid);
      summary.total_pending += flatmateBalance.pending_amount;
      summary.total_overdue += flatmateBalance.overdue_amount;
      
      flatmateBalance.total_debt = flatmateBalance.total_debt.toFixed(2);
      flatmateBalance.total_paid = flatmateBalance.total_paid.toFixed(2);
      flatmateBalance.pending_amount = flatmateBalance.pending_amount.toFixed(2);
      flatmateBalance.overdue_amount = flatmateBalance.overdue_amount.toFixed(2);
      
      // 最近的交易
      flatmateBalance.recent_transactions = flatmate.splitRules
        .slice(0, 5)
        .map(rule => ({
          bill_title: rule.bill.title,
          amount: rule.amount,
          paid: rule.paid_amount,
          status: rule.status,
          created_at: rule.bill.created_at,
        }));
      
      summary.flatmate_balances.push(flatmateBalance);
    }
    
    summary.total_balance = summary.total_balance.toFixed(2);
    summary.total_pending = summary.total_pending.toFixed(2);
    summary.total_overdue = summary.total_overdue.toFixed(2);
    summary.total_points_value = (summary.total_points * POINTS_CONFIG.EXCHANGE_RATE).toFixed(2);
    
    return summary;
  }

  static async sendBillCreatedNotifications(bill, splitRules, transaction) {
    for (const rule of splitRules) {
      await Notification.create(
        {
          recipient_id: rule.flatmate_id,
          notification_type: NOTIFICATION_TYPES.BILL_CREATED,
          title: `新账单: ${bill.title}`,
          content: `您有一笔新账单需要支付，金额: ¥${rule.amount}，截止日期: ${bill.due_date || '未设置'}`,
          is_read: false,
          is_urgent: !!bill.due_date,
          bill_id: bill.id,
          action_url: `/bills/${bill.id}`,
        },
        { transaction }
      );
    }
  }

  static async sendPaymentCreatedNotifications(bill, splitRule, paymentRecord, payerId, transaction) {
    // 通知收款人
    if (paymentRecord.receiver_id) {
      await Notification.create(
        {
          recipient_id: paymentRecord.receiver_id,
          notification_type: NOTIFICATION_TYPES.BILL_PAYMENT_RECEIVED,
          title: `收到付款: ${bill.title}`,
          content: `您收到一笔付款，金额: ¥${paymentRecord.amount}，来自室友ID: ${payerId}`,
          is_read: false,
          is_urgent: false,
          bill_id: bill.id,
          payment_id: paymentRecord.id,
        },
        { transaction }
      );
    }
  }

  static async sendPaymentConfirmedNotifications(bill, paymentRecord, transaction) {
    // 通知付款人
    await Notification.create(
      {
        recipient_id: paymentRecord.payer_id,
        notification_type: NOTIFICATION_TYPES.BILL_PAYMENT_CONFIRMED,
        title: `付款已确认: ${bill.title}`,
        content: `您的付款已确认，金额: ¥${paymentRecord.amount}`,
        is_read: false,
        is_urgent: false,
        bill_id: bill.id,
        payment_id: paymentRecord.id,
      },
      { transaction }
    );
  }
}

module.exports = BillService;
