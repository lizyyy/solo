const { v4: uuidv4 } = require('uuid');

class DataStore {
  constructor() {
    this.activities = new Map();
    this.gifts = new Map();
    this.inventory = new Map();
    this.userQualifications = new Map();
    this.lockRecords = new Map();
    this.orderGiftRelations = new Map();
    this.releaseLogs = [];
    this.manualCorrections = [];
    this.manualCorrectionsLog = [];

    this.initializeDefaultData('default');
  }

  initializeDefaultData(id) {
    this.activities.set(id, {
      activityId: id,
      name: '618大促满赠活动',
      startTime: new Date().toISOString(),
      endTime: new Date(Date.now() + 86400000).toISOString(),
      status: 'ACTIVE',
      rules: {
        minOrderAmount: 500,
        maxGiftsPerUser: 1,
        requiredUserLevel: 'VIP'
      }
    });

    const giftId = 'GIFT001';
    this.gifts.set(giftId, {
      giftId,
      activityId: id,
      sku: 'SKU-GIFT-001',
      name: '限定赠品A',
      description: '满500元赠送'
    });

    this.inventory.set(giftId, {
      giftId,
      activityId: id,
      available: 100,
      locked: 0,
      total: 100
    });

    this.userQualifications.set('USER001', {
      userId: 'USER001',
      activityId: id,
      userLevel: 'VIP',
      totalOrders: 15,
      hasReceivedGift: false,
      orderHistory: [
        { orderId: 'ORDER001', amount: 600, date: new Date(Date.now() - 86400000).toISOString() }
      ]
    });

    this.userQualifications.set('USER002', {
      userId: 'USER002',
      activityId: id,
      userLevel: 'NORMAL',
      totalOrders: 3,
      hasReceivedGift: false,
      orderHistory: []
    });
  }

  reset() {
    this.lockRecords.clear();
    this.orderGiftRelations.clear();
    this.releaseLogs = [];
    this.manualCorrections = [];
    this.manualCorrectionsLog = [];
    if (this.inventory.get('GIFT001')) {
      this.inventory.get('GIFT001').locked = 0;
      this.inventory.get('GIFT001').available = 100;
    }
    this.userQualifications.forEach((qual) => {
      qual.hasReceivedGift = false;
    });
  }
}

const dataStore = new DataStore();

module.exports = dataStore;
