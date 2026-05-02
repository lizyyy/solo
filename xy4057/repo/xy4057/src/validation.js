const Joi = require('joi');
const { isAfter, parseISO } = require('date-fns');
const models = require('./models');
const stateMachine = require('./stateMachine');

const schemas = {
  package: Joi.object({
    package_number: Joi.string().required().min(1).max(50),
    name: Joi.string().required().min(1).max(100),
    description: Joi.string().max(500).allow(null, ''),
    instruments: Joi.array().items(Joi.string()).allow(null),
    expiration_date: Joi.string().isoDate().allow(null)
  }),

  cycle: Joi.object({
    cycle_number: Joi.string().required().min(1).max(50),
    sterilizer_id: Joi.string().required().min(1).max(50),
    cycle_type: Joi.string().required().valid('HIGH_TEMP', 'LOW_TEMP', 'EO_GAS'),
    start_time: Joi.string().isoDate().allow(null),
    target_temperature: Joi.number().required().min(100).max(200),
    target_duration: Joi.number().required().min(1)
  }),

  curvePoint: Joi.object({
    timestamp: Joi.string().isoDate().required(),
    temperature: Joi.number().required().min(0).max(300),
    pressure: Joi.number().min(0).allow(null),
    humidity: Joi.number().min(0).max(100).allow(null)
  }),

  qualityCheck: Joi.object({
    cycle_id: Joi.string().required(),
    package_id: Joi.string().required(),
    check_type: Joi.string().required().valid('BIOLOGICAL', 'CHEMICAL', 'PHYSICAL', 'BOWIE_DICK'),
    result: Joi.string().required().valid('PASS', 'FAIL', 'INCONCLUSIVE'),
    notes: Joi.string().max(500).allow(null, ''),
    checked_by: Joi.string().max(100).allow(null, '')
  }),

  usage: Joi.object({
    package_id: Joi.string().required(),
    department: Joi.string().required().min(1).max(100),
    user_name: Joi.string().max(100).allow(null, ''),
    usage_time: Joi.string().isoDate().allow(null),
    notes: Joi.string().max(500).allow(null, '')
  }),

  recall: Joi.object({
    package_id: Joi.string().required(),
    reason: Joi.string().required().min(1).max(1000),
    performed_by: Joi.string().max(100).allow(null, '')
  })
};

function validate(schema, data) {
  const result = schema.validate(data, { abortEarly: false });
  if (result.error) {
    return {
      valid: false,
      errors: result.error.details.map(d => ({
        code: 'VALIDATION_ERROR',
        field: d.path.join('.'),
        message: d.message
      }))
    };
  }
  return { valid: true, value: result.value };
}

const businessRules = {
  async checkSterilizationParams(cycleId) {
    const cycle = models.cycles.getById(cycleId);
    if (!cycle) {
      return { valid: false, error: '锅次不存在' };
    }

    const curves = models.curves.getByCycle(cycleId);
    if (curves.length === 0) {
      return {
        valid: false,
        error: '灭菌参数缺失',
        code: 'MISSING_STERILIZATION_PARAMS'
      };
    }

    const missingFields = [];
    if (cycle.actual_temperature === null) {
      missingFields.push('actual_temperature');
    }
    if (cycle.actual_duration === null) {
      missingFields.push('actual_duration');
    }

    if (missingFields.length > 0) {
      return {
        valid: false,
        error: `灭菌参数缺失: ${missingFields.join(', ')}`,
        code: 'MISSING_STERILIZATION_PARAMS',
        missingFields
      };
    }

    return { valid: true };
  },

  async checkCycleQualified(cycleId) {
    const cycle = models.cycles.getById(cycleId);
    if (!cycle) {
      return { valid: false, error: '锅次不存在', code: 'CYCLE_NOT_FOUND' };
    }

    if (cycle.status !== 'COMPLETED') {
      return {
        valid: false,
        error: `锅次状态为 ${cycle.status}，无法放行`,
        code: 'CYCLE_NOT_COMPLETED'
      };
    }

    const analysis = models.curves.analyzeQuality(cycleId, cycle.target_temperature);
    if (!analysis.isQualified) {
      return {
        valid: false,
        error: `锅次不合格: ${analysis.reason}`,
        code: 'CYCLE_FAILED',
        analysis
      };
    }

    return { valid: true };
  },

  async checkPackageExpired(packageId) {
    const pkg = models.packages.getById(packageId);
    if (!pkg) {
      return { valid: false, error: '器械包不存在', code: 'PACKAGE_NOT_FOUND' };
    }

    if (!pkg.expiration_date) {
      return {
        valid: false,
        error: '器械包未设置有效期',
        code: 'MISSING_EXPIRATION_DATE'
      };
    }

    const now = new Date();
    const expirationDate = parseISO(pkg.expiration_date);

    if (isAfter(now, expirationDate)) {
      return {
        valid: true,
        isExpired: true,
        error: '器械包已过期',
        code: 'PACKAGE_EXPIRED',
        expiration_date: pkg.expiration_date
      };
    }

    return { valid: true, isExpired: false };
  },

  async checkDuplicateUsage(packageId) {
    const pkg = models.packages.getById(packageId);
    if (!pkg) {
      return { valid: false, error: '器械包不存在', code: 'PACKAGE_NOT_FOUND' };
    }

    const hasBeenUsed = models.usage.hasBeenUsed(packageId);
    if (hasBeenUsed && pkg.current_status !== stateMachine.STATUS.PENDING_CLEANING) {
      return {
        valid: false,
        error: '该器械包已被领用，无法重复领用',
        code: 'DUPLICATE_USAGE',
        alreadyUsed: true
      };
    }

    return { valid: true };
  },

  async checkRecallReason(data) {
    if (!data.reason || data.reason.trim() === '') {
      return {
        valid: false,
        error: '召回缺少原因',
        code: 'MISSING_RECALL_REASON'
      };
    }
    return { valid: true };
  },

  async canReleasePackage(packageId, cycleId) {
    const errors = [];

    const cycleCheck = await this.checkCycleQualified(cycleId);
    if (!cycleCheck.valid) {
      errors.push(cycleCheck);
    }

    const paramsCheck = await this.checkSterilizationParams(cycleId);
    if (!paramsCheck.valid) {
      errors.push(paramsCheck);
    }

    const qcPassed = models.qualityChecks.hasPassedForPackage(packageId, cycleId);
    if (!qcPassed) {
      errors.push({
        valid: false,
        error: '器械包未通过质检，无法放行',
        code: 'QC_NOT_PASSED'
      });
    }

    return {
      valid: errors.length === 0,
      errors
    };
  },

  async canUsePackage(packageId) {
    const errors = [];

    const pkg = models.packages.getById(packageId);
    if (!pkg) {
      return {
        valid: false,
        errors: [{ valid: false, error: '器械包不存在', code: 'PACKAGE_NOT_FOUND' }]
      };
    }

    if (pkg.current_status !== stateMachine.STATUS.RELEASED) {
      errors.push({
        valid: false,
        error: `器械包状态为 ${stateMachine.getStatusLabel(pkg.current_status)}，无法领用`,
        code: 'INVALID_PACKAGE_STATUS'
      });
    }

    const duplicateCheck = await this.checkDuplicateUsage(packageId);
    if (!duplicateCheck.valid) {
      errors.push(duplicateCheck);
    }

    const expiredCheck = await this.checkPackageExpired(packageId);
    if (expiredCheck.isExpired) {
      errors.push(expiredCheck);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  },

  async validateStatusTransition(packageId, toStatus, context = {}) {
    const pkg = models.packages.getById(packageId);
    if (!pkg) {
      return {
        valid: false,
        errors: [{
          code: 'PACKAGE_NOT_FOUND',
          message: '器械包不存在'
        }]
      };
    }

    return stateMachine.validateTransition(pkg, toStatus, context);
  }
};

module.exports = {
  schemas,
  validate,
  businessRules
};
