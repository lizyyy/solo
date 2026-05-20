const { v4: uuidv4 } = require('uuid');

class MemoryStore {
  constructor() {
    this.users = new Map();
    this.events = new Map();
    this.userEvents = new Map();
    this.processedEventIds = new Set();
    this.deviceSyncStatus = new Map();
    this.delayedDevices = new Map();
    this.initSampleData();
  }

  initSampleData() {
    const sampleUsers = [
      {
        id: 'user-001',
        name: '张三',
        email: 'zhangsan@example.com',
        currentPlan: 'premium',
        currentBenefits: ['premium_content', 'ad_free', 'priority_support'],
        validFrom: new Date('2024-01-01').toISOString(),
        validUntil: new Date('2025-01-01').toISOString(),
        devices: [
          { id: 'device-app-001', type: 'app', name: 'iPhone 15', lastSync: new Date('2024-05-10').toISOString() },
          { id: 'device-web-001', type: 'web', name: 'Chrome', lastSync: new Date('2024-05-10').toISOString() },
          { id: 'device-cs-001', type: 'cs', name: '客服后台', lastSync: new Date('2024-05-10').toISOString() }
        ]
      },
      {
        id: 'user-002',
        name: '李四',
        email: 'lisi@example.com',
        currentPlan: 'basic',
        currentBenefits: ['basic_content'],
        validFrom: new Date('2024-03-01').toISOString(),
        validUntil: new Date('2024-06-01').toISOString(),
        devices: [
          { id: 'device-app-002', type: 'app', name: 'Android', lastSync: new Date('2024-04-01').toISOString() },
          { id: 'device-web-002', type: 'web', name: 'Safari', lastSync: new Date('2024-05-10').toISOString() },
          { id: 'device-cs-002', type: 'cs', name: '客服后台', lastSync: new Date('2024-05-10').toISOString() }
        ]
      },
      {
        id: 'user-003',
        name: '王五',
        email: 'wangwu@example.com',
        currentPlan: 'premium',
        currentBenefits: ['premium_content', 'ad_free', 'priority_support'],
        validFrom: new Date('2024-02-15').toISOString(),
        validUntil: new Date('2024-08-15').toISOString(),
        devices: [
          { id: 'device-app-003', type: 'app', name: 'iPad', lastSync: new Date('2024-05-05').toISOString() },
          { id: 'device-web-003', type: 'web', name: 'Firefox', lastSync: new Date('2024-05-10').toISOString() },
          { id: 'device-cs-003', type: 'cs', name: '客服后台', lastSync: new Date('2024-05-10').toISOString() }
        ]
      },
      {
        id: 'user-004',
        name: '赵六',
        email: 'zhaoliu@example.com',
        currentPlan: 'free',
        currentBenefits: [],
        validFrom: null,
        validUntil: null,
        devices: [
          { id: 'device-app-004', type: 'app', name: 'iPhone 14', lastSync: new Date('2024-05-10').toISOString() },
          { id: 'device-web-004', type: 'web', name: 'Edge', lastSync: new Date('2024-05-10').toISOString() },
          { id: 'device-cs-004', type: 'cs', name: '客服后台', lastSync: new Date('2024-05-10').toISOString() }
        ]
      }
    ];

    sampleUsers.forEach(user => {
      this.users.set(user.id, user);
      this.userEvents.set(user.id, []);
      this.deviceSyncStatus.set(user.id, new Map());
    });

    this.addSampleEvents();
  }

  addSampleEvents() {
    const now = new Date();
    
    const events = [
      {
        id: 'evt-renew-001',
        userId: 'user-001',
        type: 'renewal',
        timestamp: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString(),
        data: { plan: 'premium', durationDays: 365 },
        description: '正常续费 - 年度高级会员'
      },
      {
        id: 'evt-delay-001',
        userId: 'user-002',
        type: 'renewal',
        timestamp: new Date(now - 5 * 24 * 60 * 60 * 1000).toISOString(),
        data: { plan: 'premium', durationDays: 90 },
        description: '设备离线延迟 - 升级高级会员',
        delayedDevices: ['device-app-002']
      },
      {
        id: 'evt-compensate-001',
        userId: 'user-003',
        type: 'compensation',
        timestamp: new Date(now - 1 * 24 * 60 * 60 * 1000).toISOString(),
        data: { benefits: ['extended_warranty', 'gift_card'], reason: '服务故障补偿' },
        description: '人工补偿 - 服务故障'
      },
      {
        id: 'evt-expire-001',
        userId: 'user-004',
        type: 'expiration',
        timestamp: new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString(),
        data: { expiredPlan: 'basic' },
        description: '到期收回 - 基础会员过期'
      }
    ];

    events.forEach(event => {
      this.processedEventIds.add(event.id);
      this.events.set(event.id, event);
      const userEventList = this.userEvents.get(event.userId) || [];
      userEventList.push(event);
      this.userEvents.set(event.userId, userEventList);
      
      this.applyEventToUser(event);

      if (event.delayedDevices && event.delayedDevices.length > 0) {
        this.markDevicesDelayed(event.userId, event.delayedDevices, event.id);
      }
    });
  }

  applyEventToUser(event) {
    const user = this.users.get(event.userId);
    if (!user) return;

    switch (event.type) {
      case 'renewal':
      case 'purchase':
        user.currentPlan = event.data.plan;
        user.currentBenefits = this.getBenefitsForPlan(event.data.plan);
        user.validFrom = new Date().toISOString();
        const durationDays = event.data.durationDays || 30;
        user.validUntil = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();
        break;
      
      case 'compensation':
        user.currentBenefits = [...new Set([...user.currentBenefits, ...event.data.benefits])];
        break;
      
      case 'expiration':
        user.currentPlan = 'free';
        user.currentBenefits = [];
        user.validUntil = new Date().toISOString();
        break;
      
      case 'pause':
        user.paused = true;
        user.pausedAt = new Date().toISOString();
        break;
      
      case 'resume':
        user.paused = false;
        user.resumedAt = new Date().toISOString();
        break;
    }

    this.users.set(event.userId, user);
  }

  getBenefitsForPlan(plan) {
    const planBenefits = {
      free: [],
      basic: ['basic_content'],
      premium: ['premium_content', 'ad_free', 'priority_support'],
      enterprise: ['premium_content', 'ad_free', 'priority_support', 'api_access', 'team_management']
    };
    return planBenefits[plan] || [];
  }

  isEventProcessed(eventId) {
    return this.processedEventIds.has(eventId);
  }

  markEventProcessed(eventId) {
    this.processedEventIds.add(eventId);
  }

  addEvent(event) {
    this.events.set(event.id, event);
    const userEventList = this.userEvents.get(event.userId) || [];
    userEventList.push(event);
    this.userEvents.set(event.userId, userEventList);
  }

  getEventsByUserId(userId) {
    return this.userEvents.get(userId) || [];
  }

  getUser(userId) {
    return this.users.get(userId);
  }

  getAllUsers() {
    return Array.from(this.users.values());
  }

  updateUser(userId, updates) {
    const user = this.users.get(userId);
    if (user) {
      Object.assign(user, updates);
      this.users.set(userId, user);
    }
    return user;
  }

  setDeviceSyncStatus(userId, deviceId, status) {
    const userSyncMap = this.deviceSyncStatus.get(userId) || new Map();
    userSyncMap.set(deviceId, status);
    this.deviceSyncStatus.set(userId, userSyncMap);
  }

  getDeviceSyncStatus(userId, deviceId) {
    const userSyncMap = this.deviceSyncStatus.get(userId);
    return userSyncMap ? userSyncMap.get(deviceId) : null;
  }

  getAllDeviceSyncStatus(userId) {
    const userSyncMap = this.deviceSyncStatus.get(userId);
    return userSyncMap ? Object.fromEntries(userSyncMap) : {};
  }

  markDevicesDelayed(userId, deviceIds, causingEventId) {
    const userDelayedMap = this.delayedDevices.get(userId) || new Map();
    deviceIds.forEach(deviceId => {
      userDelayedMap.set(deviceId, {
        deviceId,
        causingEventId,
        delayedSince: new Date().toISOString()
      });
    });
    this.delayedDevices.set(userId, userDelayedMap);
  }

  clearDeviceDelay(userId, deviceId) {
    const userDelayedMap = this.delayedDevices.get(userId);
    if (userDelayedMap) {
      userDelayedMap.delete(deviceId);
      if (userDelayedMap.size === 0) {
        this.delayedDevices.delete(userId);
      }
      return true;
    }
    return false;
  }

  clearAllDeviceDelays(userId) {
    this.delayedDevices.delete(userId);
  }

  isDeviceDelayed(userId, deviceId) {
    const userDelayedMap = this.delayedDevices.get(userId);
    return userDelayedMap ? userDelayedMap.has(deviceId) : false;
  }

  getDelayedDevices(userId) {
    const userDelayedMap = this.delayedDevices.get(userId);
    if (!userDelayedMap) return [];
    return Array.from(userDelayedMap.values());
  }

  hasAnyDelayedDevice(userId) {
    const userDelayedMap = this.delayedDevices.get(userId);
    return userDelayedMap ? userDelayedMap.size > 0 : false;
  }
}

module.exports = new MemoryStore();
