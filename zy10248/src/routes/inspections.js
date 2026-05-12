const express = require('express');
const Joi = require('joi');
const { Inspection, Booking, Equipment, MeetingRoom } = require('../models');
const { AppError } = require('../middleware/errorHandler');
const { recordCreate, recordUpdate } = require('../utils/historyService');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

const inspectionSchema = Joi.object({
  bookingId: Joi.string().uuid().required(),
  type: Joi.string().valid('pre', 'post').required(),
  inspectorId: Joi.string().required(),
  inspectorName: Joi.string().required(),
  inspectionTime: Joi.date().required(),
  equipmentStatus: Joi.array().items(Joi.object({
    equipmentId: Joi.string().uuid().required(),
    name: Joi.string().required(),
    status: Joi.string().valid('normal', 'damaged', 'missing').required(),
    remark: Joi.string().allow('', null)
  })).required(),
  hasDamage: Joi.boolean().default(false),
  damageDescription: Joi.string().allow('', null),
  photos: Joi.array().items(Joi.string()).default([]),
  remarks: Joi.string().allow('', null),
  status: Joi.string().valid('draft', 'submitted').default('draft')
});

router.get('/', async (req, res, next) => {
  try {
    const { type, bookingId, status, page = 1, pageSize = 10 } = req.query;
    const where = {};
    
    if (type) where.type = type;
    if (bookingId) where.bookingId = bookingId;
    if (status) where.status = status;

    const { count, rows } = await Inspection.findAndCountAll({
      where,
      include: [
        { model: Booking, attributes: ['id', 'title', 'organizerName', 'startTime', 'endTime'] },
        { model: MeetingRoom, attributes: ['id', 'name', 'location'] }
      ],
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
    const inspection = await Inspection.findOne({
      where: { id: req.params.id },
      include: [
        { model: Booking, attributes: ['id', 'title', 'organizerName', 'startTime', 'endTime'] },
        { model: MeetingRoom, attributes: ['id', 'name', 'location'] }
      ]
    });

    if (!inspection) {
      throw new AppError('检查记录不存在', 404, 'INSPECTION_NOT_FOUND');
    }

    res.json({
      success: true,
      data: inspection
    });
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { error, value } = inspectionSchema.validate(req.body);
    if (error) {
      throw new AppError(error.details[0].message, 400, 'VALIDATION_ERROR');
    }

    const booking = await Booking.findOne({
      where: { id: value.bookingId, isDeleted: false }
    });

    if (!booking) {
      throw new AppError('预约不存在', 400, 'BOOKING_NOT_FOUND');
    }

    const existingInspection = await Inspection.findOne({
      where: {
        bookingId: value.bookingId,
        type: value.type,
        status: 'submitted'
      }
    });

    if (existingInspection) {
      throw new AppError(`该预约的${value.type === 'pre' ? '会前' : '会后'}检查已完成，请勿重复提交`, 400, 'DUPLICATE_INSPECTION');
    }

    const meetingRoom = await MeetingRoom.findOne({
      where: { id: booking.meetingRoomId, isDeleted: false }
    });

    const operatorId = req.headers['x-operator-id'] || value.inspectorId;
    const operatorName = req.headers['x-operator-name'] || value.inspectorName;

    const hasDamage = value.equipmentStatus.some(item => item.status !== 'normal');

    const inspection = await Inspection.create({
      ...value,
      id: uuidv4(),
      meetingRoomId: booking.meetingRoomId,
      hasDamage,
      createdBy: operatorId
    });

    if (value.status === 'submitted') {
      if (value.type === 'pre') {
        await booking.update({ preInspectionId: inspection.id });
      } else {
        await booking.update({ postInspectionId: inspection.id });
      }
    }

    await recordCreate(inspection, operatorId, operatorName);

    res.status(201).json({
      success: true,
      data: inspection,
      message: hasDamage ? '检查记录已创建，发现设备损坏，请及时提交损坏报告' : '检查记录创建成功'
    });
  } catch (error) {
    next(error);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { error, value } = inspectionSchema.validate(req.body);
    if (error) {
      throw new AppError(error.details[0].message, 400, 'VALIDATION_ERROR');
    }

    const inspection = await Inspection.findByPk(req.params.id);
    if (!inspection) {
      throw new AppError('检查记录不存在', 404, 'INSPECTION_NOT_FOUND');
    }

    if (inspection.status === 'submitted') {
      throw new AppError('已提交的检查记录不能修改', 400, 'INSPECTION_ALREADY_SUBMITTED');
    }

    const booking = await Booking.findOne({
      where: { id: value.bookingId, isDeleted: false }
    });

    if (!booking) {
      throw new AppError('预约不存在', 400, 'BOOKING_NOT_FOUND');
    }

    const operatorId = req.headers['x-operator-id'] || value.inspectorId;
    const operatorName = req.headers['x-operator-name'] || value.inspectorName;
    const oldValues = inspection.toJSON();

    const hasDamage = value.equipmentStatus.some(item => item.status !== 'normal');

    await inspection.update({
      ...value,
      hasDamage
    });

    if (value.status === 'submitted') {
      if (value.type === 'pre') {
        await booking.update({ preInspectionId: inspection.id });
      } else {
        await booking.update({ postInspectionId: inspection.id });
      }
    }

    await recordUpdate(inspection, operatorId, operatorName, oldValues);

    res.json({
      success: true,
      data: inspection,
      message: '检查记录更新成功'
    });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/submit', async (req, res, next) => {
  try {
    const inspection = await Inspection.findByPk(req.params.id);
    if (!inspection) {
      throw new AppError('检查记录不存在', 404, 'INSPECTION_NOT_FOUND');
    }

    if (inspection.status === 'submitted') {
      throw new AppError('该检查记录已提交', 400, 'INSPECTION_ALREADY_SUBMITTED');
    }

    const booking = await Booking.findByPk(inspection.bookingId);
    const operatorId = req.headers['x-operator-id'] || 'system';
    const operatorName = req.headers['x-operator-name'] || '系统管理员';
    const oldValues = inspection.toJSON();

    await inspection.update({ status: 'submitted' });

    if (inspection.type === 'pre') {
      await booking.update({ preInspectionId: inspection.id });
    } else {
      await booking.update({ postInspectionId: inspection.id });
    }

    await recordUpdate(inspection, operatorId, operatorName, oldValues, '提交检查记录');

    res.json({
      success: true,
      data: inspection,
      message: inspection.hasDamage ? '检查记录已提交，发现设备损坏，请及时提交损坏报告' : '检查记录提交成功'
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
