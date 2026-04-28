const { STORAGE_KEYS, getStorageData, formatPrice, formatTime, formatDateTime, formatDate } = require('../../utils/storage.js')

Page({
  data: {
    activeTab: 'overview',
    tabs: [
      { key: 'overview', name: '数据概览' },
      { key: 'purchases', name: '购买记录' },
      { key: 'sessions', name: '缝纫记录' }
    ],
    
    overview: {
      totalFabrics: 0,
      totalPatterns: 0,
      totalMaterials: 0,
      totalTools: 0,
      totalInvestment: 0,
      totalSewingTime: 0,
      totalSessions: 0,
      totalPosts: 0,
      lowStockMaterials: 0
    },
    
    purchases: [],
    sessions: [],
    
    purchaseStats: {
      totalAmount: 0,
      purchaseCount: 0
    },
    
    sewingStats: {
      totalTime: 0,
      sessionCount: 0,
      avgTime: 0
    }
  },

  onLoad() {
    this.loadAllData()
  },

  onShow() {
    this.loadAllData()
  },

  loadAllData() {
    this.loadOverview()
    this.loadPurchases()
    this.loadSessions()
  },

  loadOverview() {
    const fabrics = getStorageData(STORAGE_KEYS.FABRICS)
    const patterns = getStorageData(STORAGE_KEYS.PATTERNS)
    const materials = getStorageData(STORAGE_KEYS.MATERIALS)
    const tools = getStorageData(STORAGE_KEYS.TOOLS)
    const sessions = getStorageData(STORAGE_KEYS.SEWING_SESSIONS)
    const purchases = getStorageData(STORAGE_KEYS.PURCHASES)
    const posts = getStorageData(STORAGE_KEYS.COMMUNITY_POSTS)

    let totalInvestment = 0
    fabrics.forEach(f => totalInvestment += f.totalValue || 0)
    patterns.forEach(p => totalInvestment += p.price || 0)
    materials.forEach(m => totalInvestment += m.totalValue || 0)
    tools.forEach(t => totalInvestment += t.price || 0)

    let totalSewingTime = 0
    let completedSessions = 0
    sessions.forEach(s => {
      if (s.completed && s.actualDuration) {
        totalSewingTime += s.actualDuration
        completedSessions++
      }
    })

    const lowStockMaterials = materials.filter(m => m.quantity <= (m.minimumStock || 5)).length

    this.setData({
      overview: {
        totalFabrics: fabrics.length,
        totalPatterns: patterns.length,
        totalMaterials: materials.length,
        totalTools: tools.length,
        totalInvestment: formatPrice(totalInvestment),
        totalSewingTime: formatTime(totalSewingTime),
        totalSessions: completedSessions,
        totalPosts: posts.length,
        lowStockMaterials: lowStockMaterials
      }
    })
  },

  loadPurchases() {
    const purchases = getStorageData(STORAGE_KEYS.PURCHASES)
      .sort((a, b) => new Date(b.purchaseDate) - new Date(a.purchaseDate))
    
    let totalAmount = 0
    purchases.forEach(p => totalAmount += p.totalAmount || 0)

    this.setData({
      purchases,
      purchaseStats: {
        totalAmount: formatPrice(totalAmount),
        purchaseCount: purchases.length
      }
    })
  },

  loadSessions() {
    const sessions = getStorageData(STORAGE_KEYS.SEWING_SESSIONS)
      .filter(s => s.completed)
      .sort((a, b) => b.startTime - a.startTime)
    
    let totalTime = 0
    sessions.forEach(s => totalTime += s.actualDuration || 0)

    this.setData({
      sessions,
      sewingStats: {
        totalTime: formatTime(totalTime),
        sessionCount: sessions.length,
        avgTime: sessions.length > 0 ? formatTime(Math.round(totalTime / sessions.length)) : '00:00'
      }
    })
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab
    this.setData({ activeTab: tab })
  },

  formatDuration(seconds) {
    if (!seconds) return '0分钟'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    if (mins > 0) {
      return `${mins}分${secs > 0 ? secs + '秒' : ''}`
    }
    return `${secs}秒`
  },

  formatTimestamp(timestamp) {
    if (!timestamp) return ''
    return formatDateTime(timestamp)
  },

  getTypeLabel(type) {
    const labels = {
      'pomodoro': '番茄钟',
      'stopwatch': '正计时',
      'countdown': '倒计时'
    }
    return labels[type] || type
  },

  getTypeColor(type) {
    const colors = {
      'pomodoro': '#e74c3c',
      'stopwatch': '#3498DB',
      'countdown': '#ffc107'
    }
    return colors[type] || '#999'
  },

  getItemTypeLabel(type) {
    const labels = {
      'fabric': '面料',
      'pattern': '纸样',
      'material': '辅料',
      'tool': '工具'
    }
    return labels[type] || type
  },

  getItemTypeColor(type) {
    const colors = {
      'fabric': '#FF6B6B',
      'pattern': '#d4a574',
      'material': '#4ECDC4',
      'tool': '#9B59B6'
    }
    return colors[type] || '#999'
  },

  goToPage(e) {
    const path = e.currentTarget.dataset.path
    if (path) {
      wx.navigateTo({
        url: path
      })
    }
  }
})
