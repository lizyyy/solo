const express = require('express');
const Joi = require('joi');
const { Op } = require('sequelize');
const { Booking, MeetingRoom, Equipment, Inspection } = require('../models');
const { AppError } = require('../middleware/errorHandler');
const { recordCreate, recordUpdate, recordStatusChange } = require('../utils/historyService');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');

const router = express.Router();

const bookingSchema = Joi.object({
  meetingRoomId: Joi.string().uuid().required(),
  title: Joi.string().required(),
  organizerId: Joi.string().required(),
  organizerName: Joi.string().required(),
  startTime: Joi.date().required(),
  endTime: Joi.date().required(),
  attendees: Joi.array().items(Joi.object()).default([]),
  status: Joi.string().valid('pending', 'confirmed', 'cancelled', 'completed').default('pending')
});

const checkTimeConflict = async (meetingRoomId, startTime, endTime, excludeId = null) => {
  const where = {
    meetingRoomId,
    isDeleted: false,
    status: { [Op.in]: ['pending', 'confirmed'] },
    [Op.and]: [
      { startTime: { [Op.lt]: endTime } },
      { endTime: { [Op.gt]: startTime } }
    ]
  };

  if (excludeId) {
    where.id = { [Op.ne]: excludeId };
  }

  const conflicts = await Booking.count({ where });
  return conflicts > 0;
};

const checkDamagedEquipment = async (meetingRoomId) => {
  const damagedEquipments = await Equipment.findAll({
    where: {
      meetingRoomId,
      status: 'damaged',
      isDeleted: false
    }
  });
  return damagedEquipments;
};

router.get('/', async (req, res, next) => {
  try {
    const { status, meetingRoomId, organizerId, date, page = 1, pageSize = 10 } = req.query;
    const where = { isDeleted: false };
    
    if (status) where.status = status;
    if (meetingRoomId) where.meetingRoomId = meetingRoomId;
    if (organizerId) where.organizerId = organizerId;
    if (date) {
      const startOfDay = moment(date).startOf('day').toDate();
      const endOfDay = moment(date).endOf('day').toDate();
      where.startTime = { [Op.gte]: startOfDay };
      where.endTime = { [Op.lte]: endOfDay };
    }

    const { count, rows } = await Booking.findAndCountAll({
      where,
      include: [
        { model: MeetingRoom, attributes: ['id', 'name', 'location'] },
        { model: Inspection, required: false }
      ],
      offset: (page - 1) * pageSize,
      limit: parseInt(pageSize),
      order: [['startTime', 'DESC']]
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
    const booking = await Booking.findOne({
      where: { id: req.params.id, isDeleted: false },
      include: [
        { model: MeetingRoom, attributes: ['id', 'name', 'location'] },
        { 
          model: Equipment, 
          where: { isDeleted: false }, 
          required: false,
          attributes: ['id', 'name', 'type', 'status']
        },
        { model: Inspection, required: false }
      ]
    });

    if (!booking) {
      throw new AppError('预约不存在', 404, 'BOOKING_NOT_FOUND');
    }

    res.json({
      success: true,
      data: booking
    });
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { error, value } = bookingSchema.validate(req.body);
    if (error) {
      throw new AppError(error.details[0].message, 400, 'VALIDATION_ERROR');
    }

    if (new Date(value.endTime) <= new Date(value.startTime)) {
      throw new AppError('结束时间必须晚于开始时间', 400, 'INVALID_TIME_RANGE');
    }

    const meetingRoom = await MeetingRoom.findOne({
      where: { id: value.meetingRoomId, isDeleted: false }
    });

    if (!meetingRoom) {
      throw new AppError('会议室不存在', 400, 'MEETING_ROOM_NOT_FOUND');
    }

    if (meetingRoom.status !== 'active') {
      throw new AppError('会议室当前不可用', 400, 'MEETING_ROOM_NOT_AVAILABLE');
    }

    const hasConflict = await checkTimeConflict(value.meetingRoomId, value.startTime, value.endTime);
    if (hasConflict) {
      throw new AppError('该时间段会议室已被预约', 400, 'TIME_CONFLICT');
    }

    const damagedEquipments = await checkDamagedEquipment(value.meetingRoomId);
    if (damagedEquipments.length > 0) {
      const equipmentNames = damagedEquipments.map(e => e.name).join('、');
      throw new AppError(`该会议室有设备损坏：${equipmentNames}，请选择其他会议室或先处理损坏`, 400, 'HAS_DAMAGED_EQUIPMENT');
    }

    const operatorId = req.headers['x-operator-id'] || value.organizerId;
    const operatorName = req.headers['x-operator-name'] || value.organizerName;

    const booking = await Booking.create({
      ...value,
      id: uuidv4(),
      createdBy: operatorId
    });

    await recordCreate(booking, operatorId, operatorName);

    res.status(201).json({
      success: true,
      data: booking,
      message: '预约创建成功'
    });
  } catch (error) {
    next(error);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { error, value } = bookingSchema.validate(req.body);
    if (error) {
      throw new AppError(error.details[0].message, 400, 'VALIDATION_ERROR');
    }

    const booking = await Booking.findOne({
      where: { id: req.params.id, isDeleted: false }
    });

    if (!booking) {
      throw new AppError('预约不存在', 404, 'BOOKING_NOT_FOUND');
    }

    if (new Date(value.endTime) <= new Date(value.startTime)) {
      throw new AppError('结束时间必须晚于开始时间', 400, 'INVALID_TIME_RANGE');
    }

    if (value.meetingRoomId !== booking.meetingRoomId) {
      const meetingRoom = await MeetingRoom.findOne({
        where: { id: value.meetingRoomId, isDeleted: false }
      });

      if (!meetingRoom) {
        throw new AppError('会议室不存在', 400, 'MEETING_ROOM_NOT_FOUND');
      }

      if (meetingRoom.status !== 'active') {
        throw new AppError('会议室当前不可用', 400, 'MEETING_ROOM_NOT_AVAILABLE');
      }
    }

    const hasConflict = await checkTimeConflict(
      value.meetingRoomId || booking.meetingRoomId,
      value.startTime || booking.startTime,
      value.endTime || booking.endTime,
      booking.id
    );

    if (hasConflict) {
      throw new AppError('该时间段会议室已被预约', 400, 'TIME_CONFLICT');
    }

    if (value.meetingRoomId) {
      const damagedEquipments = await checkDamagedEquipment(value.meetingRoomId);
      if (damagedEquipments.length > 0) {
        const equipmentNames = damagedEquipments.map(e => e.name).join('、');
        throw new AppError(`该会议室有设备损坏：${equipmentNames}，请选择其他会议室或先处理损坏`, 400, 'HAS_DAMAGED_EQUIPMENT');
      }
    }

    const operatorId = req.headers['x-operator-id'] || 'system';
    const operatorName = req.headers['x-operator-name'] || '系统管理员';
    const oldValues = booking.toJSON();

    await booking.update(value);
    await recordUpdate(booking, operatorId, operatorName, oldValues);

    res.json({
      success: true,
      data: booking,
      message: '预约更新成功'
    });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/status', async (req, res, next) => {
  try {
    const { status } = req.body;
    
    if (!['pending', 'confirmed', 'cancelled', 'completed'].includes(status)) {
      throw new AppError('无效的状态值', 400, 'INVALID_STATUS');
    }

    const booking = await Booking.findOne({
      where: { id: req.params.id, isDeleted: false }
    });

    if (!booking) {
      throw new AppError('预约不存在', 404, 'BOOKING_NOT_FOUND');
    }

    const oldStatus = booking.status;
    const operatorId = req.headers['x-operator-id'] || 'system';
    const operatorName = req.headers['x-operator-name'] || '系统管理员';

    await booking.update({ status });
    await recordStatusChange(booking, oldStatus, status, operatorId, operatorName);

    res.json({
      success: true,
      data: booking,
      message: '预约状态更新成功'
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const booking = await Booking.findOne({
      where: { id: req.params.id, isDeleted: false }
    });

    if (!booking) {
      throw new AppError('预约不存在', 404, 'BOOKING_NOT_FOUND');
    }

    const operatorId = req.headers['x-operator-id'] || 'system';
    const operatorName = req.headers['x-operator-name'] || '系统管理员';

    const oldValues = booking.toJSON();
    await booking.update({ isDeleted: true, status: 'cancelled' });
    await recordUpdate(booking, operatorId, operatorName, oldValues, '取消预约（软删除）');

    res.json({
      success: true,
      message: '预约取消成功'
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
