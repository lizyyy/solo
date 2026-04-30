const app = getApp()
const { formatTime, formatMoney } = require('../../utils/util.js')

Page({
  data: {
    currentTab: 0,
    todayChecked: false,
    continuousDays: 0,
    totalSavings: 0,
    totalIncome: 0,
    checkinRecords: [],
    incomeRecords: [],
    filteredRecords: [],
    showModal: false,
    currentModal: '',
    inputAmount: '',
    inputRemark: '',
    incomeType: 'side'
  },

  onLoad: function () {
    this.loadRecords()
  },

  onShow: function () {
    this.loadRecords()
  },

  loadRecords: function () {
    const checkinRecords = app.globalData.checkinRecords || []
    const incomeRecords = app.globalData.incomeRecords || []
    
    let totalSavings = 0
    checkinRecords.forEach(record => {
      totalSavings += record.amount
    })
    
    let totalIncome = 0
    incomeRecords.forEach(record => {
      totalIncome += record.amount
    })
    
    const today = formatTime(new Date(), 'YYYY-MM-DD')
    let todayChecked = false
    checkinRecords.forEach(record => {
      if (record.createTime.startsWith(today)) {
        todayChecked = true
      }
    })
    
    let continuousDays = 0
    if (checkinRecords.length > 0) {
      const sortedRecords = [...checkinRecords].sort((a, b) => 
        new Date(b.createTime) - new Date(a.createTime)
      )
      
      let currentDate = new Date()
      currentDate.setHours(0, 0, 0, 0)
      
      for (let i = 0; i < sortedRecords.length; i++) {
        const recordDate = new Date(sortedRecords[i].createTime)
        recordDate.setHours(0, 0, 0, 0)
        
        const diffDays = Math.floor((currentDate - recordDate) / (1000 * 60 * 60 * 24))
        
        if (diffDays <= 1) {
          continuousDays++
          currentDate = recordDate
        } else {
          break
        }
      }
    }
    
    const allRecords = [...checkinRecords, ...incomeRecords].sort((a, b) =>
      new Date(b.createTime) - new Date(a.createTime)
    )
    
    this.setData({
      checkinRecords,
      incomeRecords,
      totalSavings,
      totalIncome,
      todayChecked,
      continuousDays,
      filteredRecords: allRecords
    })
  },

  switchTab: function (e) {
    const index = parseInt(e.currentTarget.dataset.index)
    let filteredRecords = []
    
    const { checkinRecords, incomeRecords } = this.data
    const allRecords = [...checkinRecords, ...incomeRecords].sort((a, b) =>
      new Date(b.createTime) - new Date(a.createTime)
    )
    
    if (index === 0) {
      filteredRecords = allRecords
    } else if (index === 1) {
      filteredRecords = checkinRecords
    } else {
      filteredRecords = incomeRecords
    }
    
    this.setData({
      currentTab: index,
      filteredRecords
    })
  },

  showSavingsModal: function () {
    this.setData({
      showModal: true,
      currentModal: 'savings',
      inputAmount: '',
      inputRemark: ''
    })
  },

  showIncomeModal: function () {
    this.setData({
      showModal: true,
      currentModal: 'income',
      inputAmount: '',
      inputRemark: '',
      incomeType: 'side'
    })
  },

  hideModal: function () {
    this.setData({
      showModal: false,
      currentModal: ''
    })
  },

  stopPropagation: function () {},

  onAmountInput: function (e) {
    this.setData({
      inputAmount: e.detail.value
    })
  },

  onRemarkInput: function (e) {
    this.setData({
      inputRemark: e.detail.value
    })
  },

  selectIncomeType: function (e) {
    const type = e.currentTarget.dataset.type
    this.setData({
      incomeType: type
    })
  },

  submitRecord: function () {
    const { currentModal, inputAmount, inputRemark, incomeType } = this.data
    
    if (!inputAmount || parseFloat(inputAmount) <= 0) {
      wx.showToast({
        title: '请输入有效金额',
        icon: 'none'
      })
      return
    }
    
    const amount = parseFloat(inputAmount)
    const now = new Date()
    const createTime = formatTime(now, 'YYYY-MM-DD HH:mm')
    const id = Date.now()
    
    if (currentModal === 'savings') {
      const record = {
        id: id,
        type: 'savings',
        amount: amount,
        title: inputRemark || '存钱打卡',
        createTime: createTime
      }
      
      const newRecords = [...(app.globalData.checkinRecords || []), record]
      app.saveCheckinRecords(newRecords)
      
      wx.showToast({
        title: '打卡成功！',
        icon: 'success'
      })
    } else {
      const typeTitles = {
        salary: '工资收入',
        side: '副业收入',
        bonus: '奖金收入',
        other: '其他收入'
      }
      
      const record = {
        id: id,
        type: 'income',
        amount: amount,
        title: inputRemark || typeTitles[incomeType],
        incomeType: incomeType,
        createTime: createTime
      }
      
      const newRecords = [...(app.globalData.incomeRecords || []), record]
      app.saveIncomeRecords(newRecords)
      
      wx.showToast({
        title: '记录成功！',
        icon: 'success'
      })
    }
    
    this.hideModal()
    this.loadRecords()
  },

  onShareAppMessage: function () {
    return {
      title: '我在工资等级生存小程序坚持存钱打卡，来看看吧',
      path: '/pages/index/index'
    }
  }
})
