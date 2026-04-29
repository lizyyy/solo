const util = require('../../utils/util.js')

Page({
  data: {
    posts: [],
    isLoading: false
  },

  onLoad: function (options) {
    this.loadPosts()
  },

  onShow: function () {
    this.loadPosts()
  },

  onPullDownRefresh: function () {
    this.loadPosts()
    wx.stopPullDownRefresh()
  },

  loadPosts: function () {
    const posts = wx.getStorageSync('treeHolePosts') || []
    this.setData({
      posts: posts.sort((a, b) => new Date(b.createTime) - new Date(a.createTime))
    })
  },

  goToCreatePost: function () {
    wx.navigateTo({
      url: '/pages/treeHole/createPost/createPost'
    })
  },

  goToPostDetail: function (e) {
    const postId = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/treeHole/postDetail/postDetail?id=${postId}`
    })
  }
})
