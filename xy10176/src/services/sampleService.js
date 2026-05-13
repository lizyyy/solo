const { Op, Transaction } = require('sequelize');
const Sample = require('../models/sample');
const Audit = require('../models/audit');
const sequelize = require('../config/database');
const stateMachine = require('./stateMachine');
const { SampleStatus, StepType, ErrorCode } = require('../constants/status');

class SampleService {
  async createSample(barcode, handler = null) {
    const existingSample = await Sample.findOne({ where: { barcode } });
    if (existingSample) {
      return {
        success: false,
        code: ErrorCode.BARCODE_IDEMPOTENT,
        message: '条码已存在',
        data: { sample: existingSample.toJSON(), isIdempotent: true }
      };
    }

    const sample = await Sample.create({
      barcode,
      handler
    });

    await Audit.create({
      sampleId: sample.id,
      barcode: sample.barcode,
      stepType: StepType.COLLECT,
      action: 'CREATE',
      fromStatus: null,
      toStatus: SampleStatus.INIT,
      handler,
      detail: JSON.stringify({ action: '创建样本' })
    });

    return {
      success: true,
      code: ErrorCode.SUCCESS,
      message: '样本创建成功',
      data: { sample: sample.toJSON(), isIdempotent: false }
    };
  }

  async executeStep(barcode, stepType, requestId, handler = null, detail = {}) {
    if (!barcode || !stepType || !requestId) {
      return {
        success: false,
        code: ErrorCode.PARAM_ERROR,
        message: '缺少必要参数'
      };
    }

    const t = await sequelize.transaction();

    try {
      const sample = await Sample.findOne({
        where: { barcode },
        transaction: t,
        lock: Transaction.LOCK.UPDATE
      });

      if (!sample) {
        await t.rollback();
        return {
          success: false,
          code: ErrorCode.SAMPLE_NOT_FOUND,
          message: '样本不存在'
        };
      }

      const requestIdField = stateMachine.getRequestIdField(stepType);
      
      if (sample[requestIdField] === requestId) {
        await t.rollback();
        
        const existingAudit = await Audit.findOne({
          where: { barcode, requestId }
        });

        return {
          success: true,
          code: ErrorCode.SUCCESS,
          message: '幂等重复请求，已忽略',
          data: {
            sample: sample.toJSON(),
            isIdempotent: true,
            audit: existingAudit ? existingAudit.toJSON() : null
          }
        };
      }

      if (sample.status === SampleStatus.EXCEPTION) {
        await t.rollback();
        return {
          success: false,
          code: ErrorCode.STATE_TRANSITION_ERROR,
          message: '样本处于异常状态，请先处理异常'
        };
      }

      if (!stateMachine.canTransition(sample.status, stepType)) {
        await t.rollback();
        return {
          success: false,
          code: ErrorCode.STATE_TRANSITION_ERROR,
          message: `状态流转错误：当前状态 ${sample.status} 不能执行 ${stepType}`,
          data: { currentStatus: sample.status, expectedStatus: stateMachine.getPreviousStatusForStep(stepType) }
        };
      }

      const fromStatus = sample.status;
      const nextStatus = stateMachine.getNextStatus(fromStatus, stepType);
      const timeField = stateMachine.getTimeField(stepType);
      const now = new Date();

      const updateData = {
        status: nextStatus,
        [requestIdField]: requestId,
        [timeField]: now,
        handler
      };

      await sample.update(updateData, { transaction: t });

      const durationMs = stateMachine.getStepDuration(sample, stepType);

      await Audit.create({
        sampleId: sample.id,
        barcode: sample.barcode,
        stepType,
        action: 'NORMAL',
        fromStatus,
        toStatus: nextStatus,
        handler,
        requestId,
        durationMs,
        detail: JSON.stringify(detail),
        isIdempotent: false
      }, { transaction: t });

      await t.commit();

      return {
        success: true,
        code: ErrorCode.SUCCESS,
        message: `${stepType} 执行成功`,
        data: {
          sample: sample.toJSON(),
          isIdempotent: false,
          durationMs
        }
      };

    } catch (error) {
      await t.rollback();
      
      if (error.name === 'SequelizeUniqueConstraintError') {
        const sample = await Sample.findOne({ where: { barcode } });
        const existingAudit = await Audit.findOne({ where: { barcode, requestId } });
        
        return {
          success: true,
          code: ErrorCode.SUCCESS,
          message: '并发重复请求，已忽略',
          data: {
            sample: sample ? sample.toJSON() : null,
            isIdempotent: true,
            audit: existingAudit ? existingAudit.toJSON() : null
          }
        };
      }

      return {
        success: false,
        code: ErrorCode.SERVER_ERROR,
        message: '服务器错误',
        data: { error: error.message }
      };
    }
  }

  async reportException(barcode, reason, handler = null, detail = {}) {
    const t = await sequelize.transaction();

    try {
      const sample = await Sample.findOne({
        where: { barcode },
        transaction: t,
        lock: Transaction.LOCK.UPDATE
      });

      if (!sample) {
        await t.rollback();
        return {
          success: false,
          code: ErrorCode.SAMPLE_NOT_FOUND,
          message: '样本不存在'
        };
      }

      if (sample.status === SampleStatus.EXCEPTION) {
        await t.rollback();
        return {
          success: true,
          code: ErrorCode.SUCCESS,
          message: '样本已处于异常状态',
          data: { sample: sample.toJSON(), isIdempotent: true }
        };
      }

      const originalStatus = sample.status;
      const exceptionStepType = originalStatus === SampleStatus.INIT ? StepType.COLLECT :
                               originalStatus === SampleStatus.COLLECTED ? StepType.CENTRIFUGE :
                               originalStatus === SampleStatus.CENTRIFUGED ? StepType.TEST : StepType.REVIEW;

      await sample.update({
        status: SampleStatus.EXCEPTION,
        exceptionReason: reason,
        handler
      }, { transaction: t });

      await Audit.create({
        sampleId: sample.id,
        barcode: sample.barcode,
        stepType: exceptionStepType,
        action: 'EXCEPTION',
        fromStatus: originalStatus,
        toStatus: SampleStatus.EXCEPTION,
        handler,
        detail: JSON.stringify({ reason, ...detail })
      }, { transaction: t });

      await t.commit();

      return {
        success: true,
        code: ErrorCode.SUCCESS,
        message: '已转入人工处理',
        data: { sample: sample.toJSON(), originalStatus }
      };

    } catch (error) {
      await t.rollback();
      return {
        success: false,
        code: ErrorCode.SERVER_ERROR,
        message: '服务器错误',
        data: { error: error.message }
      };
    }
  }

  async resolveException(barcode, targetStep, handler = null, detail = {}) {
    const t = await sequelize.transaction();

    try {
      const sample = await Sample.findOne({
        where: { barcode },
        transaction: t,
        lock: Transaction.LOCK.UPDATE
      });

      if (!sample) {
        await t.rollback();
        return {
          success: false,
          code: ErrorCode.SAMPLE_NOT_FOUND,
          message: '样本不存在'
        };
      }

      if (sample.status !== SampleStatus.EXCEPTION) {
        await t.rollback();
        return {
          success: false,
          code: ErrorCode.STATE_TRANSITION_ERROR,
          message: '样本不在异常状态'
        };
      }

      const targetStatus = stateMachine.getPreviousStatusForStep(targetStep);
      if (!targetStatus) {
        await t.rollback();
        return {
          success: false,
          code: ErrorCode.PARAM_ERROR,
          message: '无效的目标步骤'
        };
      }

      const timeField = stateMachine.getTimeField(targetStep);

      const updateData = {
        status: targetStatus,
        exceptionReason: null,
        handler
      };

      await sample.update(updateData, { transaction: t });

      await Audit.create({
        sampleId: sample.id,
        barcode: sample.barcode,
        stepType: targetStep,
        action: 'RESOLVE',
        fromStatus: SampleStatus.EXCEPTION,
        toStatus: targetStatus,
        handler,
        detail: JSON.stringify({ action: '异常已解决，返回流程', targetStep, ...detail })
      }, { transaction: t });

      await t.commit();

      return {
        success: true,
        code: ErrorCode.SUCCESS,
        message: '异常已解决，样本返回流程',
        data: { sample: sample.toJSON() }
      };

    } catch (error) {
      await t.rollback();
      return {
        success: false,
        code: ErrorCode.SERVER_ERROR,
        message: '服务器错误',
        data: { error: error.message }
      };
    }
  }

  async getSampleByBarcode(barcode) {
    const sample = await Sample.findOne({ where: { barcode } });
    if (!sample) {
      return {
        success: false,
        code: ErrorCode.SAMPLE_NOT_FOUND,
        message: '样本不存在'
      };
    }

    return {
      success: true,
      code: ErrorCode.SUCCESS,
      data: { sample: sample.toJSON() }
    };
  }

  async querySamples(params = {}) {
    const { status, barcode, limit = 100, offset = 0 } = params;
    const where = {};

    if (status) where.status = status;
    if (barcode) where.barcode = { [Op.like]: `%${barcode}%` };

    const { count, rows } = await Sample.findAndCountAll({
      where,
      limit: Math.min(limit, 1000),
      offset,
      order: [['createdAt', 'DESC']]
    });

    return {
      success: true,
      code: ErrorCode.SUCCESS,
      data: {
        total: count,
        items: rows.map(r => r.toJSON())
      }
    };
  }

  async queryAudits(params = {}) {
    const { barcode, sampleId, stepType, action, limit = 100, offset = 0 } = params;
    const where = {};

    if (barcode) where.barcode = barcode;
    if (sampleId) where.sampleId = sampleId;
    if (stepType) where.stepType = stepType;
    if (action) where.action = action;

    const { count, rows } = await Audit.findAndCountAll({
      where,
      limit: Math.min(limit, 1000),
      offset,
      order: [['createdAt', 'DESC']]
    });

    return {
      success: true,
      code: ErrorCode.SUCCESS,
      data: {
        total: count,
        items: rows.map(r => r.toJSON())
      }
    };
  }

  async getStatistics(params = {}) {
    const { startDate, endDate } = params;
    const where = {};

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt[Op.gte] = new Date(startDate);
      if (endDate) where.createdAt[Op.lte] = new Date(endDate);
    }

    const statusCounts = await Sample.findAll({
      attributes: ['status', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
      where,
      group: ['status']
    });

    const stepDurations = await Audit.findAll({
      attributes: [
        'stepType',
        [sequelize.fn('AVG', sequelize.col('durationMs')), 'avgDurationMs'],
        [sequelize.fn('MIN', sequelize.col('durationMs')), 'minDurationMs'],
        [sequelize.fn('MAX', sequelize.col('durationMs')), 'maxDurationMs'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      where: {
        ...(startDate ? { createdAt: { [Op.gte]: new Date(startDate) } } : {}),
        ...(endDate ? { createdAt: { [Op.lte]: new Date(endDate) } } : {}),
        action: 'NORMAL',
        durationMs: { [Op.ne]: null }
      },
      group: ['stepType']
    });

    const auditCounts = await Audit.findAll({
      attributes: [
        'action',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      where: {
        ...(startDate ? { createdAt: { [Op.gte]: new Date(startDate) } } : {}),
        ...(endDate ? { createdAt: { [Op.lte]: new Date(endDate) } } : {})
      },
      group: ['action']
    });

    return {
      success: true,
      code: ErrorCode.SUCCESS,
      data: {
        statusDistribution: statusCounts.map(r => ({
          status: r.status,
          count: parseInt(r.dataValues.count)
        })),
        stepDurations: stepDurations.map(r => ({
          stepType: r.stepType,
          avgDurationMs: parseFloat(r.dataValues.avgDurationMs) || 0,
          minDurationMs: parseInt(r.dataValues.minDurationMs) || 0,
          maxDurationMs: parseInt(r.dataValues.maxDurationMs) || 0,
          count: parseInt(r.dataValues.count)
        })),
        auditActions: auditCounts.map(r => ({
          action: r.action,
          count: parseInt(r.dataValues.count)
        }))
      }
    };
  }
}

module.exports = new SampleService();
