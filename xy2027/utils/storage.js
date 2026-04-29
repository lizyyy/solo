const STORAGE_KEYS = {
  FABRICS: 'fabrics',
  PATTERNS: 'patterns',
  MATERIALS: 'materials',
  TOOLS: 'tools',
  SEWING_SESSIONS: 'sewingSessions',
  PURCHASES: 'purchases',
  COMMUNITY_POSTS: 'communityPosts',
  USER_SETTINGS: 'userSettings'
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2)
}

function getStorageData(key, defaultValue = []) {
  try {
    const data = wx.getStorageSync(key)
    return data || defaultValue
  } catch (e) {
    console.error('读取存储失败', e)
    return defaultValue
  }
}

function setStorageData(key, data) {
  try {
    wx.setStorageSync(key, data)
    return true
  } catch (e) {
    console.error('保存存储失败', e)
    return false
  }
}

function formatPrice(price) {
  return parseFloat(price).toFixed(2)
}

function formatTime(seconds) {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

function formatDate(date) {
  const d = new Date(date)
  const year = d.getFullYear()
  const month = (d.getMonth() + 1).toString().padStart(2, '0')
  const day = d.getDate().toString().padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatDateTime(date) {
  const d = new Date(date)
  return `${formatDate(d)} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

module.exports = {
  STORAGE_KEYS,
  generateId,
  getStorageData,
  setStorageData,
  formatPrice,
  formatTime,
  formatDate,
  formatDateTime
}
