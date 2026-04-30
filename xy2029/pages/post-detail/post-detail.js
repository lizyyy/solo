const app = getApp()

Page({
  data: {
    postId: null,
    postData: null,
    isFollowed: false,
    isLiked: false,
    comments: [],
    commentText: '',
    replyTo: null
  },

  onLoad: function (options) {
    if (options.id) {
      this.setData({
        postId: options.id
      })
      this.loadPostDetail(options.id)
    }
  },

  loadPostDetail: function (postId) {
    const mockPost = {
      id: postId,
      author: {
        id: 'u1',
        name: '北漂打工人',
        avatar: '👨‍💼'
      },
      tier: '9k',
      content: '今天发工资了，存了2000块，虽然不多，但积少成多嘛！分享一下我在北五环的合租生活，每月房租3500，和室友分摊后其实还能接受。最近在学习理财知识，希望能早日实现财务自由～',
      images: ['🏠', '💴', '📚'],
      tags: ['存钱打卡', '北漂生活', '理财学习'],
      likes: 128,
      comments: 42,
      shares: 15,
      createTime: '2024-01-15 18:30'
    }
    
    const mockComments = [
      {
        id: 'c1',
        name: '攒钱小能手',
        avatar: '👩',
        content: '加油！我也在北漂，一起努力存钱！',
        time: '2小时前',
        likes: 12,
        isLiked: false
      },
      {
        id: 'c2',
        name: '理财小白',
        avatar: '👨',
        content: '同是9k档，请问有什么理财书籍推荐吗？',
        time: '1小时前',
        likes: 8,
        isLiked: false
      }
    ]
    
    this.setData({
      postData: mockPost,
      comments: mockComments
    })
  },

  toggleFollow: function () {
    this.setData({
      isFollowed: !this.data.isFollowed
    })
    
    wx.showToast({
      title: this.data.isFollowed ? '关注成功' : '已取消关注',
      icon: 'none'
    })
  },

  toggleLike: function () {
    const newLiked = !this.data.isLiked
    const postData = this.data.postData
    
    if (newLiked) {
      postData.likes++
    } else {
      postData.likes--
    }
    
    this.setData({
      isLiked: newLiked,
      postData: postData
    })
  },

  sharePost: function () {
    wx.showToast({
      title: '分享成功',
      icon: 'success'
    })
  },

  likeComment: function (e) {
    const id = e.currentTarget.dataset.id
    const comments = this.data.comments.map(item => {
      if (item.id === id) {
        return {
          ...item,
          isLiked: !item.isLiked,
          likes: item.isLiked ? item.likes - 1 : item.likes + 1
        }
      }
      return item
    })
    
    this.setData({
      comments: comments
    })
  },

  replyComment: function (e) {
    const id = e.currentTarget.dataset.id
    const comment = this.data.comments.find(item => item.id === id)
    
    if (comment) {
      this.setData({
        replyTo: comment
      })
    }
  },

  onCommentInput: function (e) {
    this.setData({
      commentText: e.detail.value
    })
  },

  sendComment: function () {
    const { commentText, replyTo, comments } = this.data
    
    if (!commentText.trim()) {
      wx.showToast({
        title: '请输入评论内容',
        icon: 'none'
      })
      return
    }
    
    const newComment = {
      id: 'c' + Date.now(),
      name: '我',
      avatar: '👤',
      content: replyTo ? `@${replyTo.name} ${commentText}` : commentText,
      time: '刚刚',
      likes: 0,
      isLiked: false
    }
    
    this.setData({
      comments: [newComment, ...comments],
      commentText: '',
      replyTo: null
    })
    
    wx.showToast({
      title: '评论成功',
      icon: 'success'
    })
  },

  onShareAppMessage: function () {
    return {
      title: this.data.postData ? this.data.postData.content.substring(0, 30) + '...' : '分享一个帖子',
      path: `/pages/post-detail/post-detail?id=${this.data.postId}`
    }
  }
})
