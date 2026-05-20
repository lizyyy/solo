const Joi = require('joi');

const shipSchema = Joi.object({
  ship_name: Joi.string().required(),
  imo_no: Joi.string().required(),
  draught: Joi.number().positive().required(),
  length: Joi.number().positive().required(),
  arrival_time: Joi.date().iso().required(),
  priority: Joi.number().integer().default(0),
  is_jump_queue: Joi.boolean().default(false),
  jump_queue_approved_by: Joi.string().when('is_jump_queue', { is: true, then: Joi.required() }),
  jump_queue_reason: Joi.string().when('is_jump_queue', { is: true, then: Joi.required() })
});

const materialSchema = Joi.object({
  batch_no: Joi.string().required(),
  submitted_by: Joi.string().required(),
  ships: Joi.array().items(shipSchema).min(1).required(),
  schedule_date: Joi.date().iso().required()
});

const validateMaterial = (data) => {
  const { error, value } = materialSchema.validate(data, { abortEarly: false });
  if (error) {
    const errors = error.details.map(detail => {
      const path = detail.path;
      let position = '材料头部';
      
      if (path[0] === 'ships' && typeof path[1] === 'number') {
        position = `第${path[1] + 1}条船舶记录`;
      } else if (path[0] === 'batch_no' || path[0] === 'submitted_by' || path[0] === 'schedule_date') {
        position = '材料头部';
      }
      
      return {
        field: path.join('.'),
        message: detail.message,
        position: position,
        original_path: detail.path
      };
    });
    return { valid: false, errors };
  }
  return { valid: true, value };
};

const validateTimeConsistency = (ships) => {
  const errors = [];
  const imoSet = new Set();

  ships.forEach((ship, index) => {
    if (imoSet.has(ship.imo_no)) {
      errors.push({
        field: `ships[${index}].imo_no`,
        message: `IMO编号重复: ${ship.imo_no}`,
        position: `第${index + 1}条船舶记录`
      });
    }
    imoSet.add(ship.imo_no);
  });

  return errors;
};

module.exports = {
  validateMaterial,
  validateTimeConsistency
};
