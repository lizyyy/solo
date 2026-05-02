const util = require('../../../utils/util.js')

Page({
  data: {
    title: '',
    content: '',
    titleWordCount: 0,
    contentWordCount: 0,
    maxTitleWords: 50,
    maxContentWords: 1000,
    categories: ['亲戚', '学历焦虑', '家庭', '其他'],
    selectedCategory: '其他',
    isSubmitting: false,
    userInfo: null
  },

  onLoad: function (options) {
    this.checkLoginStatus()
  },

  checkLoginStatus: function () {
    const app = getApp()
    if (app.globalData.isLoggedIn) {
      this.setData({
        userInfo: app.globalData.userInfo
      })
    } else {
      util.showToast('请先登录')
      setTimeout(() => {
        wx.navigateBack()
      }, 1500)
    }
  },

  onTitleInput: function (e) {
    const title = e.detail.value
    const wordCount = title.length
    
    if (wordCount > this.data.maxTitleWords) {
      util.showToast('标题最多50个字')
      return
    }
    
    this.setData({
      title: title,
      titleWordCount: wordCount
    })
  },

  onContentInput: function (e) {
    const content = e.detail.value
    const wordCount = content.length
    
    if (wordCount > this.data.maxContentWords) {
      util.showToast('内容最多1000个字')
      return
    }
    
    this.setData({
      content: content,
      contentWordCount: wordCount
    })
  },

  selectCategory: function (e) {
    const category = e.currentTarget.dataset.category
    this.setData({
      selectedCategory: category
    })
  },

  submitComplaint: function () {
    const { title, content, selectedCategory, isSubmitting, userInfo } = this.data
    
    if (isSubmitting) return
    
    if (!title.trim()) {
      util.showToast('请输入标题')
      return
    }
    
    if (title.length < 5) {
      util.showToast('标题至少需要5个字')
      return
    }
    
    if (!content.trim()) {
      util.showToast('请输入吐槽内容')
      return
    }
    
    if (content.length < 10) {
      util.showToast('内容至少需要10个字')
      return
    }
    
    this.setData({ isSubmitting: true })
    util.showLoading('发布中...')
    
    setTimeout(() => {
      const complaints = wx.getStorageSync('complaints') || []
      const newComplaint = {
        id: util.generateId(),
        userId: userInfo.id,
        userName: userInfo.userName,
        avatar: userInfo.avatar,
        title: title.trim(),
        content: content.trim(),
        category: selectedCategory,
        createTime: util.getCurrentTime(),
        likeCount: 0,
        commentCount: 0,
        comments: [],
        likedBy: []
      }
      
      complaints.unshift(newComplaint)
      wx.setStorageSync('complaints', complaints)
      
      util.hideLoading()
      util.showToast('发布成功')
      
      setTimeout(() => {
        wx.navigateBack()
      }, 1500)
      
      this.setData({ isSubmitting: false })
    }, 800)
  },

  goBack: function () {
    if (this.data.title.trim() || this.data.content.trim()) {
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
