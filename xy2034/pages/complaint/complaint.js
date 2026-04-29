const util = require('../../utils/util.js')

Page({
  data: {
    complaints: [],
    categories: ['全部', '亲戚', '学历焦虑', '家庭', '其他'],
    selectedCategory: '全部',
    userInfo: null,
    isLoggedIn: false
  },

  onLoad: function (options) {
    this.checkLoginStatus()
    this.loadComplaints()
  },

  onShow: function () {
    this.checkLoginStatus()
    this.loadComplaints()
  },

  onPullDownRefresh: function () {
    this.loadComplaints()
    wx.stopPullDownRefresh()
  },

  checkLoginStatus: function () {
    const app = getApp()
    if (app.globalData.isLoggedIn) {
      this.setData({
        userInfo: app.globalData.userInfo,
        isLoggedIn: true
      })
    }
  },

  loadComplaints: function () {
    let complaints = wx.getStorageSync('complaints') || []
    
    // 按分类筛选
    if (this.data.selectedCategory !== '全部') {
      complaints = complaints.filter(c => c.category === this.data.selectedCategory)
    }
    
    this.setData({
      complaints: complaints.sort((a, b) => new Date(b.createTime) - new Date(a.createTime))
    })
  },

  selectCategory: function (e) {
    const category = e.currentTarget.dataset.category
    this.setData({ selectedCategory: category })
    this.loadComplaints()
  },

  goToCreateComplaint: function () {
    if (!this.data.isLoggedIn) {
      util.showToast('请先登录')
      return
    }
    wx.navigateTo({
      url: '/pages/complaint/createComplaint/createComplaint'
    })
  },

  goToComplaintDetail: function (e) {
    const complaintId = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/complaint/complaintDetail/complaintDetail?id=${complaintId}`
    })
  },

  toggleLike: function (e) {
    if (!this.data.isLoggedIn) {
      util.showToast('请先登录')
      return
    }
    
    const complaintId = e.currentTarget.dataset.id
    const { complaints, userInfo } = this.data
    const complaintIndex = complaints.findIndex(c => c.id === complaintId)
    
    if (complaintIndex === -1) return
    
    const complaint = complaints[complaintIndex]
    if (!complaint.likedBy) {
      complaint.likedBy = []
    }
    
    const userLikeIndex = complaint.likedBy.indexOf(userInfo.id)
    if (userLikeIndex === -1) {
      // 点赞
      complaint.likedBy.push(userInfo.id)
      complaint.likeCount++
      util.showToast('点赞成功')
    } else {
      // 取消点赞
      complaint.likedBy.splice(userLikeIndex, 1)
      complaint.likeCount--
      util.showToast('已取消点赞')
    }
    
    // 更新存储
    const allComplaints = wx.getStorageSync('complaints') || []
    const allIndex = allComplaints.findIndex(c => c.id === complaintId)
    if (allIndex > -1) {
      allComplaints[allIndex] = complaint
      wx.setStorageSync('complaints', allComplaints)
    }
    
    complaints[complaintIndex] = complaint
    this.setData({ complaints: complaints })
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
