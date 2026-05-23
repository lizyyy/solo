const Joi = require('joi');

const validate = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate({
      params: req.params,
      query: req.query,
      body: req.body
    }, {
      abortEarly: false,
      allowUnknown: true
    });

    if (error) {
      const errors = error.details.map(detail => detail.message);
      return res.status(400).json({
        success: false,
        message: '参数验证失败',
        data: { errors }
      });
    }

    next();
  };
};

const schemas = {
  createTask: Joi.object({
    body: Joi.object({
      name: Joi.string().optional().default('对账任务'),
      dateRange: Joi.object({
        start: Joi.string().isoDate().optional(),
        end: Joi.string().isoDate().optional()
      }).optional()
    })
  }),

  executeReconciliation: Joi.object({
    params: Joi.object({
      taskId: Joi.string().required()
    })
  }),

  getDiscrepancies: Joi.object({
    query: Joi.object({
      taskId: Joi.string().optional(),
      status: Joi.string().valid('PENDING', 'APPROVED', 'REJECTED', 'INFO_REQUESTED').optional(),
      page: Joi.number().integer().min(1).default(1),
      pageSize: Joi.number().integer().min(1).max(100).default(20)
    })
  }),

  discrepancyId: Joi.object({
    params: Joi.object({
      discrepancyId: Joi.string().required()
    })
  }),

  reviewAction: Joi.object({
    params: Joi.object({
      discrepancyId: Joi.string().required()
    }),
    body: Joi.object({
      operator: Joi.string().required(),
      remark: Joi.string().optional().allow('')
    })
  }),

  generateReport: Joi.object({
    params: Joi.object({
      taskId: Joi.string().required()
    }),
    body: Joi.object({
      reportType: Joi.string().valid('SUMMARY', 'DETAIL').default('SUMMARY')
    })
  }),

  exportReport: Joi.object({
    params: Joi.object({
      taskId: Joi.string().required()
    }),
    query: Joi.object({
      reportType: Joi.string().valid('SUMMARY', 'DETAIL').default('SUMMARY'),
      format: Joi.string().valid('csv', 'json').default('csv')
    })
  })
};

module.exports = {
  validate,
  schemas
};
