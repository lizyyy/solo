const app = getApp()
const { wallpaperData } = require('../../data/wallpaper.js')

Page({
  data: {
    currentTab: 0,
    tierQuotes: [],
    momentQuotes: [],
    healingQuotes: []
  },

  onLoad: function () {
    this.loadData()
  },

  loadData: function () {
    const data = wallpaperData || {}
    
    this.setData({
      tierQuotes: data.tierQuotes || [],
      momentQuotes: data.momentQuotes || [],
      healingQuotes: data.healingQuotes || []
    })
  },

  switchTab: function (e) {
    const index = parseInt(e.currentTarget.dataset.index)
    this.setData({
      currentTab: index
    })
  },

  copyQuote: function (e) {
    const content = e.currentTarget.dataset.content
    wx.setClipboardData({
      data: content,
      success: () => {
        wx.showToast({
          title: '已复制',
          icon: 'success'
        })
      }
    })
  },

  shareQuote: function (e) {
    const id = e.currentTarget.dataset.id
    wx.showToast({
      title: '分享功能',
      icon: 'none'
    })
  },

  onShareAppMessage: function () {
    return {
      title: '打工人共鸣文案 - 找到属于你的那一句',
      path: '/pages/index/index'
    }
  }
})
