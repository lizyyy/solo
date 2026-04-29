const app = getApp()
const { salaryTiers } = require('../../data/salary-tiers.js')
const { getSalaryTier, getTierName, formatMoney, calculateAllocation } = require('../../utils/util.js')

const allocationConfig = {
  rent: {
    name: '房租',
    icon: '🏠',
    color: '#FF6B6B',
    tip: '住宿是最大开支'
  },
  food: {
    name: '伙食',
    icon: '🍜',
    color: '#4ECDC4',
    tip: '民以食为天'
  },
  shopping: {
    name: '购物',
    icon: '🛍️',
    color: '#45B7D1',
    tip: '日常用品+穿搭'
  },
  entertainment: {
    name: '娱乐',
    icon: '🎮',
    color: '#96CEB4',
    tip: '放松身心很重要'
  },
  savings: {
    name: '存款',
    icon: '💰',
    color: '#DDA0DD',
    tip: '积少成多'
  },
  reserve: {
    name: '备用金',
    icon: '💳',
    color: '#FFEAA7',
    tip: '应急储备'
  },
  social: {
    name: '社交',
    icon: '👥',
    color: '#74B9FF',
    tip: '人情往来'
  }
}

Page({
  data: {
    salary: '',
    currentTier: null,
    showResult: false,
    tierInfo: null,
    formattedSalary: '',
    allocation: {},
    allocationList: []
  },

  onLoad: function () {
    this.checkSavedSalary()
  },

  checkSavedSalary: function () {
    const userInfo = app.globalData.userInfo
    if (userInfo && userInfo.salary) {
      const salary = userInfo.salary
      const tier = getSalaryTier(salary)
      this.setData({
        salary: salary.toString(),
        currentTier: tier
      })
      this.doCalculate(salary)
    }
  },

  onSalaryInput: function (e) {
    const value = e.detail.value
    const salary = parseInt(value) || 0
    const tier = getSalaryTier(salary)
    
    this.setData({
      salary: value,
      currentTier: tier
    })
  },

  selectTier: function (e) {
    const tier = e.currentTarget.dataset.tier
    const salary = parseInt(e.currentTarget.dataset.salary)
    
    this.setData({
      salary: salary.toString(),
      currentTier: tier
    })
  },

  calculate: function () {
    const salary = parseInt(this.data.salary)
    
    if (!salary || salary <= 0) {
      wx.showToast({
        title: '请输入有效的月薪',
        icon: 'none'
      })
      return
    }
    
    this.doCalculate(salary)
  },

  doCalculate: function (salary) {
    const tier = getSalaryTier(salary)
    const tierInfo = salaryTiers[tier]
    const allocation = calculateAllocation(salary, tier)
    
    const allocationList = Object.keys(allocation).map(key => {
      const config = allocationConfig[key]
      return {
        key: key,
        name: config.name,
        icon: config.icon,
        color: config.color,
        tip: config.tip,
        ratio: Math.round(allocation[key].ratio * 100),
        amount: allocation[key].amount,
        formattedAmount: formatMoney(allocation[key].amount)
      }
    }).sort((a, b) => b.ratio - a.ratio)
    
    const formattedAllocation = {}
    Object.keys(allocation).forEach(key => {
      formattedAllocation[key] = {
        ...allocation[key],
        formattedAmount: formatMoney(allocation[key].amount)
      }
    })

    this.setData({
      showResult: true,
      tierInfo: tierInfo,
      currentTier: tier,
      formattedSalary: formatMoney(salary),
      allocation: formattedAllocation,
      allocationList: allocationList
    })

    wx.pageScrollTo({
      selector: '.result-section',
      duration: 300
    })
  },

  saveSalary: function () {
    const salary = parseInt(this.data.salary)
    if (!salary || salary <= 0) {
      wx.showToast({
        title: '请先计算薪资分配',
        icon: 'none'
      })
      return
    }

    const userInfo = app.globalData.userInfo || {
      nickname: '打工人',
      avatar: '👤'
    }
    
    userInfo.salary = salary
    app.saveUserInfo(userInfo)

    wx.showToast({
      title: '保存成功',
      icon: 'success'
    })
  },

  shareResult: function () {
    if (!this.data.showResult) {
      wx.showToast({
        title: '请先计算薪资分配',
        icon: 'none'
      })
      return
    }
  },

  onShareAppMessage: function () {
    const salary = this.data.salary
    const tierName = this.data.tierInfo ? this.data.tierInfo.name : ''
    
    return {
      title: `月薪${salary || ''}元，${tierName}薪资分配方案`,
      path: '/pages/calculator/calculator'
    }
  }
})
