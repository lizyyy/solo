const Joi = require('joi');
const { Ticket, User } = require('../models');
const { classifyTicket } = require('../services/classificationService');
const { logTicketCreate, logTicketUpdate, logTicketClassify, logTicketReview } = require('../services/auditService');
const { maskSensitiveFields } = require('../utils/dataMask');
const logger = require('../config/logger');

const ticketSchema = Joi.object({
  ticketNo: Joi.string().required().messages({
    'any.required': '客服单号不能为空'
  }),
  customerName: Joi.string().allow(null, ''),
  customerPhone: Joi.string().allow(null, ''),
  stationId: Joi.string().required().messages({
    'any.required': '换电站ID不能为空'
  }),
  stationName: Joi.string().required().messages({
    'any.required': '换电站名称不能为空'
  }),
  description: Joi.string().required().messages({
    'any.required': '问题描述不能为空'
  }),
  problemType: Joi.string().allow(null),
  status: Joi.string().valid('pending', 'processing', 'resolved', 'closed').default('pending'),
  priority: Joi.string().valid('low', 'medium', 'high', 'urgent').default('medium'),
  source: Joi.string().valid('phone', 'app', 'web', 'import').default('import')
});

const createTicket = async (req, res) => {
  try {
    const { error, value } = ticketSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }

    const existingTicket = await Ticket.findOne({ where: { ticketNo: value.ticketNo } });
    if (existingTicket) {
      return res.status(400).json({
        success: false,
        message: '客服单号已存在'
      });
    }

    if (!value.problemType) {
      const classificationResult = classifyTicket(value.description);
      value.problemType = classificationResult.type;
    }

    const ticket = await Ticket.create({
      ...value,
      operatorId: req.operatorId
    });

    await logTicketCreate(ticket, req.operatorId, req.ipAddress, req.userAgent);

    logger.info('客服单创建成功', {
      ticketId: ticket.id,
      ticketNo: ticket.ticketNo,
      operatorId: req.operatorId
    });

    res.json({
      success: true,
      message: '创建成功',
      data: maskSensitiveFields(ticket)
    });
  } catch (error) {
    logger.error('客服单创建失败', { error: error.message });
    res.status(500).json({
      success: false,
      message: '创建失败',
      error: error.message
    });
  }
};

const getTickets = async (req, res) => {
  try {
    const {
      page = 1,
      pageSize = 20,
      problemType,
      status,
      stationId,
      startDate,
      endDate,
      keyword
    } = req.query;

    const where = {};
    if (problemType) where.problemType = problemType;
    if (status) where.status = status;
    if (stationId) where.stationId = stationId;
    
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const { count, rows } = await Ticket.findAndCountAll({
      where,
      include: [
        { model: User, as: 'operator', attributes: ['id', 'username', 'realName'] },
        { model: User, as: 'reviewer', attributes: ['id', 'username', 'realName'] }
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(pageSize),
      offset: (parseInt(page) - 1) * parseInt(pageSize)
    });

    const maskedData = maskSensitiveFields(rows);

    res.json({
      success: true,
      data: {
        total: count,
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        list: maskedData
      }
    });
  } catch (error) {
    logger.error('查询客服单失败', { error: error.message });
    res.status(500).json({
      success: false,
      message: '查询失败',
      error: error.message
    });
  }
};

const getTicketById = async (req, res) => {
  try {
    const { id } = req.params;
    const ticket = await Ticket.findByPk(id, {
      include: [
        { model: User, as: 'operator', attributes: ['id', 'username', 'realName'] },
        { model: User, as: 'reviewer', attributes: ['id', 'username', 'realName'] }
      ]
    });

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: '客服单不存在'
      });
    }

    res.json({
      success: true,
      data: maskSensitiveFields(ticket)
    });
  } catch (error) {
    logger.error('查询客服单详情失败', { error: error.message });
    res.status(500).json({
      success: false,
      message: '查询失败',
      error: error.message
    });
  }
};

const updateTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const ticket = await Ticket.findByPk(id);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: '客服单不存在'
      });
    }

    const oldTicket = ticket.toJSON();
    const updateData = req.body;

    await ticket.update(updateData);

    await logTicketUpdate(oldTicket, ticket, req.operatorId, req.ipAddress, req.userAgent);

    logger.info('客服单更新成功', {
      ticketId: ticket.id,
      operatorId: req.operatorId
    });

    res.json({
      success: true,
      message: '更新成功',
      data: maskSensitiveFields(ticket)
    });
  } catch (error) {
    logger.error('客服单更新失败', { error: error.message });
    res.status(500).json({
      success: false,
      message: '更新失败',
      error: error.message
    });
  }
};

const classifyTicketById = async (req, res) => {
  try {
    const { id } = req.params;
    const { problemType } = req.body;

    const ticket = await Ticket.findByPk(id);
    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: '客服单不存在'
      });
    }

    const oldType = ticket.problemType;
    let newType = problemType;

    if (!newType) {
      const classificationResult = classifyTicket(ticket.description);
      newType = classificationResult.type;
    }

    await ticket.update({ problemType: newType });

    await logTicketClassify(ticket, oldType, newType, req.operatorId, req.ipAddress, req.userAgent);

    logger.info('客服单分类完成', {
      ticketId: ticket.id,
      oldType,
      newType,
      operatorId: req.operatorId
    });

    res.json({
      success: true,
      message: '分类成功',
      data: maskSensitiveFields(ticket)
    });
  } catch (error) {
    logger.error('客服单分类失败', { error: error.message });
    res.status(500).json({
      success: false,
      message: '分类失败',
      error: error.message
    });
  }
};

const reviewTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const { resolution } = req.body;

    const ticket = await Ticket.findByPk(id);
    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: '客服单不存在'
      });
    }

    await ticket.update({
      reviewerId: req.operatorId,
      resolution,
      status: 'resolved',
      resolvedAt: new Date()
    });

    await logTicketReview(ticket, req.operatorId, req.ipAddress, req.userAgent);

    logger.info('客服单复核完成', {
      ticketId: ticket.id,
      operatorId: req.operatorId
    });

    res.json({
      success: true,
      message: '复核成功',
      data: maskSensitiveFields(ticket)
    });
  } catch (error) {
    logger.error('客服单复核失败', { error: error.message });
    res.status(500).json({
      success: false,
      message: '复核失败',
      error: error.message
    });
  }
};

const getStatistics = async (req, res) => {
  try {
    const total = await Ticket.count();
    const pending = await Ticket.count({ where: { status: 'pending' } });
    const processing = await Ticket.count({ where: { status: 'processing' } });
    const resolved = await Ticket.count({ where: { status: 'resolved' } });

    const problemTypeStats = await Ticket.findAll({
      attributes: ['problemType', [Ticket.sequelize.fn('COUNT', Ticket.sequelize.col('id')), 'count']],
      group: ['problemType']
    });

    res.json({
      success: true,
      data: {
        total,
        byStatus: { pending, processing, resolved },
        byProblemType: problemTypeStats
      }
    });
  } catch (error) {
    logger.error('获取统计数据失败', { error: error.message });
    res.status(500).json({
      success: false,
      message: '获取统计数据失败',
      error: error.message
    });
  }
};

module.exports = {
  createTicket,
  getTickets,
  getTicketById,
  updateTicket,
  classifyTicketById,
  reviewTicket,
  getStatistics
};
