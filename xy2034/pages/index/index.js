const util = require('../../utils/util.js')

Page({
  data: {
    userInfo: null,
    isLoggedIn: false,
    functionModules: [
      {
        id: 1,
        name: '情绪树洞',
        icon: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=simple%20icon%20tree%20hole%20blue%20color&image_size=square',
        description: '匿名倾诉，共情感知',
        path: '/pages/treeHole/treeHole'
      },
      {
        id: 2,
        name: '焦虑自测',
        icon: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=simple%20icon%20mental%20health%20test%20blue%20color&image_size=square',
        description: '了解自己，科学疏导',
        path: '/pages/anxietyTest/anxietyTest'
      },
      {
        id: 3,
        name: '情绪陪伴',
        icon: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=simple%20icon%20chat%20support%20blue%20color&image_size=square',
        description: 'AI陪伴，随时倾诉',
        path: '/pages/aiChat/aiChat'
      },
      {
        id: 4,
        name: '避雷吐槽',
        icon: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=simple%20icon%20complain%20release%20blue%20color&image_size=square',
        description: '释放情绪，轻松自在',
        path: '/pages/complaint/complaint'
      },
      {
        id: 5,
        name: '解压游戏',
        icon: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=simple%20icon%20game%20stress%20relief%20blue%20color&image_size=square',
        description: '点击解压，释放压力',
        path: '/pages/clickGame/clickGame'
      },
      {
        id: 6,
        name: '情绪涂鸦',
        icon: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=simple%20icon%20doodle%20art%20blue%20color&image_size=square',
        description: '随手画画，发泄情绪',
        path: '/pages/doodle/doodle'
      },
      {
        id: 7,
        name: '深夜治愈',
        icon: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=simple%20icon%20moon%20healing%20blue%20color&image_size=square',
        description: '定时推送，温暖人心',
        path: '/pages/push/push'
      }
    ]
  },

  onLoad: function (options) {
    this.checkLoginStatus()
  },

  onShow: function () {
    this.checkLoginStatus()
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

  goToModule: function (e) {
    const path = e.currentTarget.dataset.path
    wx.navigateTo({
      url: path
    })
  },

  goToLogin: function () {
    if (!this.data.isLoggedIn) {
      this.handleLogin()
    }
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
