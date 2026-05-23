const Joi = require('joi');
const { ExceptionLogDAO } = require('../database/dao');

const exceptionLogDAO = new ExceptionLogDAO();

const generateExceptionCode = () => {
  return `EXC-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
};

const logValidationException = async (req, error) => {
  try {
    const exceptionCode = generateExceptionCode();
    await exceptionLogDAO.create({
      exception_code: exceptionCode,
      api_endpoint: `${req.method} ${req.path}`,
      original_input: JSON.stringify({
        body: req.body,
        query: req.query,
        params: req.params
      }),
      error_message: error.message || String(error),
      processing_conclusion: 'validation_failed',
      status: 'handled'
    });
    return exceptionCode;
  } catch (logErr) {
    console.error('记录验证异常日志失败:', logErr);
    return null;
  }
};

const schemas = {
  store: Joi.object({
    store_code: Joi.string().required(),
    store_name: Joi.string().required(),
    address: Joi.string().allow(''),
    manager: Joi.string().allow(''),
    phone: Joi.string().allow(''),
    status: Joi.string().valid('active', 'inactive').default('active')
  }),

  product: Joi.object({
    barcode: Joi.string().required(),
    product_name: Joi.string().required(),
    category: Joi.string().allow(''),
    base_price: Joi.number().positive().required(),
    unit: Joi.string().default('件')
  }),

  priceVersion: Joi.object({
    version_code: Joi.string().required(),
    version_name: Joi.string().required(),
    barcode: Joi.string().required(),
    price: Joi.number().positive().required(),
    price_type: Joi.string().valid('normal', 'promotion', 'special').default('normal'),
    effective_start: Joi.date().required(),
    effective_end: Joi.date().required(),
    created_by: Joi.string().required()
  }),

  promotionWindow: Joi.object({
    promotion_code: Joi.string().required(),
    promotion_name: Joi.string().required(),
    price_version_id: Joi.number().integer().positive().required(),
    start_time: Joi.date().required(),
    end_time: Joi.date().required(),
    store_codes: Joi.string().required(),
    created_by: Joi.string().required()
  }),

  confirmation: Joi.object({
    confirmation_code: Joi.string().required(),
    store_code: Joi.string().required(),
    price_version_id: Joi.number().integer().positive().required(),
    confirmer: Joi.string().required(),
    remarks: Joi.string().allow('')
  }),

  discrepancyReport: Joi.object({
    report_code: Joi.string().required(),
    store_code: Joi.string().required(),
    barcode: Joi.string().required(),
    price_version_id: Joi.number().integer().positive().allow(null),
    expected_price: Joi.number().positive().required(),
    actual_price: Joi.number().positive().required(),
    discrepancy_type: Joi.string().valid('price_mismatch', 'expired_promotion', 'tag_missing', 'other').required(),
    reported_by: Joi.string().required(),
    remarks: Joi.string().allow('')
  }),

  discrepancyReview: Joi.object({
    status: Joi.string().valid('reviewed', 'rejected', 'compensated', 'pending_review').required(),
    reviewed_by: Joi.string().required(),
    resolution: Joi.string().required(),
    remarks: Joi.string().allow('')
  }),

  manualCorrection: Joi.object({
    correction_code: Joi.string().required(),
    discrepancy_id: Joi.number().integer().positive().allow(null),
    store_code: Joi.string().required(),
    barcode: Joi.string().required(),
    old_price: Joi.number().positive().required(),
    new_price: Joi.number().positive().required(),
    corrected_by: Joi.string().required(),
    reason: Joi.string().required()
  })
};

const validate = (schemaName) => {
  return async (req, res, next) => {
    const { error } = schemas[schemaName].validate(req.body);
    if (error) {
      const exceptionCode = await logValidationException(req, error);
      return res.status(400).json({
        success: false,
        status: 'validation_error',
        exception_code: exceptionCode,
        message: error.details[0].message
      });
    }
    next();
  };
};

module.exports = { validate, schemas };
