const { salaryTiers } = require('../../../data/salary-tiers.js')
const { getTierName } = require('../../../utils/util.js')

const consumptionIcons = {
  diet: '🍜',
  housing: '🏠',
  clothing: '👔',
  skincare: '💄',
  entertainment: '🎮',
  savings: '💰'
}

Page({
  data: {
    tier: '',
    tierInfo: null,
    activeTab: 'consumption',
    consumptionCategories: []
  },

  onLoad: function (options) {
    const tier = options.tier || '3k'
    this.loadTierData(tier)
  },

  loadTierData: function (tier) {
    const tierInfo = salaryTiers[tier]
    
    if (!tierInfo) {
      wx.showToast({
        title: '档位不存在',
        icon: 'none'
      })
      return
    }

    wx.setNavigationBarTitle({
      title: tierInfo.displayName + ' - ' + tierInfo.name
    })

    const consumptionCategories = Object.keys(tierInfo.consumption).map(key => {
      return {
        key: key,
        icon: consumptionIcons[key] || '📦',
        data: tierInfo.consumption[key]
      }
    })

    this.setData({
      tier: tier,
      tierInfo: tierInfo,
      consumptionCategories: consumptionCategories
    })
  },

  switchTab: function (e) {
    const tab = e.currentTarget.dataset.tab
    this.setData({
      activeTab: tab
    })
  },

  goToCalculator: function () {
    wx.switchTab({
      url: '/pages/calculator/calculator'
    })
  },

  shareTier: function () {
    
  },

  onShareAppMessage: function () {
    const tierInfo = this.data.tierInfo
    if (tierInfo) {
      return {
        title: `${tierInfo.displayName} - ${tierInfo.name}，看看你的生活水准`,
        path: `/pages/salary-tier/tier-detail/tier-detail?tier=${this.data.tier}`
      }
    }
    return {
      title: '工资等级生存 - 找到你的档位',
      path: '/pages/index/index'
    }
  }
})
