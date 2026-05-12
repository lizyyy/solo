const express = require('express');
const Joi = require('joi');
const { Equipment, MeetingRoom } = require('../models');
const { AppError } = require('../middleware/errorHandler');
const { recordCreate, recordUpdate, recordDelete } = require('../utils/historyService');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

const equipmentSchema = Joi.object({
  name: Joi.string().required(),
  type: Joi.string().valid('projector', 'whiteboard', 'camera', 'microphone', 'speaker', 'tv', 'other').required(),
  brand: Joi.string().allow('', null),
  model: Joi.string().allow('', null),
  serialNumber: Joi.string().allow('', null),
  meetingRoomId: Joi.string().uuid().required(),
  status: Joi.string().valid('normal', 'damaged', 'repairing', 'scrapped').default('normal'),
  purchaseDate: Joi.date().allow(null),
  price: Joi.number().precision(2).min(0).allow(null)
});

router.get('/', async (req, res, next) => {
  try {
    const { type, status, meetingRoomId, page = 1, pageSize = 10 } = req.query;
    const where = { isDeleted: false };
    
    if (type) where.type = type;
    if (status) where.status = status;
    if (meetingRoomId) where.meetingRoomId = meetingRoomId;

    const { count, rows } = await Equipment.findAndCountAll({
      where,
      include: [{ model: MeetingRoom, attributes: ['id', 'name', 'location'] }],
      offset: (page - 1) * pageSize,
      limit: parseInt(pageSize),
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      data: rows,
      pagination: {
        total: count,
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        totalPages: Math.ceil(count / pageSize)
      }
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const equipment = await Equipment.findOne({
      where: { id: req.params.id, isDeleted: false },
      include: [{ model: MeetingRoom, attributes: ['id', 'name', 'location'] }]
    });

    if (!equipment) {
      throw new AppError('设备不存在', 404, 'EQUIPMENT_NOT_FOUND');
    }

    res.json({
      success: true,
      data: equipment
    });
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { error, value } = equipmentSchema.validate(req.body);
    if (error) {
      throw new AppError(error.details[0].message, 400, 'VALIDATION_ERROR');
    }

    const meetingRoom = await MeetingRoom.findOne({
      where: { id: value.meetingRoomId, isDeleted: false }
    });

    if (!meetingRoom) {
      throw new AppError('所属会议室不存在', 400, 'MEETING_ROOM_NOT_FOUND');
    }

    if (value.serialNumber) {
      const existing = await Equipment.findOne({
        where: { serialNumber: value.serialNumber, isDeleted: false }
      });

      if (existing) {
        throw new AppError('设备序列号已存在', 400, 'DUPLICATE_SERIAL_NUMBER');
      }
    }

    const operatorId = req.headers['x-operator-id'] || 'system';
    const operatorName = req.headers['x-operator-name'] || '系统管理员';

    const equipment = await Equipment.create({
      ...value,
      id: uuidv4(),
      createdBy: operatorId
    });

    await recordCreate(equipment, operatorId, operatorName);

    res.status(201).json({
      success: true,
      data: equipment,
      message: '设备创建成功'
    });
  } catch (error) {
    next(error);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { error, value } = equipmentSchema.validate(req.body);
    if (error) {
      throw new AppError(error.details[0].message, 400, 'VALIDATION_ERROR');
    }

    const equipment = await Equipment.findOne({
      where: { id: req.params.id, isDeleted: false }
    });

    if (!equipment) {
      throw new AppError('设备不存在', 404, 'EQUIPMENT_NOT_FOUND');
    }

    if (value.meetingRoomId !== equipment.meetingRoomId) {
      const meetingRoom = await MeetingRoom.findOne({
        where: { id: value.meetingRoomId, isDeleted: false }
      });

      if (!meetingRoom) {
        throw new AppError('所属会议室不存在', 400, 'MEETING_ROOM_NOT_FOUND');
      }
    }

    if (value.serialNumber && value.serialNumber !== equipment.serialNumber) {
      const existing = await Equipment.findOne({
        where: { serialNumber: value.serialNumber, isDeleted: false }
      });

      if (existing) {
        throw new AppError('设备序列号已存在', 400, 'DUPLICATE_SERIAL_NUMBER');
      }
    }

    const operatorId = req.headers['x-operator-id'] || 'system';
    const operatorName = req.headers['x-operator-name'] || '系统管理员';
    const oldValues = equipment.toJSON();

    await equipment.update(value);
    await recordUpdate(equipment, operatorId, operatorName, oldValues);

    res.json({
      success: true,
      data: equipment,
      message: '设备更新成功'
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const equipment = await Equipment.findOne({
      where: { id: req.params.id, isDeleted: false }
    });

    if (!equipment) {
      throw new AppError('设备不存在', 404, 'EQUIPMENT_NOT_FOUND');
    }

    const operatorId = req.headers['x-operator-id'] || 'system';
    const operatorName = req.headers['x-operator-name'] || '系统管理员';

    const oldValues = equipment.toJSON();
    await equipment.update({ isDeleted: true, status: 'scrapped' });
    await recordDelete(equipment, operatorId, operatorName, '软删除设备');

    res.json({
      success: true,
      message: '设备删除成功'
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
