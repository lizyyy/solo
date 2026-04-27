function formatTime(date) {
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  const hour = date.getHours()
  const minute = date.getMinutes()
  const second = date.getSeconds()

  return `${[year, month, day].map(formatNumber).join('-')} ${[hour, minute, second].map(formatNumber).join(':')}`
}

function formatDate(date) {
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()

  return `${[year, month, day].map(formatNumber).join('-')}`
}

function formatNumber(n) {
  n = n.toString()
  return n[1] ? n : `0${n}`
}

function formatPrice(price) {
  return parseFloat(price).toFixed(2)
}

function formatOrderTime(isoString) {
  if (!isoString) return ''
  const date = new Date(isoString)
  const now = new Date()
  const diff = now - date
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  if (hours < 24) return `${hours}小时前`
  if (days < 7) return `${days}天前`
  
  return formatTime(date)
}

function getOrderStatusText(status) {
  const statusMap = {
    'pending': '待支付',
    'paid': '已支付',
    'preparing': '制作中',
    'delivering': '配送中',
    'completed': '已完成',
    'cancelled': '已取消',
    'refunded': '已退款'
  }
  return statusMap[status] || '未知'
}

function getOrderStatusColor(status) {
  const colorMap = {
    'pending': '#FF9800',
    'paid': '#2196F3',
    'preparing': '#9C27B0',
    'delivering': '#FF5722',
    'completed': '#4CAF50',
    'cancelled': '#999999',
    'refunded': '#999999'
  }
  return colorMap[status] || '#999999'
}

function showToast(title, icon = 'none', duration = 2000) {
  return new Promise((resolve) => {
    wx.showToast({
      title,
      icon,
      duration,
      success: () => {
        setTimeout(resolve, duration)
      }
    })
  })
}

function showLoading(title = '加载中...') {
  wx.showLoading({
    title,
    mask: true
  })
}

function hideLoading() {
  wx.hideLoading()
}

function showModal(title, content, showCancel = true) {
  return new Promise((resolve) => {
    wx.showModal({
      title,
      content,
      showCancel,
      success: (res) => {
        resolve(res.confirm)
      }
    })
  })
}

function debounce(fn, delay = 300) {
  let timer = null
  return function (...args) {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      fn.apply(this, args)
      timer = null
    }, delay)
  }
}

function throttle(fn, delay = 300) {
  let lastTime = 0
  return function (...args) {
    const now = Date.now()
    if (now - lastTime >= delay) {
      fn.apply(this, args)
      lastTime = now
    }
  }
}

function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') return obj
  if (obj instanceof Date) return new Date(obj)
  if (obj instanceof Array) return obj.map(item => deepClone(item))
  if (obj instanceof Object) {
    const clonedObj = {}
    Object.keys(obj).forEach(key => {
      clonedObj[key] = deepClone(obj[key])
    })
    return clonedObj
  }
  return obj
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2)
}

function calculateDeliveryFee(totalAmount, deliveryMode, deliveryModes) {
  const mode = deliveryModes.find(m => m.id === deliveryMode)
  if (!mode) return 0
  
  if (mode.freeThreshold && totalAmount >= mode.freeThreshold) {
    return 0
  }
  return mode.fee || 0
}

function isValidPhone(phone) {
  return /^1[3-9]\d{9}$/.test(phone)
}

function isValidName(name) {
  return name && name.length >= 2
}

module.exports = {
  formatTime,
  formatDate,
  formatNumber,
  formatPrice,
  formatOrderTime,
  getOrderStatusText,
  getOrderStatusColor,
  showToast,
  showLoading,
  hideLoading,
  showModal,
  debounce,
  throttle,
  deepClone,
  generateId,
  calculateDeliveryFee,
  isValidPhone,
  isValidName
}
