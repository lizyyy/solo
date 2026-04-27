export function generateId() {
  return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
}

export function formatDate(date) {
  if (!(date instanceof Date)) {
    date = new Date(date)
  }
  
  const now = new Date()
  const diff = now - date
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const minutes = Math.floor(diff / (1000 * 60))
  
  if (minutes < 1) {
    return '刚刚'
  } else if (minutes < 60) {
    return `${minutes}分钟前`
  } else if (hours < 24) {
    return `${hours}小时前`
  } else if (days < 7) {
    return `${days}天前`
  } else {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
}

export function formatFullDate(date) {
  if (!(date instanceof Date)) {
    date = new Date(date)
  }
  
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  
  return `${year}-${month}-${day} ${hours}:${minutes}`
}

export const CATEGORIES = {
  EMERGENCY: {
    id: 'emergency',
    name: '紧急求助',
    icon: '🚨',
    color: '#e74c3c',
    subcategories: [
      { id: 'medical', name: '送医求助', icon: '🏥' },
      { id: 'repair', name: '应急维修', icon: '🔧' },
      { id: 'other', name: '其他紧急', icon: '❓' }
    ]
  },
  DAILY: {
    id: 'daily',
    name: '日常代办',
    icon: '📋',
    color: '#3498db',
    subcategories: [
      { id: 'shopping', name: '代买代购', icon: '🛒' },
      { id: 'payment', name: '代缴费用', icon: '💳' },
      { id: 'pickup', name: '代取代送', icon: '📦' },
      { id: 'other', name: '其他代办', icon: '📝' }
    ]
  },
  SKILL: {
    id: 'skill',
    name: '技能支持',
    icon: '🛠️',
    color: '#27ae60',
    subcategories: [
      { id: 'repair', name: '维修服务', icon: '🔧' },
      { id: 'tutoring', name: '辅导托管', icon: '👨‍🏫' },
      { id: 'tech', name: '技术支持', icon: '💻' },
      { id: 'cooking', name: '美食烹饪', icon: '👩‍🍳' },
      { id: 'other', name: '其他技能', icon: '✨' }
    ]
  },
  RESOURCE: {
    id: 'resource',
    name: '资源共享',
    icon: '🤝',
    color: '#f39c12',
    subcategories: [
      { id: 'tools', name: '工具借用', icon: '🔨' },
      { id: 'parking', name: '车位共享', icon: '🅿️' },
      { id: 'items', name: '物品借用', icon: '📦' },
      { id: 'space', name: '空间共享', icon: '🏠' },
      { id: 'other', name: '其他资源', icon: '📚' }
    ]
  }
}

export const ALL_SKILLS = [
  '水电维修', '家具组装', '电脑维修', '手机维修', '家电维修',
  '管道疏通', '家政服务', '代买代购', '接送孩子', '老人陪护',
  '健康咨询', '用药指导', '应急处理', '家教辅导', '作业辅导',
  '语言学习', '乐器教学', '绘画教学', '摄影服务', '视频制作',
  '文案写作', '翻译服务', '法律咨询', '财务咨询', '装修设计',
  '搬家服务', '宠物照料', '植物养护', '汽车服务', '快递代取',
  '代购跑腿', '上门做饭', '保洁服务', '洗衣服务', '理发服务',
  '美甲服务', '按摩服务', '健身指导', '瑜伽教学', '舞蹈教学'
]

export const STATUS_OPTIONS = {
  PENDING: 'pending',
  MATCHED: 'matched',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled'
}

export const STATUS_LABELS = {
  pending: '等待接单',
  matched: '已匹配',
  in_progress: '进行中',
  completed: '已完成',
  cancelled: '已取消'
}

export const STATUS_COLORS = {
  pending: '#f39c12',
  matched: '#3498db',
  in_progress: '#e67e22',
  completed: '#27ae60',
  cancelled: '#95a5a6'
}

export function calculateMatchScore(helpRequest, helper) {
  let score = 0
  
  // 1. 技能匹配 (50分)
  const categorySkills = {
    emergency: ['应急处理', '水电维修', '健康咨询'],
    daily: ['代买代购', '家政服务', '快递代取'],
    skill: ['水电维修', '家具组装', '电脑维修', '家电维修', '家教辅导'],
    resource: []
  }
  
  const requiredSkills = categorySkills[helpRequest.category] || []
  const matchedSkills = helper.skills.filter(skill => requiredSkills.includes(skill))
  
  if (matchedSkills.length > 0) {
    score += 30 + (matchedSkills.length * 5)
  }
  
  // 2. 信用评分 (20分)
  const creditScore = helper.creditScore || 80
  score += Math.floor(creditScore * 0.2)
  
  // 3. 历史评价 (20分)
  const rating = helper.rating || 0
  if (rating >= 4.5) {
    score += 20
  } else if (rating >= 4.0) {
    score += 15
  } else if (rating >= 3.5) {
    score += 10
  } else if (rating >= 3.0) {
    score += 5
  }
  
  // 4. 完成任务数 (10分)
  const completedTasks = helper.completedTasks || 0
  if (completedTasks >= 30) {
    score += 10
  } else if (completedTasks >= 20) {
    score += 8
  } else if (completedTasks >= 10) {
    score += 6
  } else if (completedTasks >= 5) {
    score += 4
  } else if (completedTasks > 0) {
    score += 2
  }
  
  return score
}

export function findBestMatches(helpRequest, users, limit = 5) {
  const matches = users
    .filter(user => user.id !== helpRequest.requesterId)
    .map(user => ({
      user,
      matchScore: calculateMatchScore(helpRequest, user)
    }))
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, limit)
  
  return matches
}
