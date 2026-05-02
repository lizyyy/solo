App({
  globalData: {
    userInfo: null,
    currentSalary: null,
    currentTier: null,
    checkinRecords: [],
    incomeRecords: [],
    friends: [],
    posts: []
  },

  onLaunch: function () {
    console.log('工资等级生存小程序启动')
    this.initGlobalData()
  },

  initGlobalData: function() {
    try {
      const checkinRecords = wx.getStorageSync('checkinRecords')
      if (checkinRecords) {
        this.globalData.checkinRecords = checkinRecords
      }
      
      const incomeRecords = wx.getStorageSync('incomeRecords')
      if (incomeRecords) {
        this.globalData.incomeRecords = incomeRecords
      }
      
      const userInfo = wx.getStorageSync('userInfo')
      if (userInfo) {
        this.globalData.userInfo = userInfo
      }
    } catch (e) {
      console.log('初始化数据失败', e)
    }
  },

  saveCheckinRecords: function(records) {
    this.globalData.checkinRecords = records
    try {
      wx.setStorageSync('checkinRecords', records)
    } catch (e) {
      console.log('保存打卡记录失败', e)
    }
  },

  saveIncomeRecords: function(records) {
    this.globalData.incomeRecords = records
    try {
      wx.setStorageSync('incomeRecords', records)
    } catch (e) {
      console.log('保存收入记录失败', e)
    }
  },

  saveCheckinRecord: function(record) {
    const records = this.globalData.checkinRecords || []
    records.unshift(record)
    this.globalData.checkinRecords = records
    try {
      wx.setStorageSync('checkinRecords', records)
    } catch (e) {
      console.log('保存打卡记录失败', e)
    }
  },

  saveIncomeRecord: function(record) {
    const records = this.globalData.incomeRecords || []
    records.unshift(record)
    this.globalData.incomeRecords = records
    try {
      wx.setStorageSync('incomeRecords', records)
    } catch (e) {
      console.log('保存收入记录失败', e)
    }
  },

  saveUserInfo: function(userInfo) {
    this.globalData.userInfo = userInfo
    try {
      wx.setStorageSync('userInfo', userInfo)
    } catch (e) {
      console.log('保存用户信息失败', e)
    }
  }
})
