const express = require('express');
const Joi = require('joi');
const { Parser } = require('json2csv');
const { Op } = require('sequelize');
const { LiabilityConfirmation, Compensation, DamageReport, Booking, Equipment, MeetingRoom } = require('../models');
const { AppError } = require('../middleware/errorHandler');
const { recordCreate, recordUpdate } = require('../utils/historyService');
const { generateCompensationNumber } = require('../utils/generateNumber');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');

const router = express.Router();

const liabilitySchema = Joi.object({
  damageReportId: Joi.string().uuid().required(),
  bookingId: Joi.string().uuid().allow(null),
  confirmedById: Joi.string().required(),
  confirmedByName: Joi.string().required(),
  confirmationTime: Joi.date().required(),
  liablePersonId: Joi.string().required(),
  liablePersonName: Joi.string().required(),
  liabilityType: Joi.string().valid('direct', 'indirect', 'no_inspection', 'administrative').required(),
  liabilityRatio: Joi.number().integer().min(0).max(100).default(100),
  compensationAmount: Joi.number().precision(2).min(0).allow(null),
  description: Joi.string().required(),
  evidence: Joi.array().items(Joi.string()).default([]),
  isLocked: Joi.boolean().default(false),
  status: Joi.string().valid('pending', 'confirmed', 'appealed', 'waived').default('pending')
});

const compensationSchema = Joi.object({
  liabilityConfirmationId: Joi.string().uuid().required(),
  payerId: Joi.string().required(),
  payerName: Joi.string().required(),
  amount: Joi.number().precision(2).min(0).required(),
  paymentMethod: Joi.string().valid('cash', 'bank_transfer', 'salary_deduction', 'other').required(),
  paymentTime: Joi.date().allow(null),
  receivedById: Joi.string().allow(null),
  receivedByName: Joi.string().allow(null),
  receiptNumber: Joi.string().allow(null),
  remarks: Joi.string().allow('', null),
  status: Joi.string().valid('pending', 'paid', 'cancelled', 'waived').default('pending')
});

router.get('/confirmations', async (req, res, next) => {
  try {
    const { status, damageReportId, liablePersonId, page = 1, pageSize = 10 } = req.query;
    const where = {};
    
    if (status) where.status = status;
    if (damageReportId) where.damageReportId = damageReportId;
    if (liablePersonId) where.liablePersonId = liablePersonId;

    const { count, rows } = await LiabilityConfirmation.findAndCountAll({
      where,
      include: [
        { 
          model: DamageReport, 
          attributes: ['id', 'reportNumber', 'description', 'estimatedCost', 'status', 'liabilityStatus'],
          include: [
            { model: Equipment, attributes: ['id', 'name', 'type'] },
            { model: MeetingRoom, attributes: ['id', 'name', 'location'] }
          ]
        },
        { model: Booking, attributes: ['id', 'title', 'organizerName'], required: false }
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

router.get('/confirmations/:id', async (req, res, next) => {
  try {
    const confirmation = await LiabilityConfirmation.findOne({
      where: { id: req.params.id },
      include: [
        { 
          model: DamageReport, 
          attributes: ['id', 'reportNumber', 'description', 'estimatedCost'],
          include: [
            { model: Equipment, attributes: ['id', 'name', 'type'] },
            { model: MeetingRoom, attributes: ['id', 'name', 'location'] }
          ]
        },
        { model: Booking, attributes: ['id', 'title', 'organizerName'], required: false },
        { model: Compensation, required: false }
      ]
    });

    if (!confirmation) {
      throw new AppError('责任确认记录不存在', 404, 'LIABILITY_NOT_FOUND');
    }

    res.json({
      success: true,
      data: confirmation
    });
  } catch (error) {
    next(error);
  }
});

router.post('/confirmations', async (req, res, next) => {
  try {
    const { error, value } = liabilitySchema.validate(req.body);
    if (error) {
      throw new AppError(error.details[0].message, 400, 'VALIDATION_ERROR');
    }

    const damageReport = await DamageReport.findOne({
      where: { id: value.damageReportId, isDeleted: false }
    });

    if (!damageReport) {
      throw new AppError('损坏报告不存在', 400, 'DAMAGE_REPORT_NOT_FOUND');
    }

    if (damageReport.liabilityStatus === 'confirmed') {
      throw new AppError('该损坏报告的责任已确认', 400, 'LIABILITY_ALREADY_CONFIRMED');
    }

    const existingConfirmation = await LiabilityConfirmation.findOne({
      where: { 
        damageReportId: value.damageReportId,
        status: { [Op.in]: ['pending', 'confirmed'] }
      }
    });

    if (existingConfirmation) {
      throw new AppError('该损坏报告已有责任确认记录', 400, 'DUPLICATE_CONFIRMATION');
    }

    const operatorId = req.headers['x-operator-id'] || value.confirmedById;
    const operatorName = req.headers['x-operator-name'] || value.confirmedByName;

    const confirmation = await LiabilityConfirmation.create({
      ...value,
      id: uuidv4(),
      createdBy: operatorId
    });

    if (value.status === 'confirmed') {
      await damageReport.update({
        liabilityStatus: 'confirmed',
        liablePersonId: value.liablePersonId,
        liablePersonName: value.liablePersonName
      });
    } else {
      await damageReport.update({
        liabilityStatus: 'assigned',
        liablePersonId: value.liablePersonId,
        liablePersonName: value.liablePersonName
      });
    }

    await recordCreate(confirmation, operatorId, operatorName);

    res.status(201).json({
      success: true,
      data: confirmation,
      message: value.status === 'confirmed' ? '责任确认完成，请安排赔付' : '责任待确认'
    });
  } catch (error) {
    next(error);
  }
});

router.post('/confirmations/auto-assign-from-booking/:bookingId', async (req, res, next) => {
  try {
    const booking = await Booking.findOne({
      where: { id: req.params.bookingId, isDeleted: false }
    });

    if (!booking) {
      throw new AppError('预约不存在', 404, 'BOOKING_NOT_FOUND');
    }

    if (booking.preInspectionId && booking.postInspectionId) {
      throw new AppError('该预约已有完整的会前会后检查记录，无法自动归责', 400, 'HAS_COMPLETE_INSPECTION');
    }

    const equipment = await Equipment.findAll({
      where: { meetingRoomId: booking.meetingRoomId, isDeleted: false }
    });

    const operatorId = req.headers['x-operator-id'] || 'system';
    const operatorName = req.headers['x-operator-name'] || '系统管理员';

    const results = [];
    for (const eq of equipment) {
      const existingReport = await DamageReport.findOne({
        where: {
          equipmentId: eq.id,
          bookingId: booking.id,
          isDeleted: false
        }
      });

      if (existingReport) {
        const confirmation = await LiabilityConfirmation.create({
          id: uuidv4(),
          damageReportId: existingReport.id,
          bookingId: booking.id,
          confirmedById: operatorId,
          confirmedByName: operatorName,
          confirmationTime: new Date(),
          liablePersonId: booking.organizerId,
          liablePersonName: booking.organizerName,
          liabilityType: 'no_inspection',
          liabilityRatio: 100,
          compensationAmount: existingReport.estimatedCost,
          description: `因${!booking.preInspectionId ? '会前' : ''}${!booking.preInspectionId && !booking.postInspectionId ? '和' : ''}${!booking.postInspectionId ? '会后' : ''}检查缺失，自动归责`,
          status: 'confirmed',
          createdBy: operatorId
        });

        await existingReport.update({
          liabilityStatus: 'confirmed',
          liablePersonId: booking.organizerId,
          liablePersonName: booking.organizerName
        });

        await booking.update({
          hasLiability: true,
          liabilityNote: '因未做设备检查自动归责'
        });

        await recordCreate(confirmation, operatorId, operatorName, '自动归责（无检查记录）');
        results.push(confirmation);
      }
    }

    res.json({
      success: true,
      data: results,
      message: `自动归责完成，共处理 ${results.length} 条记录`
    });
  } catch (error) {
    next(error);
  }
});

router.put('/confirmations/:id', async (req, res, next) => {
  try {
    const { error, value } = liabilitySchema.validate(req.body);
    if (error) {
      throw new AppError(error.details[0].message, 400, 'VALIDATION_ERROR');
    }

    const confirmation = await LiabilityConfirmation.findByPk(req.params.id);
    if (!confirmation) {
      throw new AppError('责任确认记录不存在', 404, 'LIABILITY_NOT_FOUND');
    }

    if (confirmation.isLocked) {
      throw new AppError('该责任确认已锁定（已赔付完成），不能修改', 400, 'LIABILITY_LOCKED');
    }

    const operatorId = req.headers['x-operator-id'] || 'system';
    const operatorName = req.headers['x-operator-name'] || '系统管理员';
    const oldValues = confirmation.toJSON();

    await confirmation.update(value);

    if (value.status === 'confirmed') {
      const damageReport = await DamageReport.findByPk(value.damageReportId);
      await damageReport.update({
        liabilityStatus: 'confirmed',
        liablePersonId: value.liablePersonId,
        liablePersonName: value.liablePersonName
      });
    }

    await recordUpdate(confirmation, operatorId, operatorName, oldValues);

    res.json({
      success: true,
      data: confirmation,
      message: '责任确认更新成功'
    });
  } catch (error) {
    next(error);
  }
});

router.get('/compensations', async (req, res, next) => {
  try {
    const { status, payerId, liabilityConfirmationId, page = 1, pageSize = 10 } = req.query;
    const where = {};
    
    if (status) where.status = status;
    if (payerId) where.payerId = payerId;
    if (liabilityConfirmationId) where.liabilityConfirmationId = liabilityConfirmationId;

    const { count, rows } = await Compensation.findAndCountAll({
      where,
      include: [
        { 
          model: LiabilityConfirmation,
          include: [
            { 
              model: DamageReport,
              include: [
                { model: Equipment, attributes: ['id', 'name', 'type'] },
                { model: MeetingRoom, attributes: ['id', 'name', 'location'] }
              ]
            }
          ]
        }
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

router.get('/compensations/export', async (req, res, next) => {
  try {
    const { status = 'pending' } = req.query;
    const where = { status };

    const compensations = await Compensation.findAll({
      where,
      include: [
        { 
          model: LiabilityConfirmation,
          attributes: ['id', 'liablePersonName', 'liabilityType', 'description'],
          include: [
            { 
              model: DamageReport,
              attributes: ['id', 'reportNumber', 'description', 'estimatedCost'],
              include: [
                { model: Equipment, attributes: ['id', 'name', 'type'] },
                { model: MeetingRoom, attributes: ['id', 'name', 'location'] }
              ]
            }
          ]
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    const exportData = compensations.map(cp => ({
      赔付单号: cp.compensationNumber,
      责任人: cp.LiabilityConfirmation.liablePersonName,
      责任类型: cp.LiabilityConfirmation.liabilityType === 'no_inspection' ? '无检查归责' : 
                cp.LiabilityConfirmation.liabilityType === 'direct' ? '直接责任' :
                cp.LiabilityConfirmation.liabilityType === 'indirect' ? '间接责任' : '行政责任',
      设备名称: cp.LiabilityConfirmation.DamageReport.Equipment.name,
      设备类型: cp.LiabilityConfirmation.DamageReport.Equipment.type,
      会议室: cp.LiabilityConfirmation.DamageReport.MeetingRoom.name,
      损坏描述: cp.LiabilityConfirmation.DamageReport.description,
      赔付金额: cp.amount,
      支付方式: cp.paymentMethod === 'cash' ? '现金' :
                 cp.paymentMethod === 'bank_transfer' ? '银行转账' :
                 cp.paymentMethod === 'salary_deduction' ? '工资扣除' : '其他',
      状态: cp.status === 'pending' ? '待支付' :
            cp.status === 'paid' ? '已支付' :
            cp.status === 'cancelled' ? '已取消' : '已豁免',
      备注: cp.remarks || '',
      创建时间: moment(cp.createdAt).format('YYYY-MM-DD HH:mm:ss')
    }));

    const fields = [
      '赔付单号', '责任人', '责任类型', '设备名称', '设备类型', '会议室',
      '损坏描述', '赔付金额', '支付方式', '状态', '备注', '创建时间'
    ];

    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(exportData);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    const filename = encodeURIComponent(`待处理赔付列表_${moment().format('YYYYMMDD')}.csv`);
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${filename}`);
    res.send('\uFEFF' + csv);
  } catch (error) {
    next(error);
  }
});

router.get('/compensations/:id', async (req, res, next) => {
  try {
    const compensation = await Compensation.findOne({
      where: { id: req.params.id },
      include: [
        { 
          model: LiabilityConfirmation,
          include: [
            { 
              model: DamageReport,
              include: [
                { model: Equipment, attributes: ['id', 'name', 'type'] },
                { model: MeetingRoom, attributes: ['id', 'name', 'location'] }
              ]
            }
          ]
        }
      ]
    });

    if (!compensation) {
      throw new AppError('赔付记录不存在', 404, 'COMPENSATION_NOT_FOUND');
    }

    res.json({
      success: true,
      data: compensation
    });
  } catch (error) {
    next(error);
  }
});

router.post('/compensations', async (req, res, next) => {
  try {
    const { error, value } = compensationSchema.validate(req.body);
    if (error) {
      throw new AppError(error.details[0].message, 400, 'VALIDATION_ERROR');
    }

    const confirmation = await LiabilityConfirmation.findByPk(value.liabilityConfirmationId);
    if (!confirmation) {
      throw new AppError('责任确认记录不存在', 400, 'LIABILITY_NOT_FOUND');
    }

    if (confirmation.status !== 'confirmed') {
      throw new AppError('责任尚未确认，无法创建赔付', 400, 'LIABILITY_NOT_CONFIRMED');
    }

    const existingCompensation = await Compensation.findOne({
      where: { 
        liabilityConfirmationId: value.liabilityConfirmationId,
        status: { [Op.in]: ['pending', 'paid'] }
      }
    });

    if (existingCompensation) {
      throw new AppError('该责任确认已有赔付记录', 400, 'DUPLICATE_COMPENSATION');
    }

    const operatorId = req.headers['x-operator-id'] || 'system';
    const operatorName = req.headers['x-operator-name'] || '系统管理员';

    const compensation = await Compensation.create({
      ...value,
      id: uuidv4(),
      compensationNumber: generateCompensationNumber(),
      damageReportId: confirmation.damageReportId,
      createdBy: operatorId
    });

    await recordCreate(compensation, operatorId, operatorName);

    res.status(201).json({
      success: true,
      data: compensation,
      message: '赔付记录创建成功'
    });
  } catch (error) {
    next(error);
  }
});

router.patch('/compensations/:id/pay', async (req, res, next) => {
  try {
    const { paymentTime, receivedById, receivedByName, receiptNumber } = req.body;

    const compensation = await Compensation.findByPk(req.params.id);
    if (!compensation) {
      throw new AppError('赔付记录不存在', 404, 'COMPENSATION_NOT_FOUND');
    }

    if (compensation.status !== 'pending') {
      throw new AppError('只有待支付状态的赔付记录才能完成支付', 400, 'INVALID_STATUS');
    }

    const operatorId = req.headers['x-operator-id'] || 'system';
    const operatorName = req.headers['x-operator-name'] || '系统管理员';
    const oldValues = compensation.toJSON();

    await compensation.update({
      status: 'paid',
      paymentTime: paymentTime || new Date(),
      receivedById,
      receivedByName,
      receiptNumber
    });

    const confirmation = await LiabilityConfirmation.findByPk(compensation.liabilityConfirmationId);
    await confirmation.update({ isLocked: true });

    await recordUpdate(compensation, operatorId, operatorName, oldValues, '完成赔付支付');

    res.json({
      success: true,
      data: compensation,
      message: '赔付完成，责任确认已锁定'
    });
  } catch (error) {
    next(error);
  }
});

router.put('/compensations/:id', async (req, res, next) => {
  try {
    const { error, value } = compensationSchema.validate(req.body);
    if (error) {
      throw new AppError(error.details[0].message, 400, 'VALIDATION_ERROR');
    }

    const compensation = await Compensation.findByPk(req.params.id);
    if (!compensation) {
      throw new AppError('赔付记录不存在', 404, 'COMPENSATION_NOT_FOUND');
    }

    if (compensation.status === 'paid') {
      throw new AppError('已支付的赔付记录不能修改', 400, 'COMPENSATION_ALREADY_PAID');
    }

    const operatorId = req.headers['x-operator-id'] || 'system';
    const operatorName = req.headers['x-operator-name'] || '系统管理员';
    const oldValues = compensation.toJSON();

    await compensation.update(value);
    await recordUpdate(compensation, operatorId, operatorName, oldValues);

    res.json({
      success: true,
      data: compensation,
      message: '赔付记录更新成功'
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
