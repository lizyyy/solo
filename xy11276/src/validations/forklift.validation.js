const Joi = require('joi');
const config = require('../../config/default');

const forkliftStatuses = ['idle', 'charging', 'working', 'maintenance', 'low_battery'];
const taskPriorities = ['low', 'normal', 'high', 'urgent'];
const taskStatuses = ['pending', 'assigned', 'in_progress', 'completed', 'cancelled'];
const stationStatuses = ['available', 'occupied', 'maintenance'];
const shiftStatuses = ['scheduled', 'in_progress', 'completed', 'cancelled'];

const createForkliftSchema = Joi.object({
  code: Joi.string().required().min(2).max(20).pattern(/^[A-Z0-9-]+$/).messages({
    'string.pattern.base': '叉车编号只能包含大写字母、数字和横杠'
  }),
  name: Joi.string().required().min(2).max(50),
  batteryLevel: Joi.number().integer().min(0).max(100).default(100),
  status: Joi.string().valid(...forkliftStatuses).default('idle'),
  operatorName: Joi.string().allow(null, '').max(50),
  operatorPhone: Joi.string().allow(null, '').pattern(/^1[3-9]\d{9}$/).messages({
    'string.pattern.base': '手机号格式不正确'
  }),
  operatorIdCard: Joi.string().allow(null, '').pattern(/^\d{17}[\dXx]$/).messages({
    'string.pattern.base': '身份证号格式不正确'
  }),
  lastMaintenanceDate: Joi.string().allow(null, '').isoDate(),
  maintainerContact: Joi.string().allow(null, '')
});

const updateForkliftSchema = Joi.object({
  name: Joi.string().min(2).max(50),
  batteryLevel: Joi.number().integer().min(0).max(100),
  status: Joi.string().valid(...forkliftStatuses),
  operatorName: Joi.string().allow(null, '').max(50),
  operatorPhone: Joi.string().allow(null, '').pattern(/^1[3-9]\d{9}$/),
  operatorIdCard: Joi.string().allow(null, '').pattern(/^\d{17}[\dXx]$/),
  lastMaintenanceDate: Joi.string().allow(null, '').isoDate(),
  maintainerContact: Joi.string().allow(null, '')
});

const createChargingStationSchema = Joi.object({
  code: Joi.string().required().min(2).max(20).pattern(/^[A-Z0-9-]+$/),
  name: Joi.string().required().min(2).max(50),
  status: Joi.string().valid(...stationStatuses).default('available')
});

const createShiftSchema = Joi.object({
  date: Joi.string().required().isoDate(),
  type: Joi.string().valid('day', 'night').default('night'),
  startTime: Joi.string().required().pattern(/^\d{2}:\d{2}$/),
  endTime: Joi.string().required().pattern(/^\d{2}:\d{2}$/),
  supervisorName: Joi.string().allow(null, '').max(50),
  status: Joi.string().valid(...shiftStatuses).default('scheduled')
});

const createTaskSchema = Joi.object({
  code: Joi.string().required().min(2).max(30).pattern(/^[A-Z0-9-]+$/),
  shiftId: Joi.string().required(),
  forkliftId: Joi.string().allow(null),
  type: Joi.string().required().valid('loading', 'unloading', 'transfer', 'inventory'),
  priority: Joi.string().valid(...taskPriorities).default('normal'),
  description: Joi.string().allow(null, '').max(500),
  location: Joi.string().allow(null, '').max(100),
  estimatedDuration: Joi.number().integer().min(1).max(480),
  status: Joi.string().valid(...taskStatuses).default('pending'),
  operatorName: Joi.string().allow(null, '').max(50)
});

const assignTaskSchema = Joi.object({
  forkliftId: Joi.string().required(),
  operatorName: Joi.string().allow(null, '').max(50)
});

const chargingActionSchema = Joi.object({
  forkliftId: Joi.string().required(),
  action: Joi.string().required().valid('start', 'stop')
});

module.exports = {
  createForkliftSchema,
  updateForkliftSchema,
  createChargingStationSchema,
  createShiftSchema,
  createTaskSchema,
  assignTaskSchema,
  chargingActionSchema,
  forkliftStatuses,
  taskPriorities,
  taskStatuses,
  stationStatuses,
  shiftStatuses
};