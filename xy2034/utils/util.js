const formatTime = date => {
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  const hour = date.getHours()
  const minute = date.getMinutes()

  return `${year}-${formatNumber(month)}-${formatNumber(day)} ${formatNumber(hour)}:${formatNumber(minute)}`
}

const formatNumber = n => {
  n = n.toString()
  return n[1] ? n : `0${n}`
}

const getCurrentTime = () => {
  return formatTime(new Date())
}

const generateId = () => {
  return Date.now() + Math.floor(Math.random() * 1000)
}

const showToast = (title, icon = 'none', duration = 2000) => {
  wx.showToast({
    title: title,
    icon: icon,
    duration: duration
  })
}

const showLoading = (title = '加载中...') => {
  wx.showLoading({
    title: title,
    mask: true
  })
}

const hideLoading = () => {
  wx.hideLoading()
}

const confirmDialog = (content, title = '提示') => {
  return new Promise((resolve, reject) => {
    wx.showModal({
      title: title,
      content: content,
      success: (res) => {
        if (res.confirm) {
          resolve(true)
        } else if (res.cancel) {
          resolve(false)
        }
      },
      fail: (err) => {
        reject(err)
      }
    })
  })
}

module.exports = {
  formatTime,
  formatNumber,
  getCurrentTime,
  generateId,
  showToast,
  showLoading,
  hideLoading,
  confirmDialog
}
