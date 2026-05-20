const { v4: uuidv4 } = require('uuid');
const store = require('../store/memoryStore');

const getSyncStatus = (req, res) => {
  const { userId } = req.params;
  const user = store.getUser(userId);
  
  if (!user) {
    return res.status(404).json({
      success: false,
      message: '用户不存在'
    });
  }

  const events = store.getEventsByUserId(userId);
  const deviceSyncStatus = calculateDeviceSyncStatus(user, events);
  const diffSnapshot = generateDiffSnapshot(user, deviceSyncStatus);

  res.json({
    success: true,
    data: {
      deviceSyncStatus,
      diffSnapshot,
      compensationAvailable: deviceSyncStatus.some(d => d.syncStatus === 'delayed')
    }
  });
};

const calculateDeviceSyncStatus = (user, events) => {
  const lastEvent = events[0];
  
  return user.devices.map(device => {
    const isDelayed = store.isDeviceDelayed(user.id, device.id);
    const delayedInfo = isDelayed ? store.getDelayedDevices(user.id).find(d => d.deviceId === device.id) : null;
    
    return {
      deviceId: device.id,
      deviceName: device.name,
      deviceType: device.type,
      syncStatus: isDelayed ? 'delayed' : 'synced',
      lastSync: device.lastSync,
      lastEventApplied: !isDelayed ? lastEvent?.id : delayedInfo?.causingEventId || null,
      syncLagSeconds: isDelayed ? Math.floor((Date.now() - new Date(delayedInfo?.delayedSince || device.lastSync).getTime()) / 1000) : 0,
      delayedSince: delayedInfo?.delayedSince || null,
      causingEventId: delayedInfo?.causingEventId || null
    };
  });
};

const generateDiffSnapshot = (user, deviceSyncStatus) => {
  const delayedDevices = deviceSyncStatus.filter(d => d.syncStatus === 'delayed');
  
  if (delayedDevices.length === 0) {
    return { hasDiff: false, summary: '所有设备权益一致' };
  }

  const expectedState = {
    plan: user.currentPlan,
    benefits: [...user.currentBenefits],
    validUntil: user.validUntil
  };

  const delayedState = calculateDelayedState(user, delayedDevices);

  return {
    hasDiff: true,
    summary: `${delayedDevices.length} 个设备存在权益差异`,
    expectedState,
    delayedState,
    affectedDevices: delayedDevices.map(d => ({
      deviceId: d.deviceId,
      deviceName: d.deviceName,
      deviceType: d.deviceType,
      delayedSince: d.delayedSince,
      causingEventId: d.causingEventId
    })),
    missingBenefits: expectedState.benefits.filter(b => !delayedState.benefits.includes(b))
  };
};

const calculateDelayedState = (user, delayedDevices) => {
  const events = store.getEventsByUserId(user.id);
  
  if (events.length <= 1) {
    return {
      plan: 'free',
      benefits: []
    };
  }

  const causingEventId = delayedDevices[0]?.causingEventId;
  const eventIndex = events.findIndex(e => e.id === causingEventId);
  
  if (eventIndex === -1 || eventIndex === events.length - 1) {
    return {
      plan: 'free',
      benefits: []
    };
  }

  const previousEvent = events[eventIndex + 1];
  
  if (previousEvent.type === 'expiration') {
    return { plan: 'free', benefits: [] };
  }
  
  if (previousEvent.type === 'compensation') {
    return { 
      plan: user.currentPlan, 
      benefits: user.currentBenefits.filter(b => !previousEvent.data.benefits.includes(b))
    };
  }

  if (previousEvent.data && previousEvent.data.plan) {
    return {
      plan: previousEvent.data.plan,
      benefits: store.getBenefitsForPlan(previousEvent.data.plan)
    };
  }

  return {
    plan: 'basic',
    benefits: ['basic_content']
  };
};

const triggerCompensation = (req, res) => {
  const { userId, deviceId } = req.body;
  
  const user = store.getUser(userId);
  if (!user) {
    return res.status(404).json({
      success: false,
      message: '用户不存在'
    });
  }

  const compensatedDevices = [];
  const now = new Date().toISOString();
  
  const delayedDevicesBefore = store.getDelayedDevices(userId);
  let compensatingForEvent = null;

  if (deviceId) {
    const deviceIndex = user.devices.findIndex(d => d.id === deviceId);
    if (deviceIndex !== -1) {
      user.devices[deviceIndex].lastSync = now;
      const delayedInfo = delayedDevicesBefore.find(d => d.deviceId === deviceId);
      compensatingForEvent = delayedInfo?.causingEventId || null;
      store.clearDeviceDelay(userId, deviceId);
      compensatedDevices.push(deviceId);
    }
  } else {
    if (delayedDevicesBefore.length > 0) {
      compensatingForEvent = delayedDevicesBefore[0].causingEventId;
    }
    user.devices.forEach(device => {
      device.lastSync = now;
      compensatedDevices.push(device.id);
    });
    store.clearAllDeviceDelays(userId);
  }

  store.updateUser(userId, user);

  const compensationEvent = {
    id: `evt-compensation-${uuidv4().substring(0, 8)}`,
    userId,
    type: 'compensation',
    timestamp: now,
    data: {
      compensatedDevices,
      reason: '人工同步补偿',
      compensatingForEvent
    },
    description: deviceId ? 
      `单设备补偿 - ${user.devices.find(d => d.id === deviceId)?.name || deviceId}` : 
      '全设备同步补偿'
  };

  if (!store.isEventProcessed(compensationEvent.id)) {
    store.markEventProcessed(compensationEvent.id);
    store.addEvent(compensationEvent);
  }

  res.json({
    success: true,
    message: deviceId ? '单设备补偿成功' : '全设备补偿成功',
    compensatedDevices,
    eventId: compensationEvent.id,
    timestamp: now
  });
};

module.exports = { getSyncStatus, triggerCompensation };
