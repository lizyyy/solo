const util = require('../../../utils/util.js')

Page({
  data: {
    momentId: null,
    moment: null,
    userInfo: null,
    isLoggedIn: false,
    commentContent: '',
    isSubmitting: false,
    showCommentInput: false
  },

  onLoad: function (options) {
    if (options.id) {
      this.setData({ momentId: parseInt(options.id) })
      this.loadMomentDetail()
    }
    this.checkLoginStatus()
  },

  onShow: function () {
    if (this.data.momentId) {
      this.loadMomentDetail()
    }
    this.checkLoginStatus()
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

  loadMomentDetail: function () {
    const moments = wx.getStorageSync('moments') || []
    const moment = moments.find(m => m.id === this.data.momentId)
    
    if (moment) {
      this.setData({ moment: moment })
    } else {
      util.showToast('动态不存在')
      setTimeout(() => {
        wx.navigateBack()
      }, 1500)
    }
  },

  toggleLike: function () {
    if (!this.data.isLoggedIn) {
      util.showToast('请先登录')
      return
    }
    
    const { moment, momentId, userInfo } = this.data
    const moments = wx.getStorageSync('moments') || []
    const momentIndex = moments.findIndex(m => m.id === momentId)
    
    if (momentIndex === -1) return
    
    const targetMoment = moments[momentIndex]
    if (!targetMoment.likedBy) {
      targetMoment.likedBy = []
    }
    
    const userLikeIndex = targetMoment.likedBy.indexOf(userInfo.id)
    if (userLikeIndex === -1) {
      // 点赞
      targetMoment.likedBy.push(userInfo.id)
      targetMoment.likeCount++
      util.showToast('点赞成功')
    } else {
      // 取消点赞
      targetMoment.likedBy.splice(userLikeIndex, 1)
      targetMoment.likeCount--
      util.showToast('已取消点赞')
    }
    
    moments[momentIndex] = targetMoment
    wx.setStorageSync('moments', moments)
    this.setData({ moment: targetMoment })
  },

  onCommentInput: function (e) {
    this.setData({
      commentContent: e.detail.value
    })
  },

  submitComment: function () {
    if (!this.data.isLoggedIn) {
      util.showToast('请先登录')
      return
    }
    
    const { commentContent, isSubmitting, momentId, userInfo, moment } = this.data
    
    if (isSubmitting) return
    
    if (!commentContent.trim()) {
      util.showToast('请输入评论内容')
      return
    }
    
    this.setData({ isSubmitting: true })
    util.showLoading('发布中...')
    
    setTimeout(() => {
      const moments = wx.getStorageSync('moments') || []
      const momentIndex = moments.findIndex(m => m.id === momentId)
      
      if (momentIndex === -1) {
        util.hideLoading()
        util.showToast('动态不存在')
        this.setData({ isSubmitting: false })
        return
      }
      
      const newComment = {
        id: util.generateId(),
        momentId: momentId,
        userId: userInfo.id,
        userName: userInfo.userName,
        avatar: userInfo.avatar,
        content: commentContent.trim(),
        createTime: util.getCurrentTime()
      }
      
      if (!moments[momentIndex].comments) {
        moments[momentIndex].comments = []
      }
      
      moments[momentIndex].comments.unshift(newComment)
      moments[momentIndex].commentCount = moments[momentIndex].comments.length
      
      wx.setStorageSync('moments', moments)
      
      util.hideLoading()
      util.showToast('评论成功')
      
      this.setData({
        moment: moments[momentIndex],
        commentContent: '',
        isSubmitting: false,
        showCommentInput: false
      })
    }, 800)
  },

  toggleCommentInput: function () {
    if (!this.data.isLoggedIn) {
      util.showToast('请先登录')
      return
    }
    this.setData({
      showCommentInput: !this.data.showCommentInput
    })
  },

  goToUserProfile: function (e) {
    const userId = e.currentTarget.dataset.userid
    wx.navigateTo({
      url: `/pages/moment/userProfile/userProfile?id=${userId}`
    })
  },

  shareMoment: function () {
    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline']
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
