const express = require('express');
const Joi = require('joi');
const { MeetingRoom, Equipment } = require('../models');
const { AppError } = require('../middleware/errorHandler');
const { recordCreate, recordUpdate, recordDelete } = require('../utils/historyService');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

const meetingRoomSchema = Joi.object({
  name: Joi.string().required(),
  location: Joi.string().required(),
  capacity: Joi.number().integer().min(1).required(),
  status: Joi.string().valid('active', 'inactive', 'maintenance').default('active')
});

router.get('/', async (req, res, next) => {
  try {
    const { status, page = 1, pageSize = 10 } = req.query;
    const where = { isDeleted: false };
    
    if (status) {
      where.status = status;
    }

    const { count, rows } = await MeetingRoom.findAndCountAll({
      where,
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
    const meetingRoom = await MeetingRoom.findOne({
      where: { id: req.params.id, isDeleted: false },
      include: [{
        model: Equipment,
        where: { isDeleted: false },
        required: false
      }]
    });

    if (!meetingRoom) {
      throw new AppError('会议室不存在', 404, 'MEETING_ROOM_NOT_FOUND');
    }

    res.json({
      success: true,
      data: meetingRoom
    });
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { error, value } = meetingRoomSchema.validate(req.body);
    if (error) {
      throw new AppError(error.details[0].message, 400, 'VALIDATION_ERROR');
    }

    const existing = await MeetingRoom.findOne({
      where: { name: value.name, isDeleted: false }
    });

    if (existing) {
      throw new AppError('会议室名称已存在', 400, 'DUPLICATE_NAME');
    }

    const operatorId = req.headers['x-operator-id'] || 'system';
    const operatorName = req.headers['x-operator-name'] || '系统管理员';

    const meetingRoom = await MeetingRoom.create({
      ...value,
      id: uuidv4(),
      createdBy: operatorId
    });

    await recordCreate(meetingRoom, operatorId, operatorName);

    res.status(201).json({
      success: true,
      data: meetingRoom,
      message: '会议室创建成功'
    });
  } catch (error) {
    next(error);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { error, value } = meetingRoomSchema.validate(req.body);
    if (error) {
      throw new AppError(error.details[0].message, 400, 'VALIDATION_ERROR');
    }

    const meetingRoom = await MeetingRoom.findOne({
      where: { id: req.params.id, isDeleted: false }
    });

    if (!meetingRoom) {
      throw new AppError('会议室不存在', 404, 'MEETING_ROOM_NOT_FOUND');
    }

    if (value.name !== meetingRoom.name) {
      const existing = await MeetingRoom.findOne({
        where: { name: value.name, isDeleted: false }
      });

      if (existing) {
        throw new AppError('会议室名称已存在', 400, 'DUPLICATE_NAME');
      }
    }

    const operatorId = req.headers['x-operator-id'] || 'system';
    const operatorName = req.headers['x-operator-name'] || '系统管理员';
    const oldValues = meetingRoom.toJSON();

    await meetingRoom.update(value);
    await recordUpdate(meetingRoom, operatorId, operatorName, oldValues);

    res.json({
      success: true,
      data: meetingRoom,
      message: '会议室更新成功'
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const meetingRoom = await MeetingRoom.findOne({
      where: { id: req.params.id, isDeleted: false }
    });

    if (!meetingRoom) {
      throw new AppError('会议室不存在', 404, 'MEETING_ROOM_NOT_FOUND');
    }

    const operatorId = req.headers['x-operator-id'] || 'system';
    const operatorName = req.headers['x-operator-name'] || '系统管理员';

    const oldValues = meetingRoom.toJSON();
    await meetingRoom.update({ isDeleted: true, status: 'inactive' });
    await recordDelete(meetingRoom, operatorId, operatorName, '软删除会议室');

    res.json({
      success: true,
      message: '会议室删除成功'
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
