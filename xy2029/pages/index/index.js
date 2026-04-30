const app = getApp()
const { salaryTiers, tierList } = require('../../data/salary-tiers.js')
const { universalQuotes } = require('../../data/wallpaper.js')
const { mockPosts } = require('../../data/social.js')
const { getSalaryTier, getTierName, formatMoney } = require('../../utils/util.js')

Page({
  data: {
    userInfo: null,
    userSalary: null,
    currentTier: null,
    currentTierName: null,
    tierList: [],
    dailyQuote: '',
    hotPosts: []
  },

  onLoad: function () {
    this.initData()
  },

  onShow: function () {
    this.checkUserInfo()
  },

  initData: function () {
    const tiers = tierList.map(tierId => {
      return salaryTiers[tierId]
    })
    
    const randomQuote = universalQuotes[Math.floor(Math.random() * universalQuotes.length)]
    
    const hotPosts = mockPosts.slice(0, 3)

    this.setData({
      tierList: tiers,
      dailyQuote: randomQuote.content,
      hotPosts: hotPosts
    })
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
          userSalary: formatMoney(userInfo.salary),
          currentTier: tier,
          currentTierName: getTierName(tier)
        })
      }
    }
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

  goToTierDetail: function (e) {
    const tier = e.currentTarget.dataset.tier
    wx.navigateTo({
      url: `/pages/salary-tier/tier-detail/tier-detail?tier=${tier}`
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

  goToCheckin: function () {
    wx.navigateTo({
      url: '/pages/checkin/checkin'
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

  goToPostDetail: function (e) {
    const post = e.currentTarget.dataset.post
    wx.navigateTo({
      url: `/pages/social/post-detail/post-detail?id=${post.id}`
    })
  },

  onShareAppMessage: function () {
    return {
      title: '工资等级生存 - 找到你的档位，过好当下生活',
      path: '/pages/index/index'
    }
  }
})
