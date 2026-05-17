const { v4: uuidv4 } = require('uuid');

const STATUS = {
  ONLINE: 'online',
  OFFLINE_OPEN: 'offline_open',
  PENDING_REVIEW: 'pending_review',
  ARCHIVED: 'archived',
  CONFLICT: 'conflict'
};

const data = {
  devices: [],
  residents: [],
  offlinePeriods: [],
  openRecords: [],
  operationHistory: []
};

const initSeedData = () => {
  data.devices = [
    {
      id: 'dev_001',
      name: '1号楼单元门门禁',
      location: '1号楼1单元入口',
      macAddress: 'AA:BB:CC:DD:EE:01',
      ipAddress: '192.168.1.101',
      status: 'online',
      lastHeartbeat: '2026-05-18T08:30:00.000Z',
      firmwareVersion: 'v2.3.1'
    },
    {
      id: 'dev_002',
      name: '2号楼单元门门禁',
      location: '2号楼1单元入口',
      macAddress: 'AA:BB:CC:DD:EE:02',
      ipAddress: '192.168.1.102',
      status: 'offline',
      lastHeartbeat: '2026-05-17T22:15:00.000Z',
      firmwareVersion: 'v2.3.1'
    },
    {
      id: 'dev_003',
      name: '地下车库入口门禁',
      location: 'B1车库入口',
      macAddress: 'AA:BB:CC:DD:EE:03',
      ipAddress: '192.168.1.103',
      status: 'online',
      lastHeartbeat: '2026-05-18T08:35:00.000Z',
      firmwareVersion: 'v2.3.0'
    }
  ];

  data.residents = [
    {
      id: 'res_001',
      name: '张三',
      phone: '13800138001',
      roomNumber: '1-101',
      cardNumber: 'CARD001001',
      accessLevel: 'resident',
      validFrom: '2026-01-01T00:00:00.000Z',
      validTo: '2027-01-01T00:00:00.000Z'
    },
    {
      id: 'res_002',
      name: '李四',
      phone: '13800138002',
      roomNumber: '1-1502',
      cardNumber: 'CARD001002',
      accessLevel: 'resident',
      validFrom: '2026-01-01T00:00:00.000Z',
      validTo: '2027-01-01T00:00:00.000Z'
    },
    {
      id: 'res_003',
      name: '王五',
      phone: '13800138003',
      roomNumber: '2-301',
      cardNumber: 'CARD002001',
      accessLevel: 'resident',
      validFrom: '2026-01-01T00:00:00.000Z',
      validTo: '2026-12-31T00:00:00.000Z'
    },
    {
      id: 'res_004',
      name: '物业管理员',
      phone: '13800138000',
      roomNumber: '物业中心',
      cardNumber: 'ADMIN001',
      accessLevel: 'admin',
      validFrom: '2026-01-01T00:00:00.000Z',
      validTo: '2027-01-01T00:00:00.000Z'
    }
  ];

  data.offlinePeriods = [
    {
      id: 'off_001',
      deviceId: 'dev_002',
      startTime: '2026-05-17T22:15:00.000Z',
      endTime: null,
      reason: '网络交换机故障',
      reportedBy: 'system',
      status: 'active'
    },
    {
      id: 'off_002',
      deviceId: 'dev_002',
      startTime: '2026-05-16T14:30:00.000Z',
      endTime: '2026-05-16T16:45:00.000Z',
      reason: '设备固件升级',
      reportedBy: 'admin',
      status: 'resolved'
    }
  ];

  data.openRecords = [
    {
      id: 'rec_001',
      deviceId: 'dev_002',
      residentId: 'res_003',
      openTime: '2026-05-18T07:30:00.000Z',
      credentialType: 'card',
      credentialValue: 'CARD002001',
      status: STATUS.ONLINE,
      offlinePeriodId: null,
      operator: null,
      remark: '正常刷卡开门',
      syncStatus: 'synced',
      createdAt: '2026-05-18T07:30:02.000Z'
    },
    {
      id: 'rec_002',
      deviceId: 'dev_002',
      residentId: 'res_003',
      openTime: '2026-05-18T07:32:00.000Z',
      credentialType: 'offline_code',
      credentialValue: 'OFF20260518001',
      status: STATUS.OFFLINE_OPEN,
      offlinePeriodId: 'off_001',
      operator: 'res_004',
      remark: '网络中断，离线补开',
      syncStatus: 'pending',
      createdAt: '2026-05-18T07:32:15.000Z'
    },
    {
      id: 'rec_003',
      deviceId: 'dev_002',
      residentId: 'res_001',
      openTime: '2026-05-18T08:00:00.000Z',
      credentialType: 'offline_code',
      credentialValue: 'OFF20260518002',
      status: STATUS.CONFLICT,
      offlinePeriodId: 'off_001',
      operator: 'res_004',
      remark: '检测到冲突：离线补开与正常刷卡时间重叠',
      syncStatus: 'conflict',
      conflictDetail: {
        type: 'time_overlap',
        onlineRecordId: 'rec_001',
        overlapWindow: 120
      },
      createdAt: '2026-05-18T08:00:30.000Z'
    },
    {
      id: 'rec_004',
      deviceId: 'dev_001',
      residentId: 'res_001',
      openTime: '2026-05-17T18:20:00.000Z',
      credentialType: 'app',
      credentialValue: 'APP001',
      status: STATUS.ARCHIVED,
      offlinePeriodId: null,
      operator: null,
      remark: 'APP开门，已归档',
      syncStatus: 'synced',
      createdAt: '2026-05-17T18:20:05.000Z'
    }
  ];

  data.operationHistory = [
    {
      id: 'hist_001',
      recordId: 'rec_002',
      action: 'create',
      operator: 'res_004',
      operatorName: '物业管理员',
      oldStatus: null,
      newStatus: STATUS.OFFLINE_OPEN,
      remark: '创建离线补开记录',
      timestamp: '2026-05-18T07:32:15.000Z'
    },
    {
      id: 'hist_002',
      recordId: 'rec_003',
      action: 'create',
      operator: 'res_004',
      operatorName: '物业管理员',
      oldStatus: null,
      newStatus: STATUS.CONFLICT,
      remark: '检测到时间冲突，标记为冲突状态',
      timestamp: '2026-05-18T08:00:30.000Z'
    },
    {
      id: 'hist_003',
      recordId: 'rec_004',
      action: 'status_change',
      operator: 'system',
      operatorName: '系统',
      oldStatus: STATUS.ONLINE,
      newStatus: STATUS.ARCHIVED,
      remark: '系统自动归档',
      timestamp: '2026-05-18T00:00:00.000Z'
    }
  ];
};

const addHistory = (recordId, action, operator, operatorName, oldStatus, newStatus, remark) => {
  const history = {
    id: 'hist_' + uuidv4().slice(0, 8),
    recordId,
    action,
    operator,
    operatorName,
    oldStatus,
    newStatus,
    remark,
    timestamp: new Date().toISOString()
  };
  data.operationHistory.push(history);
  return history;
};

module.exports = {
  STATUS,
  data,
  initSeedData,
  addHistory
};