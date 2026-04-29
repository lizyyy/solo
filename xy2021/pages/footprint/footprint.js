const storage = require('../../../utils/storage.js');
const dataUtils = require('../../../utils/data.js');

Page({
  data: {
    carbonFootprint: {
      total: 0,
      transport: 0,
      electricity: 0,
      food: 0,
      disposable: 0
    },
    historyList: [],
    showAddModal: false,
    addType: '',
    addSubtype: '',
    addAmount: '',
    transportTypes: [
      { id: 'taxi', name: '打车', icon: '🚕', unit: '公里' },
      { id: 'privateCar', name: '私家车', icon: '🚗', unit: '公里' },
      { id: 'bus', name: '公交', icon: '🚌', unit: '公里' },
      { id: 'subway', name: '地铁', icon: '🚇', unit: '公里' },
      { id: 'train', name: '火车', icon: '🚄', unit: '公里' },
      { id: 'flight', name: '飞机', icon: '✈️', unit: '公里' },
      { id: 'bike', name: '骑行', icon: '🚲', unit: '公里' },
      { id: 'walk', name: '步行', icon: '🚶', unit: '公里' }
    ],
    foodTypes: [
      { id: 'fastFood', name: '快餐', icon: '🍔', desc: '汉堡、炸鸡等' },
      { id: 'takeout', name: '外卖', icon: '🥡', desc: '外卖订餐' },
      { id: 'homeCook', name: '家常菜', icon: '🍳', desc: '自己做饭' },
      { id: 'vegetarian', name: '素食', icon: '🥗', desc: '纯素食' }
    ],
    disposableTypes: [
      { id: 'straw', name: '吸管', icon: '🥤' },
      { id: 'plasticBag', name: '塑料袋', icon: '🛍️' },
      { id: 'chopsticks', name: '一次性筷子', icon: '🥢' },
      { id: 'waterBottle', name: '瓶装水', icon: '💧' },
      { id: 'coffeeCup', name: '一次性咖啡杯', icon: '☕' }
    ],
    selectedTransportType: null,
    selectedFoodType: null,
    selectedDisposableType: null,
    showResultModal: false,
    resultData: null,
    categoryStats: [],
    weeklyData: [],
    selectedTab: 'overview'
  },

  onLoad: function() {
    this.refreshData();
  },

  onShow: function() {
    this.refreshData();
  },

  refreshData: function() {
    const footprint = storage.getCarbonFootprint();
    const history = storage.getFootprintHistory(30);
    
    this.setData({
      carbonFootprint: footprint,
      historyList: history
    });
    
    this.calculateCategoryStats();
    this.calculateWeeklyData();
  },

  calculateCategoryStats: function() {
    const fp = this.data.carbonFootprint;
    const total = fp.total || 0;
    
    const categories = [
      { id: 'transport', name: '出行', icon: '🚗', value: fp.transport, color: '#2196F3' },
      { id: 'electricity', name: '用电', icon: '⚡', value: fp.electricity, color: '#FF9800' },
      { id: 'food', name: '饮食', icon: '🍽️', value: fp.food, color: '#9C27B0' },
      { id: 'disposable', name: '一次性用品', icon: '🚫', value: fp.disposable, color: '#F44336' }
    ];
    
    const stats = categories.map(cat => ({
      ...cat,
      percentage: total > 0 ? (cat.value / total * 100).toFixed(1) : 0
    })).sort((a, b) => b.value - a.value);
    
    this.setData({
      categoryStats: stats
    });
  },

  calculateWeeklyData: function() {
    const history = this.data.historyList;
    const weeklyData = [];
    const now = new Date();
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = this.formatDate(date);
      
      const dayRecords = history.filter(r => r.date === dateStr);
      const dayTotal = dayRecords.reduce((sum, r) => sum + r.carbonKg, 0);
      
      const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
      
      weeklyData.push({
        date: dateStr,
        dayName: i === 0 ? '今天' : weekDays[date.getDay()],
        total: dayTotal,
        records: dayRecords.length
      });
    }
    
    this.setData({
      weeklyData: weeklyData
    });
  },

  formatDate: function(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  switchTab: function(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({
      selectedTab: tab
    });
  },

  openAddModal: function(e) {
    const type = e.currentTarget.dataset.type;
    this.setData({
      showAddModal: true,
      addType: type,
      addSubtype: '',
      addAmount: '',
      selectedTransportType: null,
      selectedFoodType: null,
      selectedDisposableType: null
    });
  },

  closeAddModal: function() {
    this.setData({
      showAddModal: false
    });
  },

  selectTransportType: function(e) {
    const type = e.currentTarget.dataset.type;
    const selected = this.data.transportTypes.find(t => t.id === type);
    this.setData({
      selectedTransportType: selected,
      addSubtype: type
    });
  },

  selectFoodType: function(e) {
    const type = e.currentTarget.dataset.type;
    const selected = this.data.foodTypes.find(t => t.id === type);
    this.setData({
      selectedFoodType: selected,
      addSubtype: type
    });
  },

  selectDisposableType: function(e) {
    const type = e.currentTarget.dataset.type;
    const selected = this.data.disposableTypes.find(t => t.id === type);
    this.setData({
      selectedDisposableType: selected,
      addSubtype: type
    });
  },

  inputAmount: function(e) {
    const value = e.detail.value;
    this.setData({
      addAmount: value
    });
  },

  submitRecord: function() {
    const { addType, addSubtype, addAmount } = this.data;
    
    if (!addType) {
      wx.showToast({ title: '请选择记录类型', icon: 'none' });
      return;
    }
    
    if (addType === 'transport' && !addSubtype) {
      wx.showToast({ title: '请选择出行方式', icon: 'none' });
      return;
    }
    
    if (addType === 'food' && !addSubtype) {
      wx.showToast({ title: '请选择饮食类型', icon: 'none' });
      return;
    }
    
    if (addType === 'disposable' && !addSubtype) {
      wx.showToast({ title: '请选择一次性用品类型', icon: 'none' });
      return;
    }
    
    if (!addAmount || parseFloat(addAmount) <= 0) {
      wx.showToast({ title: '请输入有效数量', icon: 'none' });
      return;
    }
    
    const amount = parseFloat(addAmount);
    const carbonKg = dataUtils.calculateCarbonFootprint(addType, addSubtype, amount);
    
    let category = addType;
    let subtypeName = '';
    
    if (addType === 'transport') {
      subtypeName = this.data.selectedTransportType.name;
    } else if (addType === 'food') {
      subtypeName = this.data.selectedFoodType.name;
    } else if (addType === 'disposable') {
      subtypeName = this.data.selectedDisposableType.name;
    }
    
    const record = {
      type: addType,
      subtype: addSubtype,
      subtypeName: subtypeName,
      amount: amount,
      carbonKg: carbonKg,
      category: category
    };
    
    storage.addFootprintRecord(record);
    
    this.setData({
      showAddModal: false,
      showResultModal: true,
      resultData: {
        type: addType,
        subtypeName: subtypeName,
        amount: amount,
        carbonKg: carbonKg
      }
    });
    
    this.refreshData();
    
    wx.vibrateShort();
  },

  closeResultModal: function() {
    this.setData({
      showResultModal: false,
      resultData: null
    });
  },

  getTypeName: function(type) {
    const names = {
      transport: '出行',
      electricity: '用电',
      food: '饮食',
      disposable: '一次性用品'
    };
    return names[type] || type;
  },

  getTypeIcon: function(type) {
    const icons = {
      transport: '🚗',
      electricity: '⚡',
      food: '🍽️',
      disposable: '🚫'
    };
    return icons[type] || '📝';
  },

  deleteRecord: function(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条记录吗？',
      success: (res) => {
        if (res.confirm) {
          const history = wx.getStorageSync('footprintHistory') || [];
          const newHistory = history.filter(r => r.id !== id);
          wx.setStorageSync('footprintHistory', newHistory);
          this.refreshData();
          wx.showToast({ title: '已删除', icon: 'success' });
        }
      }
    });
  },

  showCarbonInfo: function() {
    wx.showModal({
      title: '碳排放计算说明',
      content: '出行碳排放：根据不同交通工具类型计算\n\n用电碳排放：每度电约0.785kg CO₂\n\n饮食碳排放：根据不同饮食类型计算\n\n一次性用品：根据不同物品类型计算',
      showCancel: false
    });
  }
});
