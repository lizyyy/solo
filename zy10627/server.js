const express = require('express');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const fs = require('fs');
const path = require('path');

const models = require('./models');

const app = express();
const PORT = 3000;

app.use(bodyParser.json());

models.initSeedData();

const getDeviceById = (id) => models.data.devices.find(d => d.id === id);
const getResidentById = (id) => models.data.residents.find(r => r.id === id);
const getOfflinePeriodById = (id) => models.data.offlinePeriods.find(o => o.id === id);
const getRecordById = (id) => models.data.openRecords.find(r => r.id === id);
const getHistoryByRecordId = (recordId) => models.data.operationHistory.filter(h => h.recordId === recordId);

const enrichRecord = (record) => {
  const device = getDeviceById(record.deviceId);
  const resident = getResidentById(record.residentId);
  const offlinePeriod = record.offlinePeriodId ? getOfflinePeriodById(record.offlinePeriodId) : null;
  const operator = record.operator ? getResidentById(record.operator) : null;

  return {
    ...record,
    deviceName: device?.name,
    deviceLocation: device?.location,
    residentName: resident?.name,
    residentRoom: resident?.roomNumber,
    residentPhone: resident?.phone,
    offlinePeriodReason: offlinePeriod?.reason,
    operatorName: operator?.name
  };
};

const checkTimeConflict = (deviceId, openTime, excludeRecordId = null) => {
  const openTimeDate = new Date(openTime);
  const conflictWindow = 120 * 1000;

  return models.data.openRecords.find(r => {
    if (excludeRecordId && r.id === excludeRecordId) return false;
    if (r.deviceId !== deviceId) return false;
    if (r.status === models.STATUS.ARCHIVED) return false;

    const recordTime = new Date(r.openTime);
    const diff = Math.abs(openTimeDate - recordTime);
    return diff <= conflictWindow;
  });
};

app.get('/api/devices', (req, res) => {
  res.json({ success: true, data: models.data.devices });
});

app.get('/api/devices/:id', (req, res) => {
  const device = getDeviceById(req.params.id);
  if (!device) {
    return res.status(404).json({ success: false, error: '设备不存在' });
  }
  res.json({ success: true, data: device });
});

app.get('/api/residents', (req, res) => {
  res.json({ success: true, data: models.data.residents });
});

app.get('/api/residents/:id', (req, res) => {
  const resident = getResidentById(req.params.id);
  if (!resident) {
    return res.status(404).json({ success: false, error: '住户不存在' });
  }
  res.json({ success: true, data: resident });
});

app.get('/api/offline-periods', (req, res) => {
  res.json({ success: true, data: models.data.offlinePeriods });
});

app.get('/api/open-records', (req, res) => {
  const { status, deviceId, residentId, startDate, endDate } = req.query;
  
  let records = [...models.data.openRecords];
  
  if (status) {
    records = records.filter(r => r.status === status);
  }
  if (deviceId) {
    records = records.filter(r => r.deviceId === deviceId);
  }
  if (residentId) {
    records = records.filter(r => r.residentId === residentId);
  }
  if (startDate) {
    records = records.filter(r => new Date(r.openTime) >= new Date(startDate));
  }
  if (endDate) {
    records = records.filter(r => new Date(r.openTime) <= new Date(endDate));
  }

  const enriched = records.map(enrichRecord);
  
  res.json({ 
    success: true, 
    data: enriched,
    total: enriched.length
  });
});

app.get('/api/open-records/:id', (req, res) => {
  const record = getRecordById(req.params.id);
  if (!record) {
    return res.status(404).json({ success: false, error: '记录不存在' });
  }
  res.json({ success: true, data: enrichRecord(record) });
});

app.get('/api/open-records/:id/history', (req, res) => {
  const record = getRecordById(req.params.id);
  if (!record) {
    return res.status(404).json({ success: false, error: '记录不存在' });
  }
  const history = getHistoryByRecordId(req.params.id);
  res.json({ success: true, data: history, total: history.length });
});

app.post('/api/open-records', (req, res) => {
  const {
    deviceId,
    residentId,
    openTime,
    credentialType,
    credentialValue,
    operator,
    remark
  } = req.body;

  if (!deviceId || !residentId || !openTime || !credentialType) {
    return res.status(400).json({ 
      success: false, 
      error: '缺少必填字段: deviceId, residentId, openTime, credentialType' 
    });
  }

  if (!getDeviceById(deviceId)) {
    return res.status(400).json({ success: false, error: '设备不存在' });
  }

  if (!getResidentById(residentId)) {
    return res.status(400).json({ success: false, error: '住户不存在' });
  }

  const conflictRecord = checkTimeConflict(deviceId, openTime);
  
  const activeOfflinePeriod = models.data.offlinePeriods.find(
    o => o.deviceId === deviceId && o.status === 'active'
  );

  let status = models.STATUS.ONLINE;
  let syncStatus = 'synced';

  if (credentialType === 'offline_code') {
    status = models.STATUS.OFFLINE_OPEN;
    syncStatus = 'pending';
  }

  if (conflictRecord && credentialType === 'offline_code') {
    status = models.STATUS.CONFLICT;
    syncStatus = 'conflict';
  }

  const record = {
    id: 'rec_' + uuidv4().slice(0, 8),
    deviceId,
    residentId,
    openTime,
    credentialType,
    credentialValue: credentialValue || '',
    status,
    offlinePeriodId: activeOfflinePeriod?.id || null,
    operator: operator || null,
    remark: remark || '',
    syncStatus,
    createdAt: new Date().toISOString()
  };

  if (conflictRecord && credentialType === 'offline_code') {
    record.conflictDetail = {
      type: 'time_overlap',
      onlineRecordId: conflictRecord.id,
      overlapWindow: 120
    };
    record.remark = remark || '检测到冲突：离线补开与正常刷卡时间重叠';
  }

  models.data.openRecords.push(record);

  const operatorResident = operator ? getResidentById(operator) : null;
  models.addHistory(
    record.id,
    'create',
    operator || 'system',
    operatorResident?.name || '系统',
    null,
    status,
    record.remark || '创建开门记录'
  );

  res.status(201).json({ 
    success: true, 
    data: enrichRecord(record),
    hasConflict: !!conflictRecord && credentialType === 'offline_code'
  });
});

app.put('/api/open-records/:id/status', (req, res) => {
  const { status, operator, remark } = req.body;

  if (!status || !operator) {
    return res.status(400).json({ 
      success: false, 
      error: '缺少必填字段: status, operator' 
    });
  }

  if (!Object.values(models.STATUS).includes(status)) {
    return res.status(400).json({ success: false, error: '无效的状态值' });
  }

  const record = getRecordById(req.params.id);
  if (!record) {
    return res.status(404).json({ success: false, error: '记录不存在' });
  }

  if (record.status === models.STATUS.ARCHIVED) {
    return res.status(400).json({ success: false, error: '已归档记录不可修改' });
  }

  const oldStatus = record.status;
  record.status = status;
  
  if (status === models.STATUS.PENDING_REVIEW) {
    record.syncStatus = 'reviewing';
  } else if (status === models.STATUS.ARCHIVED) {
    record.syncStatus = 'archived';
  }

  if (remark) {
    record.remark = remark;
  }

  const operatorResident = getResidentById(operator);
  models.addHistory(
    record.id,
    'status_change',
    operator,
    operatorResident?.name || '未知用户',
    oldStatus,
    status,
    remark || '状态变更'
  );

  res.json({ success: true, data: enrichRecord(record) });
});

app.put('/api/open-records/:id/remark', (req, res) => {
  const { remark, operator } = req.body;

  if (!remark || !operator) {
    return res.status(400).json({ 
      success: false, 
      error: '缺少必填字段: remark, operator' 
    });
  }

  const record = getRecordById(req.params.id);
  if (!record) {
    return res.status(404).json({ success: false, error: '记录不存在' });
  }

  record.remark = remark;

  const operatorResident = getResidentById(operator);
  models.addHistory(
    record.id,
    'remark_update',
    operator,
    operatorResident?.name || '未知用户',
    record.status,
    record.status,
    '更新备注: ' + remark
  );

  res.json({ success: true, data: enrichRecord(record) });
});

app.post('/api/open-records/batch-import', (req, res) => {
  const { records, operator } = req.body;
  
  if (!records || !Array.isArray(records)) {
    return res.status(400).json({ success: false, error: 'records必须是数组' });
  }

  const results = {
    success: [],
    failed: []
  };

  records.forEach((item, index) => {
    try {
      const { deviceId, residentId, openTime, credentialType, credentialValue, remark } = item;

      if (!deviceId || !residentId || !openTime || !credentialType) {
        throw new Error('缺少必填字段');
      }

      if (!getDeviceById(deviceId)) {
        throw new Error('设备不存在: ' + deviceId);
      }

      if (!getResidentById(residentId)) {
        throw new Error('住户不存在: ' + residentId);
      }

      const conflictRecord = checkTimeConflict(deviceId, openTime);
      const activeOfflinePeriod = models.offlinePeriods.find(
        o => o.deviceId === deviceId && o.status === 'active'
      );

      let status = models.STATUS.ONLINE;
      let syncStatus = 'synced';

      if (credentialType === 'offline_code') {
        status = models.STATUS.OFFLINE_OPEN;
        syncStatus = 'pending';
      }

      if (conflictRecord && credentialType === 'offline_code') {
        status = models.STATUS.CONFLICT;
        syncStatus = 'conflict';
      }

      const record = {
        id: 'rec_' + uuidv4().slice(0, 8),
        deviceId,
        residentId,
        openTime,
        credentialType,
        credentialValue: credentialValue || '',
        status,
        offlinePeriodId: activeOfflinePeriod?.id || null,
        operator: operator || null,
        remark: remark || '',
        syncStatus,
        createdAt: new Date().toISOString(),
        importRow: index + 1
      };

      if (conflictRecord && credentialType === 'offline_code') {
        record.conflictDetail = {
          type: 'time_overlap',
          onlineRecordId: conflictRecord.id,
          overlapWindow: 120
        };
      }

      models.data.openRecords.push(record);

      const operatorResident = operator ? getResidentById(operator) : null;
      models.addHistory(
        record.id,
        'import',
        operator || 'system',
        operatorResident?.name || '系统',
        null,
        status,
        '批量导入 - 行' + (index + 1)
      );

      results.success.push({
        row: index + 1,
        recordId: record.id,
        status
      });
    } catch (error) {
      results.failed.push({
        row: index + 1,
        data: item,
        error: error.message
      });
    }
  });

  res.json({
    success: true,
    data: results,
    summary: {
      total: records.length,
      success: results.success.length,
      failed: results.failed.length
    }
  });
});

app.get('/api/open-records/export/csv', (req, res) => {
  const { status, deviceId, startDate, endDate } = req.query;
  
  let records = [...models.data.openRecords];
  
  if (status) {
    records = records.filter(r => r.status === status);
  }
  if (deviceId) {
    records = records.filter(r => r.deviceId === deviceId);
  }
  if (startDate) {
    records = records.filter(r => new Date(r.openTime) >= new Date(startDate));
  }
  if (endDate) {
    records = records.filter(r => new Date(r.openTime) <= new Date(endDate));
  }

  const exportDir = path.join(__dirname, 'exports');
  if (!fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir, { recursive: true });
  }

  const filename = `access_records_${new Date().toISOString().slice(0, 10)}_${Date.now()}.csv`;
  const filepath = path.join(exportDir, filename);

  const csvWriter = createCsvWriter({
    path: filepath,
    header: [
      { id: 'id', title: '记录ID' },
      { id: 'deviceId', title: '设备ID' },
      { id: 'deviceName', title: '设备名称' },
      { id: 'deviceLocation', title: '设备位置' },
      { id: 'residentId', title: '住户ID' },
      { id: 'residentName', title: '住户姓名' },
      { id: 'residentRoom', title: '房间号' },
      { id: 'residentPhone', title: '联系电话' },
      { id: 'openTime', title: '开门时间' },
      { id: 'credentialType', title: '凭证类型' },
      { id: 'credentialValue', title: '凭证值' },
      { id: 'status', title: '状态' },
      { id: 'statusText', title: '状态说明' },
      { id: 'offlinePeriodId', title: '离线时段ID' },
      { id: 'offlinePeriodReason', title: '离线原因' },
      { id: 'operatorName', title: '操作人' },
      { id: 'remark', title: '备注' },
      { id: 'syncStatus', title: '同步状态' },
      { id: 'createdAt', title: '创建时间' }
    ]
  });

  const statusMap = {
    [models.STATUS.ONLINE]: '在线开门',
    [models.STATUS.OFFLINE_OPEN]: '离线补开',
    [models.STATUS.PENDING_REVIEW]: '待复核',
    [models.STATUS.ARCHIVED]: '已归档',
    [models.STATUS.CONFLICT]: '冲突'
  };

  const recordsForCsv = records.map(r => {
    const enriched = enrichRecord(r);
    return {
      ...enriched,
      statusText: statusMap[r.status] || r.status
    };
  });

  csvWriter.writeRecords(recordsForCsv).then(() => {
    res.json({
      success: true,
      data: {
        filename,
        filepath,
        recordCount: records.length,
        downloadUrl: `/exports/${filename}`
      }
    });
  }).catch(err => {
    res.status(500).json({ success: false, error: err.message });
  });
});

app.use('/exports', express.static(path.join(__dirname, 'exports')));

app.get('/api/health', (req, res) => {
  res.json({ 
    success: true, 
    timestamp: new Date().toISOString(),
    stats: {
      devices: models.data.devices.length,
      residents: models.data.residents.length,
      offlinePeriods: models.data.offlinePeriods.length,
      openRecords: models.data.openRecords.length,
      operationHistory: models.data.operationHistory.length
    }
  });
});

app.listen(PORT, () => {
  console.log(`物业IoT平台门禁离线补开记录 API 已启动`);
  console.log(`服务地址: http://localhost:${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/api/health`);
});