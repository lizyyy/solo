const { STORAGE_KEYS, getStorageData, formatTime, formatPrice, formatDateTime } = require('../../utils/storage.js')
const { initSampleData } = require('../../utils/initData.js')

Page({
  data: {
    greeting: '',
    todaySewingTime: 0,
    totalSewingTime: 0,
    fabricsCount: 0,
    patternsCount: 0,
    materialsCount: 0,
    toolsCount: 0,
    totalInvestment: 0,
    recentPurchases: [],
    recentSessions: [],
    quickActions: [
      { name: '成衣柜', icon: 'fabrics', path: '/pages/fabric/fabric', color: '#FF6B6B' },
      { name: '纸样库', icon: 'patterns', path: '/pages/pattern/pattern', color: '#d4a574' },
      { name: '辅料', icon: 'materials', path: '/pages/materials/materials', color: '#4ECDC4' },
      { name: '工具箱', icon: 'tools', path: '/pages/tools/tools', color: '#9B59B6' },
      { name: '开始计时', icon: 'timer', path: '/pages/timer/timer', color: '#3498DB' },
      { name: '数据汇总', icon: 'dashboard', path: '/pages/dashboard/dashboard', color: '#E67E22' }
    ]
  },

  onLoad() {
    initSampleData()
    this.loadDashboardData()
  },

  onShow() {
    this.loadDashboardData()
  },

  loadDashboardData() {
    const fabrics = getStorageData(STORAGE_KEYS.FABRICS)
    const patterns = getStorageData(STORAGE_KEYS.PATTERNS)
    const materials = getStorageData(STORAGE_KEYS.MATERIALS)
    const tools = getStorageData(STORAGE_KEYS.TOOLS)
    const sessions = getStorageData(STORAGE_KEYS.SEWING_SESSIONS)
    const purchases = getStorageData(STORAGE_KEYS.PURCHASES)

    const today = new Date()
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
    
    let todaySewingTime = 0
    let totalSewingTime = 0
    sessions.forEach(session => {
      if (session.completed && session.actualDuration) {
        totalSewingTime += session.actualDuration
        if (session.startTime >= todayStart) {
          todaySewingTime += session.actualDuration
        }
      }
    })

    let totalInvestment = 0
    fabrics.forEach(f => totalInvestment += f.totalValue || 0)
    patterns.forEach(p => totalInvestment += p.price || 0)
    materials.forEach(m => totalInvestment += m.totalValue || 0)
    tools.forEach(t => totalInvestment += t.price || 0)

    const recentPurchases = purchases
      .sort((a, b) => new Date(b.purchaseDate) - new Date(a.purchaseDate))
      .slice(0, 3)

    const recentSessions = sessions
      .filter(s => s.completed)
      .sort((a, b) => b.startTime - a.startTime)
      .slice(0, 3)

    this.setData({
      greeting: this.getGreeting(),
      todaySewingTime: formatTime(todaySewingTime),
      totalSewingTime: formatTime(totalSewingTime),
      fabricsCount: fabrics.length,
      patternsCount: patterns.length,
      materialsCount: materials.length,
      toolsCount: tools.length,
      totalInvestment: formatPrice(totalInvestment),
      recentPurchases,
      recentSessions
    })
  },

  getGreeting() {
    const hour = new Date().getHours()
    if (hour < 6) return '夜深了，注意休息'
    if (hour < 9) return '早上好'
    if (hour < 12) return '上午好'
    if (hour < 14) return '中午好'
    if (hour < 17) return '下午好'
    if (hour < 19) return '傍晚好'
    return '晚上好'
  },

  goToPage(e) {
    const path = e.currentTarget.dataset.path
    wx.navigateTo({
      url: path
    })
  },

  startQuickTimer() {
    wx.navigateTo({
      url: '/pages/timer/timer?quickStart=true'
    })
  },

  viewAllPurchases() {
    wx.navigateTo({
      url: '/pages/dashboard/dashboard?tab=purchases'
    })
  },

  viewAllSessions() {
    wx.navigateTo({
      url: '/pages/dashboard/dashboard?tab=sessions'
    })
  }
})
