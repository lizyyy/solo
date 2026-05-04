const express = require('express');
const { Op } = require('sequelize');
const { Anomaly, Device, Zone, HandlingRecord } = require('../models');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { sendSuccess, sendPaginated } = require('../utils/response');

const router = express.Router();

router.get('/', asyncHandler(async (req, res) => {
  const { 
    page = 1, 
    pageSize = 20, 
    anomaly_type,
    severity,
    status,
    device_id,
    zone_id,
    assigned_to,
    risk_score_min,
    risk_score_max,
    sort_by = 'detected_at',
    sort_order = 'DESC'
  } = req.query;

  const where = {};

  if (anomaly_type) {
    where.anomaly_type = anomaly_type;
  }

  if (severity) {
    where.severity = severity;
  }

  if (status) {
    where.status = status;
  }

  if (device_id) {
    where.device_id = device_id;
  }

  if (zone_id) {
    where.zone_id = zone_id;
  }

  if (assigned_to) {
    where.assigned_to = assigned_to;
  }

  if (risk_score_min !== undefined || risk_score_max !== undefined) {
    where.risk_score = {};
    if (risk_score_min !== undefined) {
      where.risk_score[Op.gte] = parseInt(risk_score_min);
    }
    if (risk_score_max !== undefined) {
      where.risk_score[Op.lte] = parseInt(risk_score_max);
    }
  }

  const validSortFields = ['detected_at', 'risk_score', 'severity', 'status', 'anomaly_type'];
  const orderField = validSortFields.includes(sort_by) ? sort_by : 'detected_at';
  const orderDirection = sort_order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  const order = [];
  if (orderField === 'severity') {
    order.push([
      sequelize.literal(`CASE severity 
        WHEN 'critical' THEN 1 
        WHEN 'high' THEN 2 
        WHEN 'medium' THEN 3 
        WHEN 'low' THEN 4 
        ELSE 5 END`),
      orderDirection
    ]);
  } else {
    order.push([orderField, orderDirection]);
  }

  const { count, rows } = await Anomaly.findAndCountAll({
    where,
    include: [
      { model: Device, as: 'device', attributes: ['id', 'mac_address', 'device_name', 'device_type'] },
      { model: Zone, as: 'zone', attributes: ['id', 'zone_name', 'zone_code'] }
    ],
    order,
    limit: parseInt(pageSize),
    offset: (parseInt(page) - 1) * parseInt(pageSize)
  });

  return sendPaginated(res, rows, page, pageSize, count, '获取异常列表成功');
}));

router.get('/stats', asyncHandler(async (req, res) => {
  const [byType, bySeverity, byStatus, pending] = await Promise.all([
    Anomaly.findAll({
      attributes: ['anomaly_type', [sequelize.fn('count', sequelize.col('id')), 'count']],
      group: ['anomaly_type']
    }),
    Anomaly.findAll({
      attributes: ['severity', [sequelize.fn('count', sequelize.col('id')), 'count']],
      where: {
        status: { [Op.in]: ['open', 'acknowledged', 'investigating'] }
      },
      group: ['severity']
    }),
    Anomaly.findAll({
      attributes: ['status', [sequelize.fn('count', sequelize.col('id')), 'count']],
      group: ['status']
    }),
    Anomaly.count({
      where: {
        status: { [Op.in]: ['open', 'acknowledged', 'investigating'] }
      }
    })
  ]);

  const avgRiskScore = await Anomaly.findOne({
    attributes: [[sequelize.fn('avg', sequelize.col('risk_score')), 'avg_risk']],
    where: {
      status: { [Op.in]: ['open', 'acknowledged', 'investigating'] }
    }
  });

  return sendSuccess(res, {
    byType: byType.map(item => ({
      anomaly_type: item.anomaly_type,
      count: parseInt(item.dataValues.count)
    })),
    bySeverity: bySeverity.map(item => ({
      severity: item.severity,
      count: parseInt(item.dataValues.count)
    })),
    byStatus: byStatus.map(item => ({
      status: item.status,
      count: parseInt(item.dataValues.count)
    })),
    pendingCount: pending,
    avgRiskScore: avgRiskScore?.dataValues?.avg_risk ? parseFloat(avgRiskScore.dataValues.avg_risk).toFixed(2) : null
  }, '获取异常统计成功');
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const anomaly = await Anomaly.findByPk(id, {
    include: [
      { model: Device, as: 'device' },
      { model: Zone, as: 'zone' },
      { 
        model: HandlingRecord, 
        as: 'handlingRecords',
        order: [['action_time', 'DESC']]
      }
    ]
  });

  if (!anomaly) {
    throw new AppError('异常记录不存在', 404, 'ANOMALY_NOT_FOUND');
  }

  return sendSuccess(res, anomaly, '获取异常详情成功');
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { 
    status, 
    assigned_to, 
    notes,
    risk_score
  } = req.body;

  const anomaly = await Anomaly.findByPk(id);
  if (!anomaly) {
    throw new AppError('异常记录不存在', 404, 'ANOMALY_NOT_FOUND');
  }

  const updateData = {
    last_updated_at: new Date()
  };

  const previousStatus = anomaly.status;

  if (status !== undefined) {
    updateData.status = status;
  }

  if (assigned_to !== undefined) {
    updateData.assigned_to = assigned_to;
  }

  if (notes !== undefined) {
    updateData.notes = notes;
  }

  if (risk_score !== undefined) {
    updateData.risk_score = risk_score;
  }

  await anomaly.update(updateData);

  if (req.body.handler || (status !== undefined && status !== previousStatus)) {
    const actionType = getActionTypeFromStatus(status, previousStatus);
    await HandlingRecord.create({
      anomaly_id: anomaly.id,
      device_id: anomaly.device_id,
      action_type: actionType,
      action_time: new Date(),
      handler: req.body.handler || 'system',
      details: req.body.action_details || `状态变更: ${previousStatus} -> ${status}`,
      previous_status: previousStatus,
      new_status: status
    });
  }

  return sendSuccess(res, anomaly, '更新异常记录成功');
}));

router.post('/:id/handle', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { 
    action_type,
    handler,
    details,
    result,
    new_status,
    assigned_to
  } = req.body;

  if (!action_type) {
    throw new AppError('请指定操作类型', 400, 'MISSING_ACTION_TYPE');
  }

  if (!handler) {
    throw new AppError('请指定处理人', 400, 'MISSING_HANDLER');
  }

  const anomaly = await Anomaly.findByPk(id);
  if (!anomaly) {
    throw new AppError('异常记录不存在', 404, 'ANOMALY_NOT_FOUND');
  }

  const previousStatus = anomaly.status;

  const handlingRecord = await HandlingRecord.create({
    anomaly_id: anomaly.id,
    device_id: anomaly.device_id,
    action_type: action_type,
    action_time: new Date(),
    handler: handler,
    details: details,
    result: result || 'success',
    previous_status: previousStatus,
    new_status: new_status
  });

  const updateData = {
    last_updated_at: new Date()
  };

  if (new_status) {
    updateData.status = new_status;
  }

  if (assigned_to !== undefined) {
    updateData.assigned_to = assigned_to;
  }

  if (Object.keys(updateData).length > 0) {
    await anomaly.update(updateData);
  }

  await anomaly.reload({
    include: [
      { model: Device, as: 'device' },
      { 
        model: HandlingRecord, 
        as: 'handlingRecords',
        order: [['action_time', 'DESC']],
        limit: 10
      }
    ]
  });

  return sendSuccess(res, {
    anomaly,
    handlingRecord
  }, '添加处理记录成功');
}));

function getActionTypeFromStatus(newStatus, oldStatus) {
  const statusMap = {
    'acknowledged': 'acknowledge',
    'investigating': 'investigate',
    'resolved': 'resolve',
    'false_positive': 'mark_false_positive'
  };
  return statusMap[newStatus] || 'comment';
}

const sequelize = require('../config/database');

module.exports = router;
