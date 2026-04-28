const app = getApp()
const { goodsData } = require('../../data/goods.js')

Page({
  data: {
    currentTier: '3k',
    currentCategory: 'all',
    categories: [
      { id: 'all', name: '全部' },
      { id: 'lifestyle', name: '生活日用' },
      { id: 'clothing', name: '穿搭' },
      { id: 'beauty', name: '护肤美妆' },
      { id: 'food', name: '美食' },
      { id: 'digital', name: '数码' }
    ],
    goodsList: [],
    filteredGoods: []
  },

  onLoad: function () {
    this.loadGoods()
  },

  loadGoods: function () {
    const allGoods = goodsData || []
    
    this.setData({
      goodsList: allGoods
    })
    
    this.filterGoods()
  },

  filterGoods: function () {
    const { goodsList, currentTier, currentCategory } = this.data
    
    let filtered = goodsList.filter(item => item.tier === currentTier)
    
    if (currentCategory !== 'all') {
      filtered = filtered.filter(item => item.category === currentCategory)
    }
    
    this.setData({
      filteredGoods: filtered
    })
  },

  switchTier: function (e) {
    const tier = e.currentTarget.dataset.tier
    this.setData({
      currentTier: tier
    })
    this.filterGoods()
  },

  switchCategory: function (e) {
    const category = e.currentTarget.dataset.category
    this.setData({
      currentCategory: category
    })
    this.filterGoods()
  },

  viewGood: function (e) {
    const id = e.currentTarget.dataset.id
    wx.showToast({
      title: '查看好物详情',
      icon: 'none'
    })
  },

  onShareAppMessage: function () {
    return {
      title: '省钱快乐好物推荐 - 适合你的才是最好的',
      path: '/pages/index/index'
    }
  }
})
