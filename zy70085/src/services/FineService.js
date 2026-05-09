const { v4: uuidv4 } = require('uuid');
const { Op } = require('sequelize');
const {
  OccupationApplication, FineRecord, FineRule, sequelize
} = require('../models');
const { FineStatus, FineRuleType } = require('../constants/status');
const { StatusManager } = require('./StatusManager');

function generateFineNo() {
  const date = new Date();
  const year = date.getFullYear();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `FINE-${year}-${random}`;
}

class FineRuleService {
  static async createRule(data) {
    const {
      name, ruleType, code, description,
      baseAmount, unit, priority = 0, conditions = {}
    } = data;

    const existingRule = await FineRule.findOne({ where: { code } });
    if (existingRule) {
      throw new Error('规则代码已存在');
    }

    return await FineRule.create({
      name,
      ruleType,
      code,
      description,
      baseAmount,
      unit,
      priority,
      conditions,
      isActive: true
    });
  }

  static async getActiveRules() {
    return await FineRule.findAll({
      where: { isActive: true },
      order: [['priority', 'DESC'], ['createdAt', 'ASC']]
    });
  }

  static async getRuleByCode(code) {
    return await FineRule.findOne({ where: { code, isActive: true } });
  }

  static async calculateFine(rule, context = {}) {
    let multiplier = 1.0;
    let amount = parseFloat(rule.baseAmount);

    if (rule.conditions && rule.conditions.multipliers) {
      for (const condition of rule.conditions.multipliers) {
        if (condition.field && context[condition.field]) {
          if (condition.operator === 'range') {
            const value = parseFloat(context[condition.field]);
            if (value >= condition.min && value <= condition.max) {
              multiplier = condition.multiplier;
              break;
            }
          } else if (condition.operator === 'exact') {
            if (context[condition.field] === condition.value) {
              multiplier = condition.multiplier;
              break;
            }
          }
        }
      }
    }

    if (rule.unit === 'day' && context.days) {
      amount = amount * context.days;
    }

    return {
      baseAmount: rule.baseAmount,
      multiplier,
      totalAmount: (amount * multiplier).toFixed(2),
      ruleCode: rule.code,
      ruleType: rule.ruleType
    };
  }
}

class FineService {
  static async issueFine(applicationId, ruleCode, context = {}, operator = 'system') {
    const application = await OccupationApplication.findByPk(applicationId);
    if (!application) {
      throw new Error('占道申请不存在');
    }

    const rule = await FineRuleService.getRuleByCode(ruleCode);
    if (!rule) {
      throw new Error('罚款规则不存在');
    }

    const fineCalculation = await FineRuleService.calculateFine(rule, context);

    const t = await sequelize.transaction();

    try {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 15);

      const fine = await FineRecord.create({
        fineNo: generateFineNo(),
        occupationApplicationId: applicationId,
        ruleType: rule.ruleType,
        ruleId: rule.id,
        description: `${rule.name}: ${context.reason || rule.description}`,
        baseAmount: fineCalculation.baseAmount,
        multiplier: fineCalculation.multiplier,
        totalAmount: fineCalculation.totalAmount,
        status: FineStatus.PENDING,
        issuedAt: new Date(),
        dueDate,
        isActive: true,
        version: 1,
        metadata: {
          ...context,
          ruleName: rule.name,
          createdBy: operator
        }
      }, { transaction: t });

      fine.status = FineStatus.ISSUED;
      await fine.save({ transaction: t });

      application.hasActiveFine = true;
      await application.save({ transaction: t });

      await t.commit();

      return fine;
    } catch (error) {
      await t.rollback();
      throw error;
    }
  }

  static async payFine(fineId, operator = 'system') {
    const fine = await FineRecord.findByPk(fineId);
    if (!fine) {
      throw new Error('罚款记录不存在');
    }

    const validStatuses = [FineStatus.ISSUED, FineStatus.DISPUTED];
    if (!validStatuses.includes(fine.status)) {
      throw new Error('当前状态无法支付');
    }

    const application = await OccupationApplication.findByPk(fine.occupationApplicationId);

    const t = await sequelize.transaction();

    try {
      fine.status = FineStatus.PAID;
      fine.paidAt = new Date();
      fine.isActive = false;
      fine.version = fine.version + 1;
      await fine.save({ transaction: t });

      const remainingActiveFines = await FineRecord.count({
        where: {
          occupationApplicationId: fine.occupationApplicationId,
          isActive: true,
          status: { [Op.notIn]: [FineStatus.PAID, FineStatus.WAIVED] }
        },
        transaction: t
      });

      if (remainingActiveFines === 0) {
        application.hasActiveFine = false;
        await application.save({ transaction: t });
      }

      await t.commit();

      return { fine, application };
    } catch (error) {
      await t.rollback();
      throw error;
    }
  }

  static async waiveFine(fineId, waiverReason, operator = 'system') {
    const fine = await FineRecord.findByPk(fineId);
    if (!fine) {
      throw new Error('罚款记录不存在');
    }

    const validStatuses = [FineStatus.PENDING, FineStatus.ISSUED, FineStatus.DISPUTED];
    if (!validStatuses.includes(fine.status)) {
      throw new Error('当前状态无法豁免');
    }

    const application = await OccupationApplication.findByPk(fine.occupationApplicationId);

    const t = await sequelize.transaction();

    try {
      fine.status = FineStatus.WAIVED;
      fine.waivedAt = new Date();
      fine.waiverReason = waiverReason;
      fine.isActive = false;
      fine.version = fine.version + 1;
      await fine.save({ transaction: t });

      const remainingActiveFines = await FineRecord.count({
        where: {
          occupationApplicationId: fine.occupationApplicationId,
          isActive: true,
          status: { [Op.notIn]: [FineStatus.PAID, FineStatus.WAIVED] }
        },
        transaction: t
      });

      if (remainingActiveFines === 0) {
        application.hasActiveFine = false;
        await application.save({ transaction: t });
      }

      await t.commit();

      return { fine, application };
    } catch (error) {
      await t.rollback();
      throw error;
    }
  }

  static async disputeFine(fineId, disputeReason, operator = 'system') {
    const fine = await FineRecord.findByPk(fineId);
    if (!fine) {
      throw new Error('罚款记录不存在');
    }

    if (fine.status !== FineStatus.ISSUED) {
      throw new Error('只有已签发的罚款可以申诉');
    }

    fine.status = FineStatus.DISPUTED;
    fine.disputedAt = new Date();
    fine.disputeReason = disputeReason;
    fine.version = fine.version + 1;

    await fine.save();

    return fine;
  }

  static async getFine(fineId) {
    return await FineRecord.findByPk(fineId, {
      include: [
        { model: OccupationApplication, as: 'occupationApplication' },
        { model: FineRule, as: 'fineRule' }
      ]
    });
  }

  static async listFines(applicationId) {
    return await FineRecord.findAll({
      where: {
        occupationApplicationId: applicationId
      },
      include: [
        { model: FineRule, as: 'fineRule' }
      ],
      order: [['createdAt', 'DESC']]
    });
  }

  static async listAllActiveFines() {
    return await FineRecord.findAll({
      where: {
        isActive: true,
        status: { [Op.notIn]: [FineStatus.PAID, FineStatus.WAIVED] }
      },
      include: [
        { model: OccupationApplication, as: 'occupationApplication' }
      ],
      order: [['issuedAt', 'DESC']]
    });
  }

  static async checkAndIssueOvertimeFine(applicationId, operator = 'system') {
    const application = await OccupationApplication.findByPk(applicationId);
    if (!application) {
      throw new Error('占道申请不存在');
    }

    const now = new Date();
    if (now <= application.endDate) {
      return null;
    }

    const existingFine = await FineRecord.findOne({
      where: {
        occupationApplicationId: applicationId,
        ruleType: FineRuleType.OVERTIME,
        isActive: true
      }
    });

    if (existingFine) {
      return existingFine;
    }

    const overtimeRule = await FineRuleService.getRuleByCode('OVERTIME_DAILY');
    if (!overtimeRule) {
      return null;
    }

    const overtimeDays = Math.ceil((now - application.endDate) / (1000 * 60 * 60 * 24));

    return await this.issueFine(
      applicationId,
      'OVERTIME_DAILY',
      {
        days: overtimeDays,
        reason: `超期占道 ${overtimeDays} 天`
      },
      operator
    );
  }
}

module.exports = {
  FineService,
  FineRuleService,
  generateFineNo
};
