const store = require('../store/memoryStore');

const getUsers = (req, res) => {
  const users = store.getAllUsers();
  const usersWithSyncSummary = users.map(user => {
    const syncStatus = calculateSyncStatus(user);
    return {
      ...user,
      syncStatus
    };
  });
  
  res.json({
    success: true,
    data: usersWithSyncSummary
  });
};

const calculateSyncStatus = (user) => {
  const hasDelayedDevice = store.hasAnyDelayedDevice(user.id);
  
  if (!hasDelayedDevice) {
    return { status: 'synced', message: '所有设备已同步' };
  } else {
    return { status: 'delayed', message: '部分设备同步延迟' };
  }
};

const getUserDetail = (req, res) => {
  const { userId } = req.params;
  const user = store.getUser(userId);
  
  if (!user) {
    return res.status(404).json({
      success: false,
      message: '用户不存在'
    });
  }

  const events = store.getEventsByUserId(userId);
  const deviceStatus = getDeviceSyncDetails(user, events);

  res.json({
    success: true,
    data: {
      user,
      events: events.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)),
      deviceStatus
    }
  });
};

const getDeviceSyncDetails = (user, events) => {
  return user.devices.map(device => {
    const isDelayed = store.isDeviceDelayed(user.id, device.id);
    
    const expectedBenefits = [...user.currentBenefits];
    const expectedPlan = user.currentPlan;
    
    let actualBenefits;
    let actualPlan;
    
    if (isDelayed) {
      const delayedDevices = [{ deviceId: device.id, causingEventId: null }];
      const syncController = require('./syncController');
      
      const calculateDelayedState = (user, delayedDevices) => {
        const events = store.getEventsByUserId(user.id);
        
        if (events.length <= 1) {
          return { plan: 'free', benefits: [] };
        }

        const delayedInfo = store.getDelayedDevices(user.id).find(d => d.deviceId === device.id);
        const causingEventId = delayedInfo?.causingEventId;
        const eventIndex = events.findIndex(e => e.id === causingEventId);
        
        if (eventIndex === -1 || eventIndex === events.length - 1) {
          return { plan: 'free', benefits: [] };
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

        return { plan: 'basic', benefits: ['basic_content'] };
      };
      
      const delayedState = calculateDelayedState(user, delayedDevices);
      actualBenefits = delayedState.benefits;
      actualPlan = delayedState.plan;
    } else {
      actualBenefits = [...user.currentBenefits];
      actualPlan = user.currentPlan;
    }

    const missingBenefits = expectedBenefits.filter(b => !actualBenefits.includes(b));
    const planMismatch = expectedPlan !== actualPlan;

    return {
      ...device,
      syncStatus: isDelayed ? 'delayed' : 'synced',
      expected: {
        plan: expectedPlan,
        benefits: expectedBenefits
      },
      actual: {
        plan: actualPlan,
        benefits: actualBenefits
      },
      diff: (missingBenefits.length > 0 || planMismatch) ? {
        missingBenefits,
        planMismatch
      } : null,
      lastSuccessfulSync: device.lastSync
    };
  });
};

module.exports = { getUsers, getUserDetail };
