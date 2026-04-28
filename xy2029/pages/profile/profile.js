const app = getApp()
const { getSalaryTier, getTierName, formatMoney } = require('../../utils/util.js')

Page({
  data: {
    userInfo: null,
    currentTier: null,
    currentTierName: null,
    formattedSalary: '',
    totalSavings: 0,
    checkinDays: 0,
    friendsCount: 0
  },

  onLoad: function () {
    this.checkUserInfo()
    this.loadStats()
  },

  onShow: function () {
    this.checkUserInfo()
    this.loadStats()
  },

  checkUserInfo: function () {
    const userInfo = app.globalData.userInfo
    if (userInfo) {
      this.setData({
        userInfo: userInfo
      })
      
      if (userInfo.salary) {
        const tier = getSalaryTier(userInfo.salary)
        this.setData({
          currentTier: tier,
          currentTierName: getTierName(tier),
          formattedSalary: formatMoney(userInfo.salary)
        })
      }
    }
  },

  loadStats: function () {
    const checkinRecords = app.globalData.checkinRecords || []
    const incomeRecords = app.globalData.incomeRecords || []
    
    let totalSavings = 0
    checkinRecords.forEach(record => {
      if (record.type === 'savings') {
        totalSavings += record.amount
      }
    })

    this.setData({
      totalSavings: totalSavings,
      checkinDays: checkinRecords.length,
      friendsCount: 0
    })
  },

  getUserProfile: function () {
    const that = this
    wx.getUserProfile({
      desc: '用于完善用户资料',
      success: (res) => {
        const userInfo = {
          nickname: res.userInfo.nickName,
          avatar: res.userInfo.avatarUrl,
          salary: null
        }
        app.saveUserInfo(userInfo)
        that.setData({
          userInfo: userInfo
        })
        wx.showToast({
          title: '登录成功',
          icon: 'success'
        })
      },
      fail: () => {
        const userInfo = {
          nickname: '打工人' + Math.floor(Math.random() * 10000),
          avatar: '👤',
          salary: null
        }
        app.saveUserInfo(userInfo)
        that.setData({
          userInfo: userInfo
        })
      }
    })
  },

  goToCalculator: function () {
    wx.switchTab({
      url: '/pages/calculator/calculator'
    })
  },

  goToCheckin: function () {
    wx.navigateTo({
      url: '/pages/checkin/checkin'
    })
  },

  goToComparison: function () {
    wx.navigateTo({
      url: '/pages/comparison/comparison'
    })
  },

  goToMentalHealth: function () {
    wx.navigateTo({
      url: '/pages/mental-health/mental-health'
    })
  },

  goToGoods: function () {
    wx.navigateTo({
      url: '/pages/goods/goods'
    })
  },

  goToWallpaper: function () {
    wx.navigateTo({
      url: '/pages/wallpaper/wallpaper'
    })
  },

  clearCache: function () {
    wx.showModal({
      title: '确认清除',
      content: '确定要清除所有本地数据吗？',
      success: (res) => {
        if (res.confirm) {
          try {
            wx.clearStorageSync()
            app.globalData.userInfo = null
            app.globalData.checkinRecords = []
            app.globalData.incomeRecords = []
            
            this.setData({
              userInfo: null,
              currentTier: null,
              currentTierName: null,
              formattedSalary: '',
              totalSavings: 0,
              checkinDays: 0,
              friendsCount: 0
            })
            
            wx.showToast({
              title: '清除成功',
              icon: 'success'
            })
          } catch (e) {
            wx.showToast({
              title: '清除失败',
              icon: 'none'
            })
          }
        }
      }
    })
  },

  aboutApp: function () {
    wx.showModal({
      title: '关于工资等级生存',
      content: '版本：1.0.0\n\n一款帮助打工人了解不同薪资档位生活水准的小程序，提供薪资分配计算、心态治愈、社交交流等功能。',
      showCancel: false,
      confirmText: '知道了'
    })
  },

  onShareAppMessage: function () {
    return {
      title: '工资等级生存 - 找到你的档位，过好当下生活',
      path: '/pages/index/index'
    }
  }
})
