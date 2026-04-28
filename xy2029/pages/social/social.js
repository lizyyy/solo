const app = getApp()
const { mockPosts, categories } = require('../../data/social.js')
const { getSalaryTier } = require('../../utils/util.js')

Page({
  data: {
    categories: categories,
    currentCategory: 'all',
    filterType: 'all',
    posts: [],
    currentUserId: null
  },

  onLoad: function () {
    this.initData()
    this.checkUser()
  },

  onShow: function () {
    this.loadPosts()
  },

  initData: function () {
    this.setData({
      categories: categories
    })
  },

  checkUser: function () {
    const userInfo = app.globalData.userInfo
    if (userInfo) {
      this.setData({
        currentUserId: userInfo.id || 'current_user'
      })
    }
  },

  loadPosts: function () {
    let posts = [...mockPosts]
    
    if (this.data.currentCategory !== 'all') {
      posts = posts.filter(post => post.category === this.data.currentCategory)
    }

    if (this.data.filterType === 'sameTier') {
      const userInfo = app.globalData.userInfo
      if (userInfo && userInfo.salary) {
        const userTier = getSalaryTier(userInfo.salary)
        posts = posts.filter(post => post.user.tier === userTier)
      }
    } else if (this.data.filterType === 'friends') {
      posts = posts.filter(post => post.user.isFriend)
    }

    this.setData({
      posts: posts
    })
  },

  selectCategory: function (e) {
    const category = e.currentTarget.dataset.category
    this.setData({
      currentCategory: category
    })
    this.loadPosts()
  },

  switchFilter: function (e) {
    const type = e.currentTarget.dataset.type
    this.setData({
      filterType: type
    })
    this.loadPosts()
  },

  goToPostDetail: function (e) {
    const post = e.currentTarget.dataset.post
    wx.navigateTo({
      url: `/pages/social/post-detail/post-detail?id=${post.id}`
    })
  },

  goToCreatePost: function () {
    const userInfo = app.globalData.userInfo
    if (!userInfo) {
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      })
      return
    }
    wx.navigateTo({
      url: '/pages/social/create-post/create-post'
    })
  },

  goToUserProfile: function (e) {
    const user = e.currentTarget.dataset.user
    wx.showToast({
      title: '用户主页功能开发中',
      icon: 'none'
    })
  },

  toggleLike: function (e) {
    const index = e.currentTarget.dataset.index
    const posts = this.data.posts
    const post = posts[index]
    
    if (post.isLiked) {
      post.likes--
      post.isLiked = false
    } else {
      post.likes++
      post.isLiked = true
    }
    
    this.setData({
      posts: posts
    })
  },

  sharePost: function (e) {
    const index = e.currentTarget.dataset.index
    const posts = this.data.posts
    posts[index].shares++
    
    this.setData({
      posts: posts
    })

    wx.showToast({
      title: '分享成功',
      icon: 'success'
    })
  },

  addFriend: function (e) {
    const index = e.currentTarget.dataset.index
    const posts = this.data.posts
    posts[index].user.isFriend = true
    
    this.setData({
      posts: posts
    })

    wx.showToast({
      title: '关注成功',
      icon: 'success'
    })
  },

  onShareAppMessage: function () {
    return {
      title: '工资等级生存 - 社交圈，和同薪资的人交流',
      path: '/pages/social/social'
    }
  }
})
