const util = require('../../../utils/util.js')

Page({
  data: {
    postId: null,
    post: null,
    comments: [],
    commentContent: '',
    isSubmitting: false,
    showCommentInput: false
  },

  onLoad: function (options) {
    if (options.id) {
      this.setData({ postId: parseInt(options.id) })
      this.loadPostDetail()
      this.loadComments()
    }
  },

  onShow: function () {
    if (this.data.postId) {
      this.loadPostDetail()
      this.loadComments()
    }
  },

  loadPostDetail: function () {
    const posts = wx.getStorageSync('treeHolePosts') || []
    const post = posts.find(p => p.id === this.data.postId)
    
    if (post) {
      this.setData({ post: post })
    } else {
      util.showToast('帖子不存在')
      setTimeout(() => {
        wx.navigateBack()
      }, 1500)
    }
  },

  loadComments: function () {
    const comments = wx.getStorageSync(`treeHoleComments_${this.data.postId}`) || []
    this.setData({
      comments: comments.sort((a, b) => new Date(b.createTime) - new Date(a.createTime))
    })
  },

  onCommentInput: function (e) {
    this.setData({
      commentContent: e.detail.value
    })
  },

  submitComment: function () {
    const { commentContent, isSubmitting, postId } = this.data
    
    if (isSubmitting) return
    
    if (!commentContent.trim()) {
      util.showToast('请输入评论内容')
      return
    }
    
    this.setData({ isSubmitting: true })
    util.showLoading('发布中...')
    
    setTimeout(() => {
      const comments = wx.getStorageSync(`treeHoleComments_${postId}`) || []
      const newComment = {
        id: util.generateId(),
        postId: postId,
        content: commentContent.trim(),
        createTime: util.getCurrentTime(),
        isAnonymous: true
      }
      
      comments.unshift(newComment)
      wx.setStorageSync(`treeHoleComments_${postId}`, comments)
      
      // 更新帖子的评论数
      const posts = wx.getStorageSync('treeHolePosts') || []
      const postIndex = posts.findIndex(p => p.id === postId)
      if (postIndex > -1) {
        posts[postIndex].commentCount = comments.length
        wx.setStorageSync('treeHolePosts', posts)
      }
      
      util.hideLoading()
      util.showToast('评论成功')
      
      this.setData({
        comments: comments,
        commentContent: '',
        isSubmitting: false,
        showCommentInput: false
      })
      
      this.loadPostDetail()
    }, 800)
  },

  toggleCommentInput: function () {
    this.setData({
      showCommentInput: !this.data.showCommentInput
    })
  },

  goBack: function () {
    wx.navigateBack()
  }
})
