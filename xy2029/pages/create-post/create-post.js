const app = getApp()
const { getSalaryTier } = require('../../utils/util.js')

Page({
  data: {
    categories: [
      { id: 'life', name: '日常', icon: '🏠' },
      { id: 'savings', name: '存钱', icon: '💰' },
      { id: 'food', name: '美食', icon: '🍜' },
      { id: 'rent', name: '租房', icon: '🏢' },
      { id: 'side', name: '副业', icon: '🛠️' },
      { id: 'clothing', name: '穿搭', icon: '👗' }
    ],
    selectedCategory: 'life',
    postContent: '',
    selectedImages: [],
    suggestedTags: ['打工人', '北漂', '沪漂', '存钱打卡', '省钱攻略', '合租生活', '副业赚钱'],
    selectedTags: [],
    customTag: '',
    showSalary: true,
    showLocation: true
  },

  onLoad: function () {
    
  },

  selectCategory: function (e) {
    const category = e.currentTarget.dataset.category
    this.setData({
      selectedCategory: category
    })
  },

  onContentInput: function (e) {
    this.setData({
      postContent: e.detail.value
    })
  },

  addImage: function () {
    const { selectedImages } = this.data
    if (selectedImages.length >= 9) {
      wx.showToast({
        title: '最多添加9张图片',
        icon: 'none'
      })
      return
    }
    
    const mockImages = ['📷', '🖼️', '🌆', '🍔', '🏠', '💼', '🎨', '🚴', '✈️']
    const availableImages = mockImages.filter(img => !selectedImages.includes(img))
    
    if (availableImages.length > 0) {
      const randomIndex = Math.floor(Math.random() * availableImages.length)
      selectedImages.push(availableImages[randomIndex])
      this.setData({
        selectedImages: selectedImages
      })
    }
  },

  removeImage: function (e) {
    const index = e.currentTarget.dataset.index
    const { selectedImages } = this.data
    selectedImages.splice(index, 1)
    this.setData({
      selectedImages: selectedImages
    })
  },

  toggleTag: function (e) {
    const tag = e.currentTarget.dataset.tag
    let { selectedTags } = this.data
    
    const index = selectedTags.indexOf(tag)
    if (index > -1) {
      selectedTags.splice(index, 1)
    } else {
      if (selectedTags.length < 5) {
        selectedTags.push(tag)
      } else {
        wx.showToast({
          title: '最多选择5个标签',
          icon: 'none'
        })
        return
      }
    }
    
    this.setData({
      selectedTags: selectedTags
    })
  },

  onTagInput: function (e) {
    this.setData({
      customTag: e.detail.value
    })
  },

  addCustomTag: function (e) {
    const { customTag, selectedTags, suggestedTags } = this.data
    
    if (!customTag.trim()) return
    
    const tag = customTag.trim()
    if (selectedTags.includes(tag)) {
      wx.showToast({
        title: '该标签已添加',
        icon: 'none'
      })
      return
    }
    
    if (selectedTags.length >= 5) {
      wx.showToast({
        title: '最多选择5个标签',
        icon: 'none'
      })
      return
    }
    
    selectedTags.push(tag)
    
    if (!suggestedTags.includes(tag)) {
      suggestedTags.unshift(tag)
    }
    
    this.setData({
      selectedTags: selectedTags,
      suggestedTags: suggestedTags,
      customTag: ''
    })
  },

  toggleShowSalary: function () {
    this.setData({
      showSalary: !this.data.showSalary
    })
  },

  toggleShowLocation: function () {
    this.setData({
      showLocation: !this.data.showLocation
    })
  },

  saveDraft: function () {
    const { postContent } = this.data
    
    if (!postContent.trim()) {
      wx.showToast({
        title: '请输入内容',
        icon: 'none'
      })
      return
    }
    
    wx.showToast({
      title: '已保存到草稿',
      icon: 'success'
    })
  },

  publishPost: function () {
    const { postContent, selectedCategory, selectedTags } = this.data
    
    if (!postContent.trim()) {
      wx.showToast({
        title: '请输入内容',
        icon: 'none'
      })
      return
    }
    
    wx.showLoading({
      title: '发布中...',
      mask: true
    })
    
    setTimeout(() => {
      wx.hideLoading()
      wx.showToast({
        title: '发布成功',
        icon: 'success',
        success: () => {
          setTimeout(() => {
            wx.navigateBack()
          }, 1500)
        }
      })
    }, 1000)
  },

  onShareAppMessage: function () {
    return {
      title: '分享打工人的真实生活',
      path: '/pages/index/index'
    }
  }
})
