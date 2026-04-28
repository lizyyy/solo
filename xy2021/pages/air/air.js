const dataUtils = require('../../../utils/data.js');

Page({
  data: {
    cityName: '北京',
    airData: null,
    showCityPicker: false,
    cities: ['北京', '上海', '广州', '深圳', '杭州', '成都', '武汉', '西安', '南京', '苏州'],
    pollutants: [
      { key: 'pm25', name: 'PM2.5', unit: 'μg/m³' },
      { key: 'pm10', name: 'PM10', unit: 'μg/m³' },
      { key: 'o3', name: '臭氧O₃', unit: 'μg/m³' },
      { key: 'no2', name: '二氧化氮NO₂', unit: 'μg/m³' },
      { key: 'so2', name: '二氧化硫SO₂', unit: 'μg/m³' },
      { key: 'co', name: '一氧化碳CO', unit: 'mg/m³' }
    ],
    aqiLevelInfo: null,
    airHistory: []
  },

  onLoad: function() {
    this.loadAirData();
  },

  loadAirData: function() {
    const airData = dataUtils.generateMockAirData(this.data.cityName);
    const levelInfo = dataUtils.getAirQualityLevel(airData.aqi);
    
    this.setData({
      airData: airData,
      aqiLevelInfo: levelInfo
    });
    
    this.addToHistory(airData);
  },

  addToHistory: function(airData) {
    const history = this.data.airHistory.slice(0, 6);
    const now = new Date();
    history.unshift({
      time: `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`,
      aqi: airData.aqi,
      level: airData.level
    });
    this.setData({
      airHistory: history
    });
  },

  toggleCityPicker: function() {
    this.setData({
      showCityPicker: !this.data.showCityPicker
    });
  },

  selectCity: function(e) {
    const city = e.currentTarget.dataset.city;
    this.setData({
      cityName: city,
      showCityPicker: false
    });
    this.loadAirData();
  },

  refreshData: function() {
    wx.showLoading({ title: '刷新中...' });
    setTimeout(() => {
      this.loadAirData();
      wx.hideLoading();
      wx.showToast({ title: '已更新', icon: 'success' });
    }, 1000);
  },

  getPollutantLevel: function(key, value) {
    const thresholds = {
      pm25: [0, 35, 75, 115, 150, 250, 500],
      pm10: [0, 50, 150, 250, 350, 420, 500],
      o3: [0, 100, 160, 200, 300, 400, 500],
      no2: [0, 40, 80, 180, 280, 565, 940],
      so2: [0, 50, 150, 475, 800, 1600, 2620],
      co: [0, 5, 10, 35, 60, 90, 150]
    };
    
    const levels = thresholds[key] || [0, 50, 100, 150, 200, 300, 500];
    const colors = ['#4CAF50', '#8BC34A', '#FFEB3B', '#FF9800', '#F44336', '#880E4F'];
    
    for (let i = 0; i < levels.length - 1; i++) {
      if (value <= levels[i + 1]) {
        return {
          level: i + 1,
          color: colors[i] || '#4CAF50'
        };
      }
    }
    return { level: 6, color: '#880E4F' };
  }
});
