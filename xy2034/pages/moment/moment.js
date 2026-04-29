const util = require('../../utils/util.js')

Page({
  data: {
    moments: [],
    userInfo: null,
    isLoggedIn: false,
    isLoading: false
  },

  onLoad: function (options) {
    this.checkLoginStatus()
    this.loadMoments()
  },

  onShow: function () {
    this.checkLoginStatus()
    this.loadMoments()
  },

  onPullDownRefresh: function () {
    this.loadMoments()
    wx.stopPullDownRefresh()
  },

  checkLoginStatus: function () {
    const app = getApp()
    if (app.globalData.isLoggedIn) {
      this.setData({
        userInfo: app.globalData.userInfo,
        isLoggedIn: true
      })
    } else {
      this.setData({
        userInfo: null,
        isLoggedIn: false
      })
    }
  },

  loadMoments: function () {
    const moments = wx.getStorageSync('moments') || []
    // 只显示公开的帖子
    const publicMoments = moments.filter(m => m.isPublic)
    this.setData({
      moments: publicMoments.sort((a, b) => new Date(b.createTime) - new Date(a.createTime))
    })
  },

  goToCreateMoment: function () {
    if (!this.data.isLoggedIn) {
      util.showToast('请先登录')
      return
    }
    wx.navigateTo({
      url: '/pages/moment/createMoment/createMoment'
    })
  },

  goToMomentDetail: function (e) {
    const momentId = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/moment/momentDetail/momentDetail?id=${momentId}`
    })
  },

  toggleLike: function (e) {
    if (!this.data.isLoggedIn) {
      util.showToast('请先登录')
      return
    }
    
    const momentId = e.currentTarget.dataset.id
    const { moments, userInfo } = this.data
    const momentIndex = moments.findIndex(m => m.id === momentId)
    
    if (momentIndex === -1) return
    
    const moment = moments[momentIndex]
    // 简单实现：每次点击都切换点赞状态，并更新点赞数
    // 实际应该检查用户是否已经点赞
    if (!moment.likedBy) {
      moment.likedBy = []
    }
    
    const userLikeIndex = moment.likedBy.indexOf(userInfo.id)
    if (userLikeIndex === -1) {
      // 点赞
      moment.likedBy.push(userInfo.id)
      moment.likeCount++
      util.showToast('点赞成功')
    } else {
      // 取消点赞
      moment.likedBy.splice(userLikeIndex, 1)
      moment.likeCount--
      util.showToast('已取消点赞')
    }
    
    moments[momentIndex] = moment
    wx.setStorageSync('moments', moments)
    this.setData({ moments: moments })
  },

  goToUserProfile: function (e) {
    const userId = e.currentTarget.dataset.userid
    wx.navigateTo({
      url: `/pages/moment/userProfile/userProfile?id=${userId}`
    })
  },

  handleLogin: function () {
    const that = this
    wx.getUserProfile({
      desc: '用于完善用户资料',
      success: (res) => {
        const userInfo = {
          id: util.generateId(),
          userName: res.userInfo.nickName,
          avatar: res.userInfo.avatarUrl,
          createTime: util.getCurrentTime(),
          posts: 0,
          friends: 0,
          followers: 0
        }
        
        wx.setStorageSync('userInfo', userInfo)
        const app = getApp()
        app.globalData.userInfo = userInfo
        app.globalData.isLoggedIn = true
        app.globalData.userId = userInfo.id
        
        that.setData({
          userInfo: userInfo,
          isLoggedIn: true
        })
        
        util.showToast('登录成功')
      },
      fail: (err) => {
        console.log('获取用户信息失败', err)
        util.showToast('登录失败，请重试')
      }
    })
  }
})
