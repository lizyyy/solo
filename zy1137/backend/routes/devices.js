const express = require('express');
const { Op } = require('sequelize');
const { Device, ScanRecord, PairingEvent, Zone, Anomaly, HandlingRecord } = require('../models');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { sendSuccess, sendPaginated, sendError } = require('../utils/response');

const router = express.Router();

router.get('/', asyncHandler(async (req, res) => {
  const { 
    page = 1, 
    pageSize = 20, 
    device_type,
    status,
    zone_id,
    has_risk_tags,
    search,
    sort_by = 'last_seen',
    sort_order = 'DESC'
  } = req.query;

  const where = {};

  if (device_type) {
    where.device_type = device_type;
  }

  if (status) {
    where.status = status;
  }

  if (zone_id) {
    where.zone_id = zone_id;
  }

  if (has_risk_tags === 'true') {
    where[Op.and] = sequelize.where(
      sequelize.fn('json_array_length', sequelize.col('risk_tags')),
      Op.gt,
      0
    );
  }

  if (search) {
    where[Op.or] = [
      { mac_address: { [Op.like]: `%${search}%` } },
      { device_name: { [Op.like]: `%${search}%` } },
      { serial_number: { [Op.like]: `%${search}%` } }
    ];
  }

  const validSortFields = ['mac_address', 'device_name', 'device_type', 'status', 'battery_level', 'last_seen', 'first_seen', 'created_at'];
  const orderField = validSortFields.includes(sort_by) ? sort_by : 'last_seen';
  const orderDirection = sort_order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  const { count, rows } = await Device.findAndCountAll({
    where,
    include: [
      { model: Zone, as: 'zone', attributes: ['id', 'zone_name', 'zone_code'] }
    ],
    order: [[orderField, orderDirection]],
    limit: parseInt(pageSize),
    offset: (parseInt(page) - 1) * parseInt(pageSize)
  });

  return sendPaginated(res, rows, page, pageSize, count, '获取设备列表成功');
}));

router.get('/stats', asyncHandler(async (req, res) => {
  const [byType, byStatus, lowBattery, withRiskTags] = await Promise.all([
    Device.findAll({
      attributes: ['device_type', [sequelize.fn('count', sequelize.col('id')), 'count']],
      group: ['device_type']
    }),
    Device.findAll({
      attributes: ['status', [sequelize.fn('count', sequelize.col('id')), 'count']],
      group: ['status']
    }),
    Device.count({ where: { battery_level: { [Op.lt]: 20 } } }),
    Device.count({
      where: sequelize.where(
        sequelize.fn('json_array_length', sequelize.col('risk_tags')),
        Op.gt,
        0
      )
    })
  ]);

  return sendSuccess(res, {
    byType: byType.map(item => ({
      device_type: item.device_type,
      count: parseInt(item.dataValues.count)
    })),
    byStatus: byStatus.map(item => ({
      status: item.status,
      count: parseInt(item.dataValues.count)
    })),
    lowBatteryCount: lowBattery,
    withRiskTagsCount: withRiskTags
  }, '获取设备统计成功');
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const device = await Device.findByPk(id, {
    include: [
      { model: Zone, as: 'zone' },
      { 
        model: ScanRecord, 
        as: 'scanRecords',
        limit: 50,
        order: [['scan_timestamp', 'DESC']]
      },
      {
        model: PairingEvent,
        as: 'pairingEvents',
        limit: 30,
        order: [['event_timestamp', 'DESC']]
      },
      {
        model: Anomaly,
        as: 'anomalies',
        limit: 20,
        order: [['detected_at', 'DESC']]
      },
      {
        model: HandlingRecord,
        as: 'handlingRecords',
        limit: 20,
        order: [['action_time', 'DESC']]
      }
    ]
  });

  if (!device) {
    throw new AppError('设备不存在', 404, 'DEVICE_NOT_FOUND');
  }

  return sendSuccess(res, device, '获取设备详情成功');
}));

router.get('/:id/timeline', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { start_time, end_time, limit = 100 } = req.query;

  const device = await Device.findByPk(id);
  if (!device) {
    throw new AppError('设备不存在', 404, 'DEVICE_NOT_FOUND');
  }

  const where = { mac_address: device.mac_address };
  if (start_time) where.scan_timestamp = { [Op.gte]: new Date(start_time) };
  if (end_time) where.scan_timestamp = { ...where.scan_timestamp, [Op.lte]: new Date(end_time) };

  const [scanRecords, pairingEvents, anomalies] = await Promise.all([
    ScanRecord.findAll({
      where: { mac_address: device.mac_address },
      order: [['scan_timestamp', 'DESC']],
      limit: parseInt(limit)
    }),
    PairingEvent.findAll({
      where: { mac_address: device.mac_address },
      order: [['event_timestamp', 'DESC']],
      limit: parseInt(limit)
    }),
    Anomaly.findAll({
      where: { device_id: device.id },
      order: [['detected_at', 'DESC']],
      limit: parseInt(limit)
    })
  ]);

  const timeline = [];

  scanRecords.forEach(record => {
    timeline.push({
      type: 'scan',
      timestamp: record.scan_timestamp,
      data: {
        rssi: record.rssi,
        tx_power: record.tx_power,
        scan_source: record.scan_source,
        is_connectable: record.is_connectable
      }
    });
  });

  pairingEvents.forEach(event => {
    timeline.push({
      type: 'pairing',
      timestamp: event.event_timestamp,
      data: {
        event_type: event.event_type,
        status: event.status,
        host_device: event.host_device,
        duration_seconds: event.duration_seconds,
        error_code: event.error_code,
        error_message: event.error_message
      }
    });
  });

  anomalies.forEach(anomaly => {
    timeline.push({
      type: 'anomaly',
      timestamp: anomaly.detected_at,
      data: {
        anomaly_id: anomaly.id,
        anomaly_type: anomaly.anomaly_type,
        severity: anomaly.severity,
        status: anomaly.status,
        title: anomaly.title
      }
    });
  });

  timeline.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  return sendSuccess(res, {
    device: {
      id: device.id,
      mac_address: device.mac_address,
      device_name: device.device_name,
      device_type: device.device_type
    },
    timeline: timeline.slice(0, parseInt(limit))
  }, '获取设备时间线成功');
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { 
    device_name, 
    device_type, 
    serial_number, 
    model, 
    manufacturer,
    battery_level,
    zone_id,
    status,
    notes
  } = req.body;

  const device = await Device.findByPk(id);
  if (!device) {
    throw new AppError('设备不存在', 404, 'DEVICE_NOT_FOUND');
  }

  const updateData = {};
  if (device_name !== undefined) updateData.device_name = device_name;
  if (device_type !== undefined) updateData.device_type = device_type;
  if (serial_number !== undefined) updateData.serial_number = serial_number;
  if (model !== undefined) updateData.model = model;
  if (manufacturer !== undefined) updateData.manufacturer = manufacturer;
  if (battery_level !== undefined) updateData.battery_level = battery_level;
  if (zone_id !== undefined) updateData.zone_id = zone_id;
  if (status !== undefined) updateData.status = status;
  if (notes !== undefined) updateData.notes = notes;

  await device.update(updateData);

  return sendSuccess(res, device, '更新设备信息成功');
}));

router.get('/:id/scan-stats', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { hours = 24 } = req.query;

  const device = await Device.findByPk(id);
  if (!device) {
    throw new AppError('设备不存在', 404, 'DEVICE_NOT_FOUND');
  }

  const startTime = new Date(Date.now() - parseInt(hours) * 60 * 60 * 1000);

  const scanRecords = await ScanRecord.findAll({
    where: {
      mac_address: device.mac_address,
      scan_timestamp: { [Op.gte]: startTime }
    },
    order: [['scan_timestamp', 'ASC']]
  });

  if (scanRecords.length === 0) {
    return sendSuccess(res, {
      device: { id: device.id, mac_address: device.mac_address },
      period_hours: parseInt(hours),
      scan_count: 0,
      stats: null
    }, '暂无扫描数据');
  }

  const rssiValues = scanRecords.map(r => r.rssi);
  const minRSSI = Math.min(...rssiValues);
  const maxRSSI = Math.max(...rssiValues);
  const avgRSSI = rssiValues.reduce((a, b) => a + b, 0) / rssiValues.length;
  
  const sumSquares = rssiValues.reduce((sum, val) => sum + Math.pow(val - avgRSSI, 2), 0);
  const stdDev = Math.sqrt(sumSquares / rssiValues.length);

  const bySource = {};
  scanRecords.forEach(r => {
    const source = r.scan_source || 'unknown';
    if (!bySource[source]) bySource[source] = 0;
    bySource[source]++;
  });

  const timeSeries = scanRecords.map(r => ({
    timestamp: r.scan_timestamp,
    rssi: r.rssi,
    source: r.scan_source
  }));

  return sendSuccess(res, {
    device: { id: device.id, mac_address: device.mac_address, device_name: device.device_name },
    period_hours: parseInt(hours),
    scan_count: scanRecords.length,
    stats: {
      min_rssi: minRSSI,
      max_rssi: maxRSSI,
      avg_rssi: parseFloat(avgRSSI.toFixed(2)),
      rssi_std_dev: parseFloat(stdDev.toFixed(2)),
      fluctuation: maxRSSI - minRSSI
    },
    by_source: bySource,
    time_series: timeSeries
  }, '获取扫描统计成功');
}));

const sequelize = require('../config/database');

module.exports = router;
