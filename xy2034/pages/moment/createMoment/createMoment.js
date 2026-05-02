const util = require('../../../utils/util.js')

Page({
  data: {
    content: '',
    wordCount: 0,
    maxWords: 500,
    isPublic: true,
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

  togglePrivacy: function (e) {
    const isPublic = e.currentTarget.dataset.public === 'true'
    this.setData({
      isPublic: isPublic
    })
  },

  submitMoment: function () {
    const { content, isSubmitting, isPublic, userInfo } = this.data
    
    if (isSubmitting) return
    
    if (!content.trim()) {
      util.showToast('请输入心情内容')
      return
    }
    
    if (content.length < 5) {
      util.showToast('内容至少需要5个字')
      return
    }
    
    this.setData({ isSubmitting: true })
    util.showLoading('发布中...')
    
    setTimeout(() => {
      const moments = wx.getStorageSync('moments') || []
      const newMoment = {
        id: util.generateId(),
        userId: userInfo.id,
        userName: userInfo.userName,
        avatar: userInfo.avatar,
        content: content.trim(),
        isPublic: isPublic,
        createTime: util.getCurrentTime(),
        likeCount: 0,
        commentCount: 0,
        comments: [],
        likedBy: []
      }
      
      moments.unshift(newMoment)
      wx.setStorageSync('moments', moments)
      
      // 更新用户的发帖数
      const users = wx.getStorageSync('users') || []
      const userIndex = users.findIndex(u => u.id === userInfo.id)
      if (userIndex > -1) {
        users[userIndex].posts++
      } else {
        users.push({
          ...userInfo,
          posts: 1
        })
      }
      wx.setStorageSync('users', users)
      
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
