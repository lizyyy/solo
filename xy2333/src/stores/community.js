import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { generateId } from '../utils/helpers'
import { useUserStore } from './user'

export const useCommunityStore = defineStore('community', () => {
  // State
  const posts = ref([])
  const currentPost = ref(null)

  // Getters
  const latestPosts = computed(() => {
    return [...posts.value].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  })

  const hotPosts = computed(() => {
    return [...posts.value]
      .sort((a, b) => {
        const scoreA = a.likes + a.comments.length * 2
        const scoreB = b.likes + b.comments.length * 2
        return scoreB - scoreA
      })
  })

  // Actions
  function initializePosts() {
    if (posts.value.length === 0) {
      const savedPosts = localStorage.getItem('communityPosts')
      if (savedPosts) {
        posts.value = JSON.parse(savedPosts)
      } else {
        // 初始化示例数据
        posts.value = [
          {
            id: 'p001',
            title: '感谢王师傅帮我修好水龙头！',
            content: '昨天家里厨房的水龙头突然漏水，关都关不住，急死我了！在邻里互助帮上发了求助，王师傅很快就接单了，不到半小时就上门了，技术非常专业，很快就修好了。收费也很合理，真心推荐！👍',
            images: [],
            authorId: 'u001',
            likes: 24,
            likedBy: ['u002', 'u003'],
            comments: [
              {
                id: 'c001',
                content: '王师傅确实厉害，我家空调也是他修的！',
                authorId: 'u002',
                createdAt: new Date(Date.now() - 3600000).toISOString()
              },
              {
                id: 'c002',
                content: '我也遇到过同样的问题，幸好有这个平台',
                authorId: 'u004',
                createdAt: new Date(Date.now() - 1800000).toISOString()
              }
            ],
            category: 'story',
            tags: ['互助故事', '感谢', '王师傅'],
            createdAt: new Date(Date.now() - 7200000).toISOString(),
            updatedAt: new Date(Date.now() - 7200000).toISOString()
          },
          {
            id: 'p002',
            title: '周末小区花园烧烤聚会，欢迎大家参加！',
            content: '各位邻居好！我是2号楼的李阿姨。这周六下午3点，我们计划在小区中心花园组织一场烧烤聚会，大家可以一起聊聊天，增进邻里感情。有兴趣的邻居可以在评论区报名，每人带一道自己拿手的菜就行！😄',
            images: [],
            authorId: 'u002',
            likes: 42,
            likedBy: ['u001', 'u003', 'u004'],
            comments: [
              {
                id: 'c003',
                content: '李阿姨我报名！我带红烧肉！',
                authorId: 'u001',
                createdAt: new Date(Date.now() - 7200000).toISOString()
              },
              {
                id: 'c004',
                content: '我也去！我带水果拼盘',
                authorId: 'u003',
                createdAt: new Date(Date.now() - 5400000).toISOString()
              },
              {
                id: 'c005',
                content: '太好了，终于有机会认识邻居了！',
                authorId: 'u004',
                createdAt: new Date(Date.now() - 3600000).toISOString()
              }
            ],
            category: 'activity',
            tags: ['社区活动', '烧烤', '聚会'],
            createdAt: new Date(Date.now() - 86400000).toISOString(),
            updatedAt: new Date(Date.now() - 86400000).toISOString()
          },
          {
            id: 'p003',
            title: '【重要通知】小区将于本周六进行停水检修',
            content: '各位居民：\n\n接到自来水公司通知，为保障夏季供水安全，小区将于本周六（6月15日）上午8:00至下午5:00进行停水检修，请大家提前做好储水准备。\n\n停水范围：整个小区\n\n给大家带来的不便敬请谅解！如有紧急情况请联系物业：12345678',
            images: [],
            authorId: 'u004',
            likes: 89,
            likedBy: ['u001', 'u002', 'u003'],
            comments: [
              {
                id: 'c006',
                content: '谢谢通知！幸好提前知道了',
                authorId: 'u001',
                createdAt: new Date(Date.now() - 43200000).toISOString()
              }
            ],
            category: 'notice',
            tags: ['通知', '停水', '物业'],
            createdAt: new Date(Date.now() - 172800000).toISOString(),
            updatedAt: new Date(Date.now() - 172800000).toISOString()
          },
          {
            id: 'p004',
            title: '分享一下我的养花心得',
            content: '大家好！我是3号楼的王师傅，平时喜欢养花。最近我家的绿萝长得特别好，想和大家分享一下我的小经验：\n\n1. 绿萝喜欢散射光，不要放在阳光下直射\n2. 浇水要见干见湿，不要天天浇\n3. 可以用稀释的啤酒擦叶子，会更绿更亮\n\n大家有什么养花的问题也可以问我，一起交流！🌱',
            images: [],
            authorId: 'u003',
            likes: 31,
            likedBy: ['u002'],
            comments: [
              {
                id: 'c007',
                content: '学到了！我家绿萝总是黄叶',
                authorId: 'u002',
                createdAt: new Date(Date.now() - 21600000).toISOString()
              }
            ],
            category: 'life',
            tags: ['养花', '生活分享', '经验'],
            createdAt: new Date(Date.now() - 259200000).toISOString(),
            updatedAt: new Date(Date.now() - 259200000).toISOString()
          }
        ]
        localStorage.setItem('communityPosts', JSON.stringify(posts.value))
      }
    }
  }

  function createPost(postData) {
    const userStore = useUserStore()
    
    if (!userStore.isLoggedIn) {
      return { success: false, message: '请先登录' }
    }
    
    const newPost = {
      id: generateId(),
      title: postData.title,
      content: postData.content,
      images: postData.images || [],
      authorId: userStore.currentUser.id,
      likes: 0,
      likedBy: [],
      comments: [],
      category: postData.category || 'life',
      tags: postData.tags || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    
    posts.value.unshift(newPost)
    localStorage.setItem('communityPosts', JSON.stringify(posts.value))
    
    return { success: true, message: '发布成功', post: newPost }
  }

  function getPostById(id) {
    initializePosts()
    return posts.value.find(post => post.id === id)
  }

  function getPostsByCategory(category) {
    initializePosts()
    if (category === 'all') {
      return latestPosts.value
    }
    return latestPosts.value.filter(post => post.category === category)
  }

  function getPostsByAuthor(authorId) {
    initializePosts()
    return posts.value.filter(post => post.authorId === authorId)
  }

  function likePost(postId, userId) {
    const post = getPostById(postId)
    if (!post) {
      return { success: false, message: '帖子不存在' }
    }
    
    // 确保 likedBy 数组存在
    if (!post.likedBy) {
      post.likedBy = []
    }
    
    const userIndex = post.likedBy.indexOf(userId)
    
    if (userIndex === -1) {
      // 未点赞，添加点赞
      post.likedBy.push(userId)
      post.likes++
      post.updatedAt = new Date().toISOString()
      localStorage.setItem('communityPosts', JSON.stringify(posts.value))
      return { success: true, message: '点赞成功', isLiked: true }
    } else {
      // 已点赞，取消点赞
      post.likedBy.splice(userIndex, 1)
      post.likes = Math.max(0, post.likes - 1)
      post.updatedAt = new Date().toISOString()
      localStorage.setItem('communityPosts', JSON.stringify(posts.value))
      return { success: true, message: '取消点赞', isLiked: false }
    }
  }

  function addComment(postId, content) {
    const userStore = useUserStore()
    
    if (!userStore.isLoggedIn) {
      return { success: false, message: '请先登录' }
    }
    
    const post = getPostById(postId)
    if (!post) {
      return { success: false, message: '帖子不存在' }
    }
    
    const newComment = {
      id: generateId(),
      content: content,
      authorId: userStore.currentUser.id,
      createdAt: new Date().toISOString()
    }
    
    post.comments.push(newComment)
    post.updatedAt = new Date().toISOString()
    
    localStorage.setItem('communityPosts', JSON.stringify(posts.value))
    
    return { success: true, message: '评论成功', comment: newComment }
  }

  function deletePost(postId, userId) {
    const index = posts.value.findIndex(post => post.id === postId)
    if (index === -1) {
      return { success: false, message: '帖子不存在' }
    }
    
    const post = posts.value[index]
    if (post.authorId !== userId) {
      return { success: false, message: '只能删除自己发布的帖子' }
    }
    
    posts.value.splice(index, 1)
    localStorage.setItem('communityPosts', JSON.stringify(posts.value))
    
    return { success: true, message: '删除成功' }
  }

  return {
    // State
    posts,
    currentPost,
    
    // Getters
    latestPosts,
    hotPosts,
    
    // Actions
    initializePosts,
    createPost,
    getPostById,
    getPostsByCategory,
    getPostsByAuthor,
    likePost,
    addComment,
    deletePost
  }
})
