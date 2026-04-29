const DEFAULT_POSTS = [
  {
    id: 'post_001',
    userId: 'user_002',
    username: '北京小妞',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100',
    title: '故宫文创冰箱贴太可爱了！每次打开冰箱都有好心情',
    content: '上周去北京故宫游玩，在文创店买了这款冰箱贴，真的太精致了！上面的故宫图案栩栩如生，金色的边框也很有质感。现在每次打开冰箱看到它，就想起那次愉快的旅行。推荐给所有喜欢故宫文化的朋友们！',
    images: [
      'https://images.unsplash.com/photo-1518998053901-5348d3961a04?w=600',
      'https://images.unsplash.com/photo-1529921879218-f99546d03a98?w=600'
    ],
    location: {
      province: '北京市',
      city: '北京市',
      landmark: '故宫博物院'
    },
    tags: ['故宫', '冰箱贴', '北京', '文创'],
    likes: 328,
    comments: [
      {
        id: 'comment_001',
        userId: 'user_003',
        username: '旅行达人',
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100',
        content: '这款我也买了！确实很精美，现在我家冰箱上已经贴了好几款了',
        createdAt: '2024-04-28T15:30:00Z',
        likes: 24
      },
      {
        id: 'comment_002',
        userId: 'user_004',
        username: '文创爱好者',
        avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100',
        content: '请问是在故宫里面买的吗？价格多少呀？',
        createdAt: '2024-04-28T16:45:00Z',
        likes: 8,
        replies: [
          {
            id: 'reply_001',
            userId: 'user_002',
            username: '北京小妞',
            avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100',
            content: '是的，在故宫文创店买的，29元，这里也有卖的哦，更便宜',
            createdAt: '2024-04-28T17:00:00Z'
          }
        ]
      }
    ],
    shares: 56,
    isLiked: false,
    createdAt: '2024-04-28T14:20:00Z'
  },
  {
    id: 'post_002',
    userId: 'user_005',
    username: '上海老克勒',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100',
    title: '外滩夜景明信片，送给远方的朋友最棒的礼物',
    content: '作为一个上海本地人，我特别喜欢收集各种上海主题的文创产品。这款外滩夜景明信片真的很棒！印刷质量非常好，夜景拍得很有感觉。上周给远方的朋友寄了几套，他们都特别喜欢，说看着明信片就想来上海玩。',
    images: [
      'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=600',
      'https://images.unsplash.com/photo-1474181487882-5abf3f0ba6c2?w=600'
    ],
    location: {
      province: '上海市',
      city: '上海市',
      landmark: '外滩'
    },
    tags: ['上海', '外滩', '明信片', '夜景'],
    likes: 256,
    comments: [
      {
        id: 'comment_003',
        userId: 'user_006',
        username: '集邮爱好者',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100',
        content: '这个我也有一套！真的很美，我用来做书签了',
        createdAt: '2024-04-27T10:20:00Z',
        likes: 32
      }
    ],
    shares: 42,
    isLiked: false,
    createdAt: '2024-04-27T09:15:00Z'
  },
  {
    id: 'post_003',
    userId: 'user_007',
    username: '大理追梦人',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100',
    title: '风花雪月冰箱贴套装，把大理的美带回家',
    content: '去年去大理旅行，被那里的风景深深吸引。回来后一直念念不忘，直到发现了这套风花雪月冰箱贴。下关风、上关花、苍山雪、洱海月，每一款都有独特的设计。现在每天打开冰箱，就仿佛又回到了大理那段美好的时光。强烈推荐给所有喜欢大理的朋友们！',
    images: [
      'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600',
      'https://images.unsplash.com/photo-1529921879218-f99546d03a98?w=600'
    ],
    location: {
      province: '云南省',
      city: '大理市',
      landmark: '洱海'
    },
    tags: ['大理', '风花雪月', '洱海', '冰箱贴'],
    likes: 412,
    comments: [
      {
        id: 'comment_004',
        userId: 'user_008',
        username: '文艺青年',
        avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100',
        content: '大理真的太美了！这套冰箱贴在哪里可以买到？',
        createdAt: '2024-04-26T20:10:00Z',
        likes: 18,
        replies: [
          {
            id: 'reply_002',
            userId: 'user_007',
            username: '大理追梦人',
            avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100',
            content: '这里就有卖的哦，搜索"风花雪月"就能找到',
            createdAt: '2024-04-26T20:30:00Z'
          }
        ]
      }
    ],
    shares: 89,
    isLiked: false,
    createdAt: '2024-04-26T18:45:00Z'
  },
  {
    id: 'post_004',
    userId: 'user_009',
    username: '新疆美食家',
    avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=100',
    title: '薰衣草精油手办礼盒，来自伊犁的芬芳',
    content: '作为一个土生土长的新疆人，我非常自豪能够向大家推荐家乡的特色产品。这款薰衣草精油手办礼盒真的太棒了！手办造型可爱，精油也是纯天然的，放在房间里整个房间都香香的。每次闻到这个味道，就想起了伊犁那一片片紫色的薰衣草花海。',
    images: [
      'https://images.unsplash.com/photo-1529921879218-f99546d03a98?w=600',
      'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600'
    ],
    location: {
      province: '新疆维吾尔自治区',
      city: '伊犁哈萨克自治州',
      landmark: '霍城薰衣草'
    },
    tags: ['新疆', '伊犁', '薰衣草', '精油', '手办'],
    likes: 567,
    comments: [
      {
        id: 'comment_005',
        userId: 'user_010',
        username: '芳香疗法师',
        avatar: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=100',
        content: '薰衣草精油真的很好用，可以帮助睡眠。这个礼盒造型也很可爱，适合送人',
        createdAt: '2024-04-25T14:30:00Z',
        likes: 45
      },
      {
        id: 'comment_006',
        userId: 'user_011',
        username: '旅行计划者',
        avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100',
        content: '今年夏天打算去新疆玩，伊犁的薰衣草什么时候开呀？',
        createdAt: '2024-04-25T16:00:00Z',
        likes: 12
      }
    ],
    shares: 123,
    isLiked: false,
    createdAt: '2024-04-25T12:30:00Z'
  },
  {
    id: 'post_005',
    userId: 'user_012',
    username: '美食摄影师',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100',
    title: '粤式早茶点心手办，萌化了我的心！',
    content: '作为一个美食摄影师，我对各种美食相关的文创产品特别感兴趣。这款粤式早茶点心手办真的是太可爱了！虾饺、烧麦、凤爪...每一款都做得栩栩如生，Q萌Q萌的。现在它们已经成为我餐桌上的小装饰，每次看到都心情大好！',
    images: [
      'https://images.unsplash.com/photo-1529921879218-f99546d03a98?w=600',
      'https://images.unsplash.com/photo-1518998053901-5348d3961a04?w=600'
    ],
    location: {
      province: '广东省',
      city: '广州市',
      landmark: '广州塔'
    },
    tags: ['广州', '粤式', '早茶', '手办', '美食'],
    likes: 634,
    comments: [
      {
        id: 'comment_007',
        userId: 'user_013',
        username: '吃货少女',
        avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100',
        content: '太可爱了！我要把它们都买回家！请问一套有几个呀？',
        createdAt: '2024-04-24T11:20:00Z',
        likes: 56
      }
    ],
    shares: 156,
    isLiked: false,
    createdAt: '2024-04-24T10:15:00Z'
  },
  {
    id: 'post_006',
    userId: 'user_014',
    username: '丽江慢生活',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100',
    title: '纳西东巴文明信片，古老文字的现代演绎',
    content: '在丽江古城闲逛时，被一家小店的东巴文明信片吸引了。东巴文是世界上唯一仍在使用的象形文字，每一个字都像一幅画。这套明信片不仅印刷精美，还附带了文字的解释，让我能够了解这些古老文字的含义。现在我把它们贴在书桌前，每天都能感受到这份独特的文化魅力。',
    images: [
      'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=600',
      'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600'
    ],
    location: {
      province: '云南省',
      city: '丽江市',
      landmark: '丽江古城'
    },
    tags: ['丽江', '东巴文', '象形文字', '明信片', '文化'],
    likes: 389,
    comments: [],
    shares: 78,
    isLiked: false,
    createdAt: '2024-04-23T16:45:00Z'
  }
]

let POSTS = [...DEFAULT_POSTS]

function loadPostsFromStorage() {
  try {
    const saved = localStorage.getItem('posts')
    if (saved) {
      const parsed = JSON.parse(saved)
      if (Array.isArray(parsed) && parsed.length > 0) {
        POSTS = parsed
        return
      }
    }
    POSTS = [...DEFAULT_POSTS]
  } catch (e) {
    POSTS = [...DEFAULT_POSTS]
  }
}

function savePostsToStorage() {
  try {
    localStorage.setItem('posts', JSON.stringify(POSTS))
  } catch (e) {
    console.error('Failed to save posts to storage:', e)
  }
}

loadPostsFromStorage()

export { POSTS }

export function getPostById(id) {
  return POSTS.find(p => p.id === id)
}

export function getPostsByCity(cityId) {
  return POSTS.filter(p => p.location.cityId === cityId)
}

export function searchPosts(keyword) {
  const lowerKeyword = keyword.toLowerCase()
  return POSTS.filter(p => 
    p.title.toLowerCase().includes(lowerKeyword) ||
    p.content.toLowerCase().includes(lowerKeyword) ||
    p.tags.some(tag => tag.toLowerCase().includes(lowerKeyword)) ||
    p.location.city.toLowerCase().includes(lowerKeyword)
  )
}

export function likePost(postId) {
  const post = getPostById(postId)
  if (post) {
    post.isLiked = !post.isLiked
    post.likes += post.isLiked ? 1 : -1
    savePostsToStorage()
    return post
  }
  return null
}

export function addComment(postId, commentData) {
  const post = getPostById(postId)
  if (post) {
    const newComment = {
      id: `comment_${Date.now()}`,
      ...commentData,
      createdAt: new Date().toISOString(),
      likes: 0,
      replies: []
    }
    post.comments.push(newComment)
    savePostsToStorage()
    return newComment
  }
  return null
}

export function createPost(postData) {
  const newPost = {
    id: `post_${Date.now()}`,
    userId: 'user_001',
    username: '旅行者',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100',
    ...postData,
    likes: 0,
    comments: [],
    shares: 0,
    isLiked: false,
    createdAt: new Date().toISOString()
  }
  POSTS.unshift(newPost)
  savePostsToStorage()
  return newPost
}
