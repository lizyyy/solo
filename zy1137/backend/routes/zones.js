const express = require('express');
const { Op, fn, col } = require('sequelize');
const { Zone, Device, ScanRecord, Anomaly } = require('../models');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { sendSuccess, sendPaginated } = require('../utils/response');

const router = express.Router();

router.get('/', asyncHandler(async (req, res) => {
  const { 
    page = 1, 
    pageSize = 50, 
    zone_type,
    status,
    search,
    sort_by = 'zone_name',
    sort_order = 'ASC'
  } = req.query;

  const where = {};

  if (zone_type) {
    where.zone_type = zone_type;
  }

  if (status) {
    where.status = status;
  }

  if (search) {
    where[Op.or] = [
      { zone_name: { [Op.like]: `%${search}%` } },
      { zone_code: { [Op.like]: `%${search}%` } },
      { description: { [Op.like]: `%${search}%` } }
    ];
  }

  const validSortFields = ['zone_name', 'zone_code', 'zone_type', 'created_at'];
  const orderField = validSortFields.includes(sort_by) ? sort_by : 'zone_name';
  const orderDirection = sort_order.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

  const { count, rows } = await Zone.findAndCountAll({
    where,
    order: [[orderField, orderDirection]],
    limit: parseInt(pageSize),
    offset: (parseInt(page) - 1) * parseInt(pageSize)
  });

  return sendPaginated(res, rows, page, pageSize, count, '获取区域列表成功');
}));

router.get('/stats', asyncHandler(async (req, res) => {
  const [zonesWithDevices, deviceStats] = await Promise.all([
    Zone.findAll({
      include: [
        { model: Device, as: 'devices', attributes: ['id'] }
      ]
    }),
    Device.findAll({
      attributes: [
        'zone_id',
        'device_type',
        [fn('count', col('id')), 'count']
      ],
      group: ['zone_id', 'device_type']
    })
  ]);

  const zoneStats = zonesWithDevices.map(zone => ({
    id: zone.id,
    zone_name: zone.zone_name,
    zone_code: zone.zone_code,
    zone_type: zone.zone_type,
    device_count: zone.devices ? zone.devices.length : 0
  }));

  const deviceByZone = {};
  deviceStats.forEach(stat => {
    const zoneId = stat.zone_id;
    if (!zoneId) return;
    
    if (!deviceByZone[zoneId]) {
      deviceByZone[zoneId] = {};
    }
    deviceByZone[zoneId][stat.device_type] = parseInt(stat.dataValues.count);
  });

  return sendSuccess(res, {
    zoneStats,
    deviceByZoneType: deviceByZone
  }, '获取区域统计成功');
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const zone = await Zone.findByPk(id, {
    include: [
      { model: Device, as: 'devices' }
    ]
  });

  if (!zone) {
    throw new AppError('区域不存在', 404, 'ZONE_NOT_FOUND');
  }

  return sendSuccess(res, zone, '获取区域详情成功');
}));

router.get('/:id/heatmap', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { start_time, end_time, hours = 24 } = req.query;

  const zone = await Zone.findByPk(id);
  if (!zone) {
    throw new AppError('区域不存在', 404, 'ZONE_NOT_FOUND');
  }

  let startTime, endTime;
  if (start_time && end_time) {
    startTime = new Date(start_time);
    endTime = new Date(end_time);
  } else {
    endTime = new Date();
    startTime = new Date(endTime.getTime() - parseInt(hours) * 60 * 60 * 1000);
  }

  const devices = await Device.findAll({
    where: { zone_id: id }
  });

  const deviceMacs = devices.map(d => d.mac_address);

  const scanRecords = await ScanRecord.findAll({
    where: {
      mac_address: { [Op.in]: deviceMacs },
      scan_timestamp: { [Op.between]: [startTime, endTime] }
    },
    order: [['scan_timestamp', 'ASC']]
  });

  const anomalies = await Anomaly.findAll({
    where: {
      zone_id: id,
      status: { [Op.in]: ['open', 'acknowledged', 'investigating'] }
    }
  });

  const signalData = {};
  deviceMacs.forEach(mac => {
    signalData[mac] = {
      rssiValues: [],
      avgRSSI: null,
      minRSSI: null,
      maxRSSI: null,
      fluctuation: null
    };
  });

  scanRecords.forEach(record => {
    const mac = record.mac_address;
    if (signalData[mac]) {
      signalData[mac].rssiValues.push({
        timestamp: record.scan_timestamp,
        rssi: record.rssi,
        source: record.scan_source
      });
    }
  });

  Object.keys(signalData).forEach(mac => {
    const data = signalData[mac];
    if (data.rssiValues.length > 0) {
      const values = data.rssiValues.map(r => r.rssi);
      data.avgRSSI = values.reduce((a, b) => a + b, 0) / values.length;
      data.minRSSI = Math.min(...values);
      data.maxRSSI = Math.max(...values);
      data.fluctuation = data.maxRSSI - data.minRSSI;
    }
  });

  const heatmapGrid = this.generateHeatmapGrid(signalData, zone);

  return sendSuccess(res, {
    zone: {
      id: zone.id,
      name: zone.zone_name,
      code: zone.zone_code,
      rssiThreshold: zone.rssi_threshold
    },
    timeRange: { start: startTime, end: endTime },
    devices: devices.map(d => ({
      id: d.id,
      macAddress: d.mac_address,
      deviceName: d.device_name,
      deviceType: d.device_type,
      batteryLevel: d.battery_level,
      signalStats: signalData[d.mac_address]
    })),
    anomalies: anomalies.map(a => ({
      id: a.id,
      type: a.anomaly_type,
      severity: a.severity,
      status: a.status,
      title: a.title,
      riskScore: a.risk_score
    })),
    heatmapGrid
  }, '获取区域信号热力图数据成功');
}));

router.get('/:id/devices', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { 
    page = 1, 
    pageSize = 20,
    device_type,
    status,
    has_risk_tags
  } = req.query;

  const zone = await Zone.findByPk(id);
  if (!zone) {
    throw new AppError('区域不存在', 404, 'ZONE_NOT_FOUND');
  }

  const where = { zone_id: id };

  if (device_type) {
    where.device_type = device_type;
  }

  if (status) {
    where.status = status;
  }

  if (has_risk_tags === 'true') {
    where[Op.and] = sequelize.where(
      sequelize.fn('json_array_length', sequelize.col('risk_tags')),
      Op.gt,
      0
    );
  }

  const { count, rows } = await Device.findAndCountAll({
    where,
    order: [['last_seen', 'DESC']],
    limit: parseInt(pageSize),
    offset: (parseInt(page) - 1) * parseInt(pageSize)
  });

  return sendPaginated(res, rows, page, pageSize, count, '获取区域设备列表成功');
}));

router.post('/', asyncHandler(async (req, res) => {
  const {
    zone_name,
    zone_code,
    zone_type,
    description,
    location,
    expected_device_types,
    allowed_device_types,
    forbidden_device_types,
    rssi_threshold,
    expected_scan_frequency_minutes,
    max_allowed_disconnect_minutes
  } = req.body;

  if (!zone_name || !zone_code) {
    throw new AppError('请提供区域名称和代码', 400, 'MISSING_REQUIRED_FIELDS');
  }

  const existingZone = await Zone.findOne({ where: { zone_code } });
  if (existingZone) {
    throw new AppError('区域代码已存在', 409, 'DUPLICATE_ZONE_CODE');
  }

  const zone = await Zone.create({
    zone_name,
    zone_code,
    zone_type: zone_type || 'other',
    description,
    location: location || {},
    expected_device_types: expected_device_types || [],
    allowed_device_types: allowed_device_types || [],
    forbidden_device_types: forbidden_device_types || [],
    rssi_threshold: rssi_threshold || -70,
    expected_scan_frequency_minutes: expected_scan_frequency_minutes || 30,
    max_allowed_disconnect_minutes: max_allowed_disconnect_minutes || 120
  });

  return sendSuccess(res, zone, '创建区域成功');
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const zone = await Zone.findByPk(id);
  if (!zone) {
    throw new AppError('区域不存在', 404, 'ZONE_NOT_FOUND');
  }

  const {
    zone_name,
    zone_code,
    zone_type,
    description,
    location,
    expected_device_types,
    allowed_device_types,
    forbidden_device_types,
    rssi_threshold,
    expected_scan_frequency_minutes,
    max_allowed_disconnect_minutes,
    status
  } = req.body;

  const updateData = {};
  
  if (zone_name !== undefined) updateData.zone_name = zone_name;
  if (zone_code !== undefined) {
    const existingZone = await Zone.findOne({ 
      where: { zone_code, id: { [Op.ne]: id } } 
    });
    if (existingZone) {
      throw new AppError('区域代码已被其他区域使用', 409, 'DUPLICATE_ZONE_CODE');
    }
    updateData.zone_code = zone_code;
  }
  if (zone_type !== undefined) updateData.zone_type = zone_type;
  if (description !== undefined) updateData.description = description;
  if (location !== undefined) updateData.location = location;
  if (expected_device_types !== undefined) updateData.expected_device_types = expected_device_types;
  if (allowed_device_types !== undefined) updateData.allowed_device_types = allowed_device_types;
  if (forbidden_device_types !== undefined) updateData.forbidden_device_types = forbidden_device_types;
  if (rssi_threshold !== undefined) updateData.rssi_threshold = rssi_threshold;
  if (expected_scan_frequency_minutes !== undefined) updateData.expected_scan_frequency_minutes = expected_scan_frequency_minutes;
  if (max_allowed_disconnect_minutes !== undefined) updateData.max_allowed_disconnect_minutes = max_allowed_disconnect_minutes;
  if (status !== undefined) updateData.status = status;

  await zone.update(updateData);

  return sendSuccess(res, zone, '更新区域成功');
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const zone = await Zone.findByPk(id);
  if (!zone) {
    throw new AppError('区域不存在', 404, 'ZONE_NOT_FOUND');
  }

  const deviceCount = await Device.count({ where: { zone_id: id } });
  if (deviceCount > 0) {
    throw new AppError(`区域内还有 ${deviceCount} 台设备，请先移动或删除这些设备`, 400, 'ZONE_HAS_DEVICES');
  }

  await zone.destroy();

  return sendSuccess(null, '删除区域成功');
}));

function generateHeatmapGrid(signalData, zone) {
  const devices = Object.keys(signalData).filter(mac => signalData[mac].avgRSSI !== null);
  
  if (devices.length === 0) {
    return { cells: [], stats: null };
  }

  const gridSize = Math.ceil(Math.sqrt(devices.length));
  const cells = [];

  devices.forEach((mac, index) => {
    const row = Math.floor(index / gridSize);
    const col = index % gridSize;
    const data = signalData[mac];
    
    let signalLevel = 'excellent';
    if (data.avgRSSI < -90) signalLevel = 'critical';
    else if (data.avgRSSI < -80) signalLevel = 'poor';
    else if (data.avgRSSI < -70) signalLevel = 'fair';
    else if (data.avgRSSI < -60) signalLevel = 'good';

    let fluctuationLevel = 'stable';
    if (data.fluctuation > 40) fluctuationLevel = 'high';
    else if (data.fluctuation > 20) fluctuationLevel = 'medium';

    cells.push({
      row,
      col,
      macAddress: mac,
      avgRSSI: data.avgRSSI,
      minRSSI: data.minRSSI,
      maxRSSI: data.maxRSSI,
      fluctuation: data.fluctuation,
      signalLevel,
      fluctuationLevel,
      sampleCount: data.rssiValues.length
    });
  });

  const allAvgRSSI = cells.map(c => c.avgRSSI);
  const allFluctuations = cells.map(c => c.fluctuation);

  const stats = {
    avgRSSI: allAvgRSSI.reduce((a, b) => a + b, 0) / allAvgRSSI.length,
    minRSSI: Math.min(...allAvgRSSI),
    maxRSSI: Math.max(...allAvgRSSI),
    avgFluctuation: allFluctuations.reduce((a, b) => a + b, 0) / allFluctuations.length,
    gridSize,
    deviceCount: cells.length
  };

  return { cells, stats };
}

const sequelize = require('../config/database');

module.exports = router;
