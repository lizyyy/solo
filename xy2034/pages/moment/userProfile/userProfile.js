const util = require('../../../utils/util.js')

Page({
  data: {
    userId: null,
    user: null,
    currentUser: null,
    isLoggedIn: false,
    isFriend: false,
    isLoading: false,
    userMoments: []
  },

  onLoad: function (options) {
    if (options.id) {
      this.setData({ userId: parseInt(options.id) })
      this.loadUserInfo()
      this.loadUserMoments()
    }
    this.checkLoginStatus()
  },

  onShow: function () {
    this.checkLoginStatus()
    if (this.data.userId) {
      this.loadUserInfo()
      this.loadUserMoments()
    }
  },

  checkLoginStatus: function () {
    const app = getApp()
    if (app.globalData.isLoggedIn) {
      this.setData({
        currentUser: app.globalData.userInfo,
        isLoggedIn: true
      })
      this.checkFriendStatus()
    } else {
      this.setData({
        currentUser: null,
        isLoggedIn: false,
        isFriend: false
      })
    }
  },

  loadUserInfo: function () {
    const users = wx.getStorageSync('users') || []
    const user = users.find(u => u.id === this.data.userId)
    
    if (user) {
      this.setData({ user: user })
    } else {
      // 如果用户不存在，创建一个默认用户
      const defaultUser = {
        id: this.data.userId,
        userName: '用户' + this.data.userId,
        avatar: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=simple%20cartoon%20avatar%20default&image_size=square',
        createTime: util.getCurrentTime(),
        posts: 0,
        friends: 0,
        followers: 0
      }
      this.setData({ user: defaultUser })
    }
  },

  loadUserMoments: function () {
    const moments = wx.getStorageSync('moments') || []
    // 只显示该用户的公开动态
    const userMoments = moments.filter(m => m.userId === this.data.userId && m.isPublic)
    this.setData({
      userMoments: userMoments.sort((a, b) => new Date(b.createTime) - new Date(a.createTime))
    })
  },

  checkFriendStatus: function () {
    if (!this.data.isLoggedIn || !this.data.currentUser) return
    
    const friends = wx.getStorageSync(`friends_${this.data.currentUser.id}`) || []
    const isFriend = friends.some(f => f.id === this.data.userId)
    this.setData({ isFriend: isFriend })
  },

  toggleFriend: function () {
    if (!this.data.isLoggedIn) {
      util.showToast('请先登录')
      return
    }
    
    if (!this.data.currentUser) {
      util.showToast('请先登录')
      return
    }
    
    const { userId, currentUser, isFriend } = this.data
    
    let friends = wx.getStorageSync(`friends_${currentUser.id}`) || []
    
    if (isFriend) {
      // 取消关注
      friends = friends.filter(f => f.id !== userId)
      util.showToast('已取消关注')
    } else {
      // 添加关注
      friends.push({
        id: userId,
        userName: this.data.user.userName,
        avatar: this.data.user.avatar,
        createTime: util.getCurrentTime()
      })
      util.showToast('关注成功')
    }
    
    wx.setStorageSync(`friends_${currentUser.id}`, friends)
    this.setData({ isFriend: !isFriend })
  },

  goToMomentDetail: function (e) {
    const momentId = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/moment/momentDetail/momentDetail?id=${momentId}`
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
          currentUser: userInfo,
          isLoggedIn: true
        })
        
        that.checkFriendStatus()
        util.showToast('登录成功')
      },
      fail: (err) => {
        console.log('获取用户信息失败', err)
        util.showToast('登录失败，请重试')
      }
    })
  }
})
