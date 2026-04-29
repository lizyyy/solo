const util = require('../../../utils/util.js')

Page({
  data: {
    complaintId: null,
    complaint: null,
    userInfo: null,
    isLoggedIn: false,
    commentContent: '',
    isSubmitting: false,
    showCommentInput: false
  },

  onLoad: function (options) {
    if (options.id) {
      this.setData({ complaintId: parseInt(options.id) })
      this.loadComplaintDetail()
    }
    this.checkLoginStatus()
  },

  onShow: function () {
    if (this.data.complaintId) {
      this.loadComplaintDetail()
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

  loadComplaintDetail: function () {
    const complaints = wx.getStorageSync('complaints') || []
    const complaint = complaints.find(c => c.id === this.data.complaintId)
    
    if (complaint) {
      this.setData({ complaint: complaint })
    } else {
      util.showToast('吐槽不存在')
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
    
    const { complaint, complaintId, userInfo } = this.data
    const complaints = wx.getStorageSync('complaints') || []
    const complaintIndex = complaints.findIndex(c => c.id === complaintId)
    
    if (complaintIndex === -1) return
    
    const targetComplaint = complaints[complaintIndex]
    if (!targetComplaint.likedBy) {
      targetComplaint.likedBy = []
    }
    
    const userLikeIndex = targetComplaint.likedBy.indexOf(userInfo.id)
    if (userLikeIndex === -1) {
      targetComplaint.likedBy.push(userInfo.id)
      targetComplaint.likeCount++
      util.showToast('点赞成功')
    } else {
      targetComplaint.likedBy.splice(userLikeIndex, 1)
      targetComplaint.likeCount--
      util.showToast('已取消点赞')
    }
    
    complaints[complaintIndex] = targetComplaint
    wx.setStorageSync('complaints', complaints)
    this.setData({ complaint: targetComplaint })
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
    
    const { commentContent, isSubmitting, complaintId, userInfo } = this.data
    
    if (isSubmitting) return
    
    if (!commentContent.trim()) {
      util.showToast('请输入评论内容')
      return
    }
    
    this.setData({ isSubmitting: true })
    util.showLoading('发布中...')
    
    setTimeout(() => {
      const complaints = wx.getStorageSync('complaints') || []
      const complaintIndex = complaints.findIndex(c => c.id === complaintId)
      
      if (complaintIndex === -1) {
        util.hideLoading()
        util.showToast('吐槽不存在')
        this.setData({ isSubmitting: false })
        return
      }
      
      const newComment = {
        id: util.generateId(),
        complaintId: complaintId,
        userId: userInfo.id,
        userName: userInfo.userName,
        avatar: userInfo.avatar,
        content: commentContent.trim(),
        createTime: util.getCurrentTime()
      }
      
      if (!complaints[complaintIndex].comments) {
        complaints[complaintIndex].comments = []
      }
      
      complaints[complaintIndex].comments.unshift(newComment)
      complaints[complaintIndex].commentCount = complaints[complaintIndex].comments.length
      
      wx.setStorageSync('complaints', complaints)
      
      util.hideLoading()
      util.showToast('评论成功')
      
      this.setData({
        complaint: complaints[complaintIndex],
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
    if (!userId) return
    
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
