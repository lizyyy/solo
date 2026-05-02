const { STORAGE_KEYS, getStorageData, setStorageData, generateId, formatDateTime } = require('../../utils/storage.js')

Page({
  data: {
    posts: [],
    showAddModal: false,
    showDetailModal: false,
    currentPost: null,
    newPostTitle: '',
    newPostContent: '',
    newPostTags: '',
    commentInput: '',
    userInfo: {
      id: 'user_current',
      userName: '缝纫爱好者',
      avatar: ''
    }
  },

  onLoad() {
    this.loadPosts()
  },

  onShow() {
    this.loadPosts()
  },

  loadPosts() {
    const posts = getStorageData(STORAGE_KEYS.COMMUNITY_POSTS)
      .sort((a, b) => b.createTime - a.createTime)
    this.setData({ posts })
  },

  showAddPostModal() {
    this.setData({
      showAddModal: true,
      newPostTitle: '',
      newPostContent: '',
      newPostTags: ''
    })
  },

  hideAddModal() {
    this.setData({ showAddModal: false })
  },

  hideDetailModal() {
    this.setData({ showDetailModal: false, currentPost: null })
  },

  onTitleInput(e) {
    this.setData({ newPostTitle: e.detail.value })
  },

  onContentInput(e) {
    this.setData({ newPostContent: e.detail.value })
  },

  onTagsInput(e) {
    this.setData({ newPostTags: e.detail.value })
  },

  submitPost() {
    const { newPostTitle, newPostContent, newPostTags, userInfo } = this.data
    
    if (!newPostTitle.trim()) {
      wx.showToast({ title: '请输入标题', icon: 'none' })
      return
    }
    if (!newPostContent.trim()) {
      wx.showToast({ title: '请输入内容', icon: 'none' })
      return
    }

    const tagsArray = newPostTags.trim() 
      ? newPostTags.split(',').map(t => t.trim()).filter(t => t)
      : []

    const newPost = {
      id: generateId(),
      userId: userInfo.id,
      userName: userInfo.userName,
      avatar: userInfo.avatar,
      title: newPostTitle.trim(),
      content: newPostContent.trim(),
      images: [],
      tags: tagsArray,
      likes: 0,
      comments: 0,
      isLiked: false,
      createTime: Date.now(),
      commentsList: []
    }

    const posts = [newPost, ...this.data.posts]
    setStorageData(STORAGE_KEYS.COMMUNITY_POSTS, posts)
    
    this.setData({ posts, showAddModal: false })
    
    wx.showToast({ title: '发布成功', icon: 'success' })
  },

  viewPostDetail(e) {
    const id = e.currentTarget.dataset.id
    const post = this.data.posts.find(p => p.id === id)
    if (post) {
      this.setData({ currentPost: post, showDetailModal: true, commentInput: '' })
    }
  },

  toggleLike(e) {
    const id = e.currentTarget.dataset.id
    const posts = this.data.posts.map(p => {
      if (p.id === id) {
        return {
          ...p,
          isLiked: !p.isLiked,
          likes: p.isLiked ? p.likes - 1 : p.likes + 1
        }
      }
      return p
    })
    
    setStorageData(STORAGE_KEYS.COMMUNITY_POSTS, posts)
    this.setData({ posts })
    
    if (this.data.currentPost && this.data.currentPost.id === id) {
      const updatedPost = posts.find(p => p.id === id)
      this.setData({ currentPost: updatedPost })
    }
  },

  onCommentInput(e) {
    this.setData({ commentInput: e.detail.value })
  },

  submitComment() {
    const { commentInput, currentPost, userInfo, posts } = this.data
    
    if (!commentInput.trim()) {
      wx.showToast({ title: '请输入评论内容', icon: 'none' })
      return
    }

    const newComment = {
      id: generateId(),
      userId: userInfo.id,
      userName: userInfo.userName,
      avatar: userInfo.avatar,
      content: commentInput.trim(),
      createTime: Date.now()
    }

    const updatedPosts = posts.map(p => {
      if (p.id === currentPost.id) {
        return {
          ...p,
          comments: p.comments + 1,
          commentsList: [...(p.commentsList || []), newComment]
        }
      }
      return p
    })

    setStorageData(STORAGE_KEYS.COMMUNITY_POSTS, updatedPosts)
    
    const updatedPost = updatedPosts.find(p => p.id === currentPost.id)
    this.setData({ 
      posts: updatedPosts, 
      currentPost: updatedPost,
      commentInput: ''
    })
    
    wx.showToast({ title: '评论成功', icon: 'success' })
  },

  formatTime(time) {
    if (!time) return ''
    const date = new Date(time)
    const now = new Date()
    const diff = now - date
    
    if (diff < 60000) return '刚刚'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}天前`
    
    return formatDateTime(time)
  }
})
