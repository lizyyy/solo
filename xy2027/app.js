App({
  globalData: {
    userInfo: null,
    sewingTimeTotal: 0,
    projectsCount: 0
  },

  onLaunch() {
    console.log('缝纫工作室小程序启动')
    this.loadUserData()
  },

  loadUserData() {
    try {
      const userData = wx.getStorageSync('userData')
      if (userData) {
        this.globalData.userInfo = userData
      }
    } catch (e) {
      console.error('加载用户数据失败', e)
    }
  },

  saveUserData(data) {
    try {
      wx.setStorageSync('userData', data)
      this.globalData.userInfo = data
    } catch (e) {
      console.error('保存用户数据失败', e)
    }
  }
})
