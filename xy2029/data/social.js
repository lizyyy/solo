const categories = [
  {
    id: 'all',
    name: '全部'
  },
  {
    id: 'daily',
    name: '日常分享'
  },
  {
    id: 'money',
    name: '理财存钱'
  },
  {
    id: 'career',
    name: '职场交流'
  },
  {
    id: 'emotion',
    name: '情感树洞'
  },
  {
    id: 'food',
    name: '美食探店'
  }
]

const mockPosts = [
  {
    id: 1,
    user: {
      id: 'u1',
      nickname: '月光族小A',
      avatar: '👩',
      tier: '3k',
      isFriend: false
    },
    category: 'daily',
    content: '今天发工资了！3000块，虽然不多，但都是自己努力赚的。存了1000，剩下的当生活费。继续加油，未来会更好的！💪',
    images: [],
    likes: 128,
    comments: 23,
    shares: 5,
    isLiked: false,
    createTime: '2024-01-15 10:30'
  },
  {
    id: 2,
    user: {
      id: 'u2',
      nickname: '打工人小王',
      avatar: '👨',
      tier: '9k',
      isFriend: true
    },
    category: 'money',
    content: '月薪9k，房租2500，吃饭1500，每个月能存3000。虽然不算多，但很踏实。大家每个月能存多少钱？',
    images: [],
    likes: 256,
    comments: 67,
    shares: 12,
    isLiked: true,
    createTime: '2024-01-14 18:45'
  },
  {
    id: 3,
    user: {
      id: 'u3',
      nickname: '产品经理小李',
      avatar: '👨‍💼',
      tier: '3w',
      isFriend: false
    },
    category: 'career',
    content: '月薪3万，但房贷15000，车贷5000，孩子幼儿园3000。剩下的7000要支付生活费。不敢辞职，不敢生病。但看到孩子的笑脸，觉得一切都值得。👨‍👩‍👧',
    images: [],
    likes: 512,
    comments: 134,
    shares: 45,
    isLiked: false,
    createTime: '2024-01-13 21:20'
  },
  {
    id: 4,
    user: {
      id: 'u4',
      nickname: '省钱小能手',
      avatar: '🧑',
      tier: '3k',
      isFriend: false
    },
    category: 'money',
    content: '周末去公园散步，免费的阳光和空气，也很美好。有时候快乐不需要花钱。分享一下我的省钱小技巧：\n1. 自己做饭，比外卖便宜一半\n2. 视频会员拼单，几个人共享\n3. 买衣服等换季打折\n4. 用记账APP，知道钱花在哪了\n\n大家还有什么省钱好方法？',
    images: [],
    likes: 345,
    comments: 89,
    shares: 56,
    isLiked: false,
    createTime: '2024-01-12 14:15'
  },
  {
    id: 5,
    user: {
      id: 'u5',
      nickname: '互联网打工人',
      avatar: '💻',
      tier: '5w',
      isFriend: false
    },
    category: 'emotion',
    content: '月薪5万，但最怀念的还是刚毕业时月薪3000的日子。那时候虽然穷，但很快乐，每天都有期待。现在有钱了，但时间没了。开始反思，赚钱是为了什么？🤔',
    images: [],
    likes: 678,
    comments: 234,
    shares: 89,
    isLiked: true,
    createTime: '2024-01-11 22:30'
  },
  {
    id: 6,
    user: {
      id: 'u6',
      nickname: '美食探索者',
      avatar: '🍜',
      tier: '9k',
      isFriend: false
    },
    category: 'food',
    content: '发现一家超级好吃的小店！在城中村里面，一碗螺蛳粉才8块钱，味道绝了！而且老板给的料特别足。有时候最好吃的东西不在高档餐厅，而在这些隐藏的小店里。大家有什么私藏的宝藏小店？',
    images: [],
    likes: 234,
    comments: 56,
    shares: 23,
    isLiked: false,
    createTime: '2024-01-10 13:45'
  },
  {
    id: 7,
    user: {
      id: 'u7',
      nickname: '创业者老张',
      avatar: '🚀',
      tier: '10w',
      isFriend: false
    },
    category: 'career',
    content: '月薪10万+，但最想要的还是健康和家人的陪伴。去年体检出一堆毛病，开始调整生活方式。每周至少抽出一天时间陪家人，每天运动半小时。钱很重要，但健康和家人更重要。❤️',
    images: [],
    likes: 890,
    comments: 345,
    shares: 156,
    isLiked: false,
    createTime: '2024-01-09 09:00'
  },
  {
    id: 8,
    user: {
      id: 'u8',
      nickname: '应届生小明',
      avatar: '🎓',
      tier: '3k',
      isFriend: false
    },
    category: 'emotion',
    content: '刚毕业，月薪3500，在深圳。房租1200，吃饭1000，交通200，剩下的1100。感觉存不到什么钱，但还是想坚持。有没有同样刚毕业的朋友，你们是怎么规划的？',
    images: [],
    likes: 456,
    comments: 178,
    shares: 67,
    isLiked: false,
    createTime: '2024-01-08 20:15'
  }
]

const mockComments = {
  1: [
    {
      id: 'c1',
      user: {
        nickname: '加油打工人',
        avatar: '💪'
      },
      content: '加油！未来可期！',
      createTime: '2024-01-15 11:00'
    },
    {
      id: 'c2',
      user: {
        nickname: '省钱达人',
        avatar: '💰'
      },
      content: '能存1000已经很棒了！我月薪3000的时候基本月光...',
      createTime: '2024-01-15 12:30'
    }
  ]
}

module.exports = {
  categories,
  mockPosts,
  mockComments
}
