const storage = require('../../../utils/storage.js');
const dataUtils = require('../../../utils/data.js');

Page({
  data: {
    selectedTab: 'track',
    disposableTypes: [
      { id: 'straw', name: '吸管', icon: '🥤', used: 0, avoided: 0 },
      { id: 'plasticBag', name: '塑料袋', icon: '🛍️', used: 0, avoided: 0 },
      { id: 'chopsticks', name: '一次性筷子', icon: '🥢', used: 0, avoided: 0 },
      { id: 'waterBottle', name: '瓶装水', icon: '💧', used: 0, avoided: 0 },
      { id: 'coffeeCup', name: '一次性咖啡杯', icon: '☕', used: 0, avoided: 0 }
    ],
    habitsStats: null,
    showRecordModal: false,
    currentType: null,
    recordType: 'avoid',
    weeklyGoal: 50,
    todayUsed: 0,
    todayAvoided: 0,
    showTip: true,
    currentTip: ''
  },

  onLoad: function() {
    this.initData();
  },

  onShow: function() {
    this.loadStats();
  },

  initData: function() {
    const tip = dataUtils.getRandomHealingQuote();
    this.setData({
      currentTip: tip
    });
    this.loadStats();
  },

  loadStats: function() {
    const stats = storage.getHabitsStats(30);
    const today = storage.getTodayKey();
    const tracker = wx.getStorageSync('habitsTracker') || {};
    
    const todayData = tracker[today] || {
      straw: { used: 0, avoided: 0 },
      plasticBag: { used: 0, avoided: 0 },
      chopsticks: { used: 0, avoided: 0 },
      waterBottle: { used: 0, avoided: 0 },
      coffeeCup: { used: 0, avoided: 0 }
    };
    
    const updatedTypes = this.data.disposableTypes.map(type => ({
      ...type,
      used: todayData[type.id] ? todayData[type.id].used : 0,
      avoided: todayData[type.id] ? todayData[type.id].avoided : 0
    }));
    
    let todayUsed = 0;
    let todayAvoided = 0;
    for (const type in todayData) {
      todayUsed += todayData[type].used;
      todayAvoided += todayData[type].avoided;
    }
    
    this.setData({
      habitsStats: stats,
      disposableTypes: updatedTypes,
      todayUsed: todayUsed,
      todayAvoided: todayAvoided
    });
  },

  switchTab: function(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({
      selectedTab: tab
    });
  },

  openRecordModal: function(e) {
    const typeId = e.currentTarget.dataset.type;
    const type = this.data.disposableTypes.find(t => t.id === typeId);
    this.setData({
      showRecordModal: true,
      currentType: type,
      recordType: 'avoid'
    });
  },

  closeRecordModal: function() {
    this.setData({
      showRecordModal: false,
      currentType: null
    });
  },

  selectRecordType: function(e) {
    const type = e.currentTarget.dataset.type;
    this.setData({
      recordType: type
    });
  },

  submitRecord: function() {
    if (!this.data.currentType) return;
    
    const typeId = this.data.currentType.id;
    const used = this.data.recordType === 'used';
    
    storage.recordDisposableUsage(typeId, used);
    
    this.setData({
      showRecordModal: false
    });
    
    this.loadStats();
    
    wx.showToast({
      title: used ? '已记录使用' : '+5积分',
      icon: 'success'
    });
    
    wx.vibrateShort();
  },

  getProgressPercentage: function() {
    if (!this.data.habitsStats) return 0;
    const total = this.data.habitsStats.totalAvoided;
    return Math.min((total / this.data.weeklyGoal) * 100, 100);
  },

  toggleTip: function() {
    this.setData({
      showTip: !this.data.showTip
    });
  },

  refreshTip: function() {
    const tip = dataUtils.getRandomHealingQuote();
    this.setData({
      currentTip: tip
    });
  },

  showAvoidedDetail: function() {
    if (!this.data.habitsStats) return;
    
    const stats = this.data.habitsStats;
    let detail = `近30天统计：\n\n`;
    detail += `累计避免使用：${stats.totalAvoided} 次\n`;
    detail += `累计使用：${stats.totalUsed} 次\n`;
    detail += `减少碳排放：约 ${(stats.totalAvoided * 0.05).toFixed(2)} kg CO₂\n\n`;
    
    detail += `各类别详情：\n`;
    for (const type in stats.byType) {
      const typeData = stats.byType[type];
      const typeName = {
        straw: '吸管',
        plasticBag: '塑料袋',
        chopsticks: '一次性筷子',
        waterBottle: '瓶装水',
        coffeeCup: '一次性咖啡杯'
      }[type] || type;
      detail += `• ${typeName}：避免${typeData.avoided}次，使用${typeData.used}次\n`;
    }
    
    wx.showModal({
      title: '戒掉打卡统计',
      content: detail,
      showCancel: false
    });
  }
});
