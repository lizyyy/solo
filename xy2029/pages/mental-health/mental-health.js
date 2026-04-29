const app = getApp()
const { mentalHealthData } = require('../../data/mental-health.js')

Page({
  data: {
    currentTab: 0,
    currentQuote: '',
    realStories: [],
    warnings: [],
    articles: []
  },

  onLoad: function () {
    this.loadData()
    this.refreshQuote()
  },

  loadData: function () {
    this.setData({
      realStories: mentalHealthData.realStories || [],
      warnings: mentalHealthData.warnings || [],
      articles: mentalHealthData.articles || []
    })
  },

  refreshQuote: function () {
    const quotes = mentalHealthData.quotes || [
      '接受自己的平凡，就是最大的不平凡',
      '每一个今天，都是生命中最年轻的一天',
      '不要和别人比，要和昨天的自己比',
      '工资只是数字，生活才是目的',
      '慢慢来，一切都会好起来的'
    ]
    
    const randomIndex = Math.floor(Math.random() * quotes.length)
    this.setData({
      currentQuote: quotes[randomIndex]
    })
  },

  switchTab: function (e) {
    const index = parseInt(e.currentTarget.dataset.index)
    this.setData({
      currentTab: index
    })
  },

  viewStory: function (e) {
    const id = e.currentTarget.dataset.id
    wx.showToast({
      title: '查看故事详情',
      icon: 'none'
    })
  },

  viewArticle: function (e) {
    const id = e.currentTarget.dataset.id
    wx.showToast({
      title: '查看文章详情',
      icon: 'none'
    })
  },

  onShareAppMessage: function () {
    return {
      title: '心态治愈专区 - 拒绝焦虑，接受自己',
      path: '/pages/index/index'
    }
  }
})
