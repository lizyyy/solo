const app = getApp()
const { salaryTiers } = require('../../data/salary-tiers.js')
const { getTierName } = require('../../utils/util.js')

Page({
  data: {
    tierList: [],
    comparisonData: []
  },

  onLoad: function () {
    this.loadData()
  },

  loadData: function () {
    const tierList = [
      {
        tier: '3k',
        name: '生存模式',
        mode: '努力生存',
        salaryRange: '月薪 3000-8999',
        features: [
          { icon: '🍜', text: '平价吃喝' },
          { icon: '🏠', text: '合租' },
          { icon: '👕', text: '极简穿搭' },
          { icon: '💪', text: '努力打拼' }
        ]
      },
      {
        tier: '9k',
        name: '生活模式',
        mode: '安稳生活',
        salaryRange: '月薪 9000-29999',
        features: [
          { icon: '🍲', text: '偶尔聚餐' },
          { icon: '💄', text: '平价护肤' },
          { icon: '🚴', text: '短途游玩' },
          { icon: '😊', text: '小资生活' }
        ]
      },
      {
        tier: '3w',
        name: '品质模式',
        mode: '品质生活',
        salaryRange: '月薪 30000-49999',
        features: [
          { icon: '🏠', text: '独居' },
          { icon: '👗', text: '品质穿搭' },
          { icon: '✈️', text: '定期旅游' },
          { icon: '🎨', text: '兴趣消费' }
        ]
      },
      {
        tier: '5w',
        name: '舒适模式',
        mode: '舒适生活',
        salaryRange: '月薪 50000-99999',
        features: [
          { icon: '🏡', text: '品质住房' },
          { icon: '💎', text: '轻奢消费' },
          { icon: '🎯', text: '投资理财' },
          { icon: '🌟', text: '自我提升' }
        ]
      },
      {
        tier: '10w',
        name: '自由模式',
        mode: '自由生活',
        salaryRange: '月薪 100000+',
        features: [
          { icon: '💰', text: '理财为主' },
          { icon: '👑', text: '质感生活' },
          { icon: '🎨', text: '兴趣消费' },
          { icon: '🚀', text: '追求梦想' }
        ]
      }
    ]

    const comparisonData = [
      {
        category: '住房',
        values: ['合租', '单租/小公寓', '独居/品质', '优质小区', '高端住宅']
      },
      {
        category: '饮食',
        values: ['平价快餐', '偶尔聚餐', '品质餐厅', '自由选择', '美食探索']
      },
      {
        category: '穿搭',
        values: ['极简实用', '性价比', '品质品牌', '轻奢', '高端定制']
      },
      {
        category: '娱乐',
        values: ['免费活动', '电影/KTV', '短途游', '出国游', '环球旅行']
      },
      {
        category: '存款',
        values: ['艰难', '少量', '稳健', '可观', '丰厚']
      }
    ]

    this.setData({
      tierList,
      comparisonData
    })
  },

  viewTierDetail: function (e) {
    const tier = e.currentTarget.dataset.tier
    wx.navigateTo({
      url: `/pages/salary-tier/tier-detail/tier-detail?tier=${tier}`
    })
  },

  onShareAppMessage: function () {
    return {
      title: '薪资生活对照图鉴 - 看看你在哪一档',
      path: '/pages/index/index'
    }
  }
})
