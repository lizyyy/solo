const util = require('../../utils/util.js')

Page({
  data: {
    userInfo: null,
    isLoggedIn: false,
    userMoments: [],
    userPosts: 0,
    friends: 0,
    followers: 0,
    menuItems: [
      {
        id: 1,
        name: '我的动态',
        icon: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=simple%20icon%20my%20posts%20blue&image_size=square',
        action: 'viewMyMoments'
      },
      {
        id: 2,
        name: '我的收藏',
        icon: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=simple%20icon%20favorite%20blue&image_size=square',
        action: 'viewFavorites'
      },
      {
        id: 3,
        name: '历史测试',
        icon: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=simple%20icon%20history%20test%20blue&image_size=square',
        action: 'viewTestHistory'
      },
      {
        id: 4,
        name: '好友列表',
        icon: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=simple%20icon%20friends%20list%20blue&image_size=square',
        action: 'viewFriends'
      },
      {
        id: 5,
        name: '关于我们',
        icon: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=simple%20icon%20about%20info%20blue&image_size=square',
        action: 'viewAbout'
      }
    ],
    testHistory: []
  },

  onLoad: function (options) {
    this.checkLoginStatus()
  },

  onShow: function () {
    this.checkLoginStatus()
    this.loadUserData()
    this.loadTestHistory()
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

  loadUserData: function () {
    if (!this.data.isLoggedIn) return

    const { userInfo } = this.data
    const moments = wx.getStorageSync('moments') || []
    const userMoments = moments.filter(m => m.userId === userInfo.id)
    
    const friends = wx.getStorageSync('friends_' + userInfo.id) || []
    const followers = wx.getStorageSync('followers_' + userInfo.id) || []
    
    this.setData({
      userMoments: userMoments,
      userPosts: userMoments.length,
      friends: friends.length,
      followers: followers.length
    })
  },

  loadTestHistory: function () {
    const testHistory = wx.getStorageSync('testHistory') || []
    this.setData({ testHistory: testHistory })
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
  },

  handleMenuClick: function (e) {
    const action = e.currentTarget.dataset.action
    
    if (!this.data.isLoggedIn) {
      util.showToast('请先登录')
      return
    }
    
    switch (action) {
      case 'viewMyMoments':
        this.viewMyMoments()
        break
      case 'viewFavorites':
        this.viewFavorites()
        break
      case 'viewTestHistory':
        this.viewTestHistory()
        break
      case 'viewFriends':
        this.viewFriends()
        break
      case 'viewAbout':
        this.viewAbout()
        break
    }
  },

  viewMyMoments: function () {
    util.showToast('查看我的动态功能')
  },

  viewFavorites: function () {
    util.showToast('我的收藏功能')
  },

  viewTestHistory: function () {
    if (this.data.testHistory.length === 0) {
      util.showToast('暂无测试记录')
      return
    }
    wx.navigateTo({
      url: '/pages/anxietyTest/anxietyTest'
    })
  },

  viewFriends: function () {
    util.showToast('好友列表功能')
  },

  viewAbout: function () {
    wx.showModal({
      title: '关于我们',
      content: '高考失利帮 - 一个专注于帮助高考失利者的情绪陪伴平台。\n\n在这里，你可以：\n• 匿名倾诉你的烦恼\n• 进行焦虑自测\n• 与AI聊天获得陪伴\n• 在分享圈交流心得\n\n版本：1.0.0',
      showCancel: false
    })
  },

  handleLogout: function () {
    wx.showModal({
      title: '提示',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync('userInfo')
          const app = getApp()
          app.globalData.userInfo = null
          app.globalData.isLoggedIn = false
          app.globalData.userId = null
          
          this.setData({
            userInfo: null,
            isLoggedIn: false
          })
          
          util.showToast('已退出登录')
        }
      }
    })
  },

  goToMomentDetail: function (e) {
    const momentId = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/moment/momentDetail/momentDetail?id=${momentId}`
    })
  }
})
