const express = require('express');
const Joi = require('joi');
const { Op } = require('sequelize');
const { DamageReport, Equipment, Booking, MeetingRoom, Inspection } = require('../models');
const { AppError } = require('../middleware/errorHandler');
const { recordCreate, recordUpdate, recordStatusChange } = require('../utils/historyService');
const { generateReportNumber } = require('../utils/generateNumber');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');

const router = express.Router();

const damageReportSchema = Joi.object({
  equipmentId: Joi.string().uuid().required(),
  bookingId: Joi.string().uuid().allow(null),
  inspectionId: Joi.string().uuid().allow(null),
  reporterId: Joi.string().required(),
  reporterName: Joi.string().required(),
  reportTime: Joi.date().required(),
  damageType: Joi.string().valid('wear', 'accident', 'misuse', 'unknown').default('unknown'),
  severity: Joi.string().valid('minor', 'moderate', 'severe').default('minor'),
  description: Joi.string().required(),
  photos: Joi.array().items(Joi.string()).default([]),
  estimatedCost: Joi.number().precision(2).min(0).allow(null),
  status: Joi.string().valid('pending', 'investigating', 'confirmed', 'resolved', 'duplicate').default('pending'),
  liabilityStatus: Joi.string().valid('unassigned', 'assigned', 'confirmed', 'appealed', 'waived').default('unassigned'),
  liablePersonId: Joi.string().allow(null),
  liablePersonName: Joi.string().allow(null),
  parentReportId: Joi.string().uuid().allow(null),
  isDuplicate: Joi.boolean().default(false)
});

const checkDuplicateReport = async (equipmentId, description, excludeId = null) => {
  const threeDaysAgo = moment().subtract(3, 'days').toDate();
  const where = {
    equipmentId,
    isDeleted: false,
    isDuplicate: false,
    reportTime: { [Op.gte]: threeDaysAgo }
  };

  if (excludeId) {
    where.id = { [Op.ne]: excludeId };
  }

  const reports = await DamageReport.findAll({ where });
  
  for (const report of reports) {
    const similarity = calculateSimilarity(description, report.description);
    if (similarity > 0.7) {
      return report;
    }
  }
  return null;
};

const calculateSimilarity = (str1, str2) => {
  const set1 = new Set(str1.toLowerCase().split(/\s+/));
  const set2 = new Set(str2.toLowerCase().split(/\s+/));
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  return intersection.size / union.size;
};

router.get('/', async (req, res, next) => {
  try {
    const { status, liabilityStatus, equipmentId, meetingRoomId, page = 1, pageSize = 10 } = req.query;
    const where = { isDeleted: false };
    
    if (status) where.status = status;
    if (liabilityStatus) where.liabilityStatus = liabilityStatus;
    if (equipmentId) where.equipmentId = equipmentId;
    if (meetingRoomId) where.meetingRoomId = meetingRoomId;

    const { count, rows } = await DamageReport.findAndCountAll({
      where,
      include: [
        { model: Equipment, attributes: ['id', 'name', 'type', 'serialNumber'] },
        { model: MeetingRoom, attributes: ['id', 'name', 'location'] },
        { model: Booking, attributes: ['id', 'title', 'organizerName'], required: false },
        { model: Inspection, attributes: ['id', 'type', 'inspectorName'], required: false },
        { model: DamageReport, as: 'ParentReport', attributes: ['id', 'reportNumber'], required: false }
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
    const damageReport = await DamageReport.findOne({
      where: { id: req.params.id, isDeleted: false },
      include: [
        { model: Equipment, attributes: ['id', 'name', 'type', 'serialNumber'] },
        { model: MeetingRoom, attributes: ['id', 'name', 'location'] },
        { model: Booking, attributes: ['id', 'title', 'organizerName'], required: false },
        { model: Inspection, attributes: ['id', 'type', 'inspectorName'], required: false },
        { model: DamageReport, as: 'DuplicateReports', required: false }
      ]
    });

    if (!damageReport) {
      throw new AppError('损坏报告不存在', 404, 'DAMAGE_REPORT_NOT_FOUND');
    }

    res.json({
      success: true,
      data: damageReport
    });
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { error, value } = damageReportSchema.validate(req.body);
    if (error) {
      throw new AppError(error.details[0].message, 400, 'VALIDATION_ERROR');
    }

    const equipment = await Equipment.findOne({
      where: { id: value.equipmentId, isDeleted: false }
    });

    if (!equipment) {
      throw new AppError('设备不存在', 400, 'EQUIPMENT_NOT_FOUND');
    }

    if (value.bookingId) {
      const booking = await Booking.findOne({
        where: { id: value.bookingId, isDeleted: false }
      });
      if (!booking) {
        throw new AppError('关联的预约不存在', 400, 'BOOKING_NOT_FOUND');
      }
    }

    const duplicateReport = await checkDuplicateReport(value.equipmentId, value.description);
    if (duplicateReport) {
      throw new AppError(`检测到相似报告（报告号：${duplicateReport.reportNumber}），请确认是否重复报修`, 400, 'DUPLICATE_REPORT_DETECTED');
    }

    const operatorId = req.headers['x-operator-id'] || value.reporterId;
    const operatorName = req.headers['x-operator-name'] || value.reporterName;

    const damageReport = await DamageReport.create({
      ...value,
      id: uuidv4(),
      reportNumber: generateReportNumber(),
      meetingRoomId: equipment.meetingRoomId,
      createdBy: operatorId
    });

    await recordCreate(damageReport, operatorId, operatorName);

    res.status(201).json({
      success: true,
      data: damageReport,
      message: '损坏报告提交成功，请等待责任确认'
    });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/mark-duplicate', async (req, res, next) => {
  try {
    const { parentReportId } = req.body;
    
    if (!parentReportId) {
      throw new AppError('请指定主报告ID', 400, 'PARENT_REPORT_REQUIRED');
    }

    const damageReport = await DamageReport.findOne({
      where: { id: req.params.id, isDeleted: false }
    });

    if (!damageReport) {
      throw new AppError('损坏报告不存在', 404, 'DAMAGE_REPORT_NOT_FOUND');
    }

    if (damageReport.id === parentReportId) {
      throw new AppError('不能将报告标记为自己的重复报告', 400, 'INVALID_PARENT_REPORT');
    }

    const parentReport = await DamageReport.findOne({
      where: { id: parentReportId, isDeleted: false, isDuplicate: false }
    });

    if (!parentReport) {
      throw new AppError('主报告不存在或已被标记为重复', 404, 'PARENT_REPORT_NOT_FOUND');
    }

    const operatorId = req.headers['x-operator-id'] || 'system';
    const operatorName = req.headers['x-operator-name'] || '系统管理员';
    const oldValues = damageReport.toJSON();

    await damageReport.update({
      isDuplicate: true,
      parentReportId,
      status: 'duplicate'
    });

    await recordUpdate(damageReport, operatorId, operatorName, oldValues, `标记为重复报告，主报告：${parentReport.reportNumber}`);

    res.json({
      success: true,
      data: damageReport,
      message: '已标记为重复报告'
    });
  } catch (error) {
    next(error);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { error, value } = damageReportSchema.validate(req.body);
    if (error) {
      throw new AppError(error.details[0].message, 400, 'VALIDATION_ERROR');
    }

    const damageReport = await DamageReport.findOne({
      where: { id: req.params.id, isDeleted: false }
    });

    if (!damageReport) {
      throw new AppError('损坏报告不存在', 404, 'DAMAGE_REPORT_NOT_FOUND');
    }

    if (damageReport.liabilityStatus === 'confirmed') {
      throw new AppError('责任已确认的报告不能修改', 400, 'REPORT_ALREADY_CONFIRMED');
    }

    if (value.equipmentId && value.equipmentId !== damageReport.equipmentId) {
      const equipment = await Equipment.findOne({
        where: { id: value.equipmentId, isDeleted: false }
      });
      if (!equipment) {
        throw new AppError('设备不存在', 400, 'EQUIPMENT_NOT_FOUND');
      }
    }

    const operatorId = req.headers['x-operator-id'] || 'system';
    const operatorName = req.headers['x-operator-name'] || '系统管理员';
    const oldValues = damageReport.toJSON();

    await damageReport.update(value);
    await recordUpdate(damageReport, operatorId, operatorName, oldValues);

    res.json({
      success: true,
      data: damageReport,
      message: '损坏报告更新成功'
    });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/status', async (req, res, next) => {
  try {
    const { status } = req.body;
    
    if (!['pending', 'investigating', 'confirmed', 'resolved', 'duplicate'].includes(status)) {
      throw new AppError('无效的状态值', 400, 'INVALID_STATUS');
    }

    const damageReport = await DamageReport.findOne({
      where: { id: req.params.id, isDeleted: false }
    });

    if (!damageReport) {
      throw new AppError('损坏报告不存在', 404, 'DAMAGE_REPORT_NOT_FOUND');
    }

    const oldStatus = damageReport.status;
    const operatorId = req.headers['x-operator-id'] || 'system';
    const operatorName = req.headers['x-operator-name'] || '系统管理员';

    await damageReport.update({ status });
    await recordStatusChange(damageReport, oldStatus, status, operatorId, operatorName);

    res.json({
      success: true,
      data: damageReport,
      message: '损坏报告状态更新成功'
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const damageReport = await DamageReport.findOne({
      where: { id: req.params.id, isDeleted: false }
    });

    if (!damageReport) {
      throw new AppError('损坏报告不存在', 404, 'DAMAGE_REPORT_NOT_FOUND');
    }

    if (damageReport.liabilityStatus === 'confirmed') {
      throw new AppError('责任已确认的报告不能删除', 400, 'REPORT_ALREADY_CONFIRMED');
    }

    const operatorId = req.headers['x-operator-id'] || 'system';
    const operatorName = req.headers['x-operator-name'] || '系统管理员';

    const oldValues = damageReport.toJSON();
    await damageReport.update({ isDeleted: true });
    await recordUpdate(damageReport, operatorId, operatorName, oldValues, '删除损坏报告');

    res.json({
      success: true,
      message: '损坏报告删除成功'
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
