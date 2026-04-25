const api = require('../../utils/api.js')
const util = require('../../utils/util.js')

Page({
  data: {
    memberInfo: null,
    userInfo: null,
    memberLevels: [
      { level: 1, name: '普通会员', minAmount: 0, icon: '🥖', color: '#999999', discount: '无', benefits: ['基础购物权益', '积分累计'] },
      { level: 2, name: '黄金会员', minAmount: 500, icon: '🌟', color: '#FFD700', discount: '9.5折', benefits: ['全场9.5折', '生日双倍积分', '专属客服'] },
      { level: 3, name: '钻石会员', minAmount: 1000, icon: '💎', color: '#00BCD4', discount: '9折', benefits: ['全场9折', '生日双倍积分', '专属客服', '新品优先体验', '免费配送券'] }
    ],
    loading: true
  },

  onLoad() {
    this.initPage()
  },

  onShow() {
    this.loadMemberInfo()
  },

  async initPage() {
    this.setData({ loading: true })
    await this.loadMemberInfo()
    this.setData({ loading: false })
  },

  async loadMemberInfo() {
    try {
      const [memberRes, userRes] = await Promise.all([
        api.getMemberInfo(),
        api.getUserInfo()
      ])

      this.setData({
        memberInfo: memberRes.data,
        userInfo: userRes.data
      })
    } catch (error) {
      console.error('加载会员信息失败:', error)
    }
  },

  getCurrentLevelIndex() {
    const { memberInfo, memberLevels } = this.data
    const currentLevel = memberInfo ? memberInfo.level : 1
    return memberLevels.findIndex(l => l.level === currentLevel)
  },

  getNextLevel() {
    const { memberInfo, memberLevels } = this.data
    const currentLevel = memberInfo ? memberInfo.level : 1
    const nextLevelIndex = memberLevels.findIndex(l => l.level === currentLevel + 1)
    if (nextLevelIndex > -1) {
      return memberLevels[nextLevelIndex]
    }
    return null
  },

  getProgress() {
    const { memberInfo, memberLevels } = this.data
    if (!memberInfo) {
      return { current: 0, total: 500, percent: 0 }
    }

    const currentLevel = memberInfo.level
    const nextLevel = this.getNextLevel()
    
    if (!nextLevel) {
      return { current: memberInfo.totalRecharge, total: memberInfo.totalRecharge, percent: 100 }
    }

    const currentLevelConfig = memberLevels.find(l => l.level === currentLevel)
    const current = memberInfo.totalRecharge - currentLevelConfig.minAmount
    const total = nextLevel.minAmount - currentLevelConfig.minAmount
    const percent = Math.min(Math.floor((current / total) * 100), 100)

    return { current, total, percent }
  },

  onRechargeTap() {
    wx.navigateTo({
      url: '/pages/profile/recharge'
    })
  },

  onLevelDetail(e) {
    const level = e.currentTarget.dataset.level
    const { memberLevels } = this.data
    const levelConfig = memberLevels.find(l => l.level === level)
    
    if (levelConfig) {
      const benefits = levelConfig.benefits.join('\n• ')
      util.showModal(levelConfig.name + '权益', 
        `升级条件：累计充值满${levelConfig.minAmount}元\n\n折扣：${levelConfig.discount}\n\n专属权益：\n• ${benefits}`, 
        false)
    }
  },

  onBenefitTap(e) {
    const benefit = e.currentTarget.dataset.benefit
    util.showToast(benefit + '权益')
  }
})
