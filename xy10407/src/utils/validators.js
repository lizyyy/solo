const Joi = require('joi');
const moment = require('moment');
const config = require('../config');

const packageSchema = Joi.object({
  package_code: Joi.string().required().description('包编号'),
  task_code: Joi.string().required().description('任务编号'),
  inspector_name: Joi.string().required().description('巡检员姓名'),
  readings: Joi.array()
    .items(
      Joi.object({
        device_code: Joi.string().required(),
        reading_time: Joi.string().isoDate().required(),
        temperature: Joi.number().optional(),
        pressure: Joi.number().optional()
      })
    )
    .min(1)
    .max(config.limits.maxReadingsPerPackage)
    .required()
    .description('读数列表')
});

function validatePackage(pkg) {
  return packageSchema.validate(pkg, { abortEarly: false });
}

function isTemperatureOutOfRange(temp) {
  if (temp === undefined || temp === null) return false;
  return temp < config.temperatureRange.min || temp > config.temperatureRange.max;
}

function isPressureOutOfRange(pressure) {
  if (pressure === undefined || pressure === null) return false;
  return pressure < config.pressureRange.min || pressure > config.pressureRange.max;
}

function isTaskExpired(dueDate) {
  return moment().isAfter(moment(dueDate));
}

function checkDuplicateReadings(readings) {
  const seen = new Map();
  const duplicates = [];

  for (let i = 0; i < readings.length; i++) {
    const key = `${readings[i].device_code}_${readings[i].reading_time}`;
    if (seen.has(key)) {
      duplicates.push({
        index: i,
        device_code: readings[i].device_code,
        reading_time: readings[i].reading_time,
        first_at: seen.get(key)
      });
    } else {
      seen.set(key, i);
    }
  }

  return duplicates;
}

module.exports = {
  validatePackage,
  isTemperatureOutOfRange,
  isPressureOutOfRange,
  isTaskExpired,
  checkDuplicateReadings
};
