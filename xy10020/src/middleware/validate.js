const Joi = require('joi');

const ValidationError = (message, details) => {
  const err = new Error(message);
  err.name = 'ValidationError';
  err.details = details;
  return err;
};

const validate = (schema) => {
  return (req, res, next) => {
    const validation = schema.validate(
      {
        body: req.body,
        params: req.params,
        query: req.query
      },
      {
        abortEarly: false,
        allowUnknown: true,
        stripUnknown: true
      }
    );

    if (validation.error) {
      const details = validation.error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return next(ValidationError('参数验证失败', details));
    }

    if (validation.value.body) {
      req.body = validation.value.body;
    }
    if (validation.value.params) {
      req.params = validation.value.params;
    }
    if (validation.value.query) {
      req.query = validation.value.query;
    }

    next();
  };
};

const schemas = {
  login: Joi.object({
    body: Joi.object({
      username: Joi.string().required().min(1).max(50),
      password: Joi.string().required().min(1).max(100)
    }).required()
  }),

  createLiveRoom: Joi.object({
    body: Joi.object({
      title: Joi.string().required().min(1).max(200)
    }).required()
  }),

  updateLiveRoom: Joi.object({
    params: Joi.object({
      id: Joi.string().required()
    }).required(),
    body: Joi.object({
      title: Joi.string().min(1).max(200),
      status: Joi.string().valid('offline', 'live', 'ended'),
      version: Joi.number().integer().required()
    }).required()
  }),

  sendMessage: Joi.object({
    body: Joi.object({
      content: Joi.string().required().min(1).max(1000),
      messageType: Joi.string().valid('chat', 'gift', 'system', 'notification').default('chat')
    }).required()
  }),

  createPushTask: Joi.object({
    body: Joi.object({
      taskType: Joi.string().required().valid(
        'room_announcement',
        'broadcast',
        'targeted_notification',
        'live_started',
        'live_ended'
      ),
      liveRoomId: Joi.string(),
      targetUserIds: Joi.array().items(Joi.string()),
      payload: Joi.object().required(),
      maxRetries: Joi.number().integer().min(0).max(10).default(3),
      scheduledAt: Joi.number().integer().min(Date.now())
    }).required()
  }),

  listOperationLogs: Joi.object({
    query: Joi.object({
      startTime: Joi.number().integer(),
      endTime: Joi.number().integer(),
      entityType: Joi.string(),
      entityId: Joi.string(),
      userId: Joi.string(),
      limit: Joi.number().integer().min(1).max(1000).default(100),
      offset: Joi.number().integer().min(0).default(0)
    }).required()
  }),

  exportReport: Joi.object({
    query: Joi.object({
      startTime: Joi.number().integer().required(),
      endTime: Joi.number().integer().required(),
      format: Joi.string().valid('json', 'csv').default('json')
    }).required()
  })
};

module.exports = {
  validate,
  schemas,
  ValidationError
};
