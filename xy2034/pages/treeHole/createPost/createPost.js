const util = require('../../../utils/util.js')

Page({
  data: {
    content: '',
    wordCount: 0,
    maxWords: 500,
    isSubmitting: false
  },

  onLoad: function (options) {
    
  },

  onContentInput: function (e) {
    const content = e.detail.value
    const wordCount = content.length
    
    if (wordCount > this.data.maxWords) {
      util.showToast('最多输入500个字')
      return
    }
    
    this.setData({
      content: content,
      wordCount: wordCount
    })
  },

  submitPost: function () {
    const { content, isSubmitting } = this.data
    
    if (isSubmitting) return
    
    if (!content.trim()) {
      util.showToast('请输入倾诉内容')
      return
    }
    
    if (content.length < 10) {
      util.showToast('内容至少需要10个字')
      return
    }
    
    this.setData({ isSubmitting: true })
    util.showLoading('发布中...')
    
    setTimeout(() => {
      const posts = wx.getStorageSync('treeHolePosts') || []
      const newPost = {
        id: util.generateId(),
        content: content.trim(),
        createTime: util.getCurrentTime(),
        commentCount: 0,
        isAnonymous: true
      }
      
      posts.unshift(newPost)
      wx.setStorageSync('treeHolePosts', posts)
      
      util.hideLoading()
      util.showToast('发布成功')
      
      setTimeout(() => {
        wx.navigateBack()
      }, 1500)
      
      this.setData({ isSubmitting: false })
    }, 800)
  },

  goBack: function () {
    if (this.data.content.trim()) {
      util.confirmDialog('确定要放弃编辑吗？已输入的内容将不会保存。').then((confirmed) => {
        if (confirmed) {
          wx.navigateBack()
        }
      })
    } else {
      wx.navigateBack()
    }
  }
})
