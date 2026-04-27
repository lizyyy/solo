import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { generateId } from '../utils/helpers'

export const useUserStore = defineStore('user', () => {
  // State
  const currentUser = ref(null)
  const users = ref([])
  const token = ref(localStorage.getItem('userToken') || null)

  // Getters
  const isLoggedIn = computed(() => {
    return !!currentUser.value && !!token.value
  })

  const userCreditScore = computed(() => {
    if (!currentUser.value) return 0
    return currentUser.value.creditScore || 80
  })

  // Actions
  function initializeUsers() {
    if (users.value.length === 0) {
      const savedUsers = localStorage.getItem('neighborUsers')
      if (savedUsers) {
        users.value = JSON.parse(savedUsers)
      } else {
        // 初始化示例用户
        users.value = [
          {
            id: 'u001',
            name: '张小明',
            phone: '13800138001',
            password: '123456',
            avatar: '张',
            location: '阳光花园1号楼3单元',
            creditScore: 92,
            rating: 4.8,
            completedTasks: 23,
            helpRequests: 15,
            skills: ['水电维修', '家具组装', '电脑维修'],
            tags: ['热心邻居', '技术达人', '准时可靠'],
            joinDate: '2024-01-15',
            bio: '热心肠的技术男，喜欢帮助邻居解决各种小问题。'
          },
          {
            id: 'u002',
            name: '李阿姨',
            phone: '13800138002',
            password: '123456',
            avatar: '李',
            location: '阳光花园2号楼1单元',
            creditScore: 88,
            rating: 4.6,
            completedTasks: 35,
            helpRequests: 12,
            skills: ['家政服务', '代买代购', '接送孩子'],
            tags: ['热心肠', '经验丰富', '值得信赖'],
            joinDate: '2023-11-20',
            bio: '退休教师，时间充裕，喜欢帮邻居们处理日常琐事。'
          },
          {
            id: 'u003',
            name: '王师傅',
            phone: '13800138003',
            password: '123456',
            avatar: '王',
            location: '阳光花园3号楼2单元',
            creditScore: 95,
            rating: 4.9,
            completedTasks: 47,
            helpRequests: 8,
            skills: ['水电维修', '管道疏通', '家电维修', '家具安装'],
            tags: ['专业可靠', '技术精湛', '价格公道'],
            joinDate: '2023-09-10',
            bio: '专业维修师傅，20年经验，家里东西坏了找我准没错！'
          },
          {
            id: 'u004',
            name: '陈医生',
            phone: '13800138004',
            password: '123456',
            avatar: '陈',
            location: '阳光花园5号楼2单元',
            creditScore: 90,
            rating: 4.7,
            completedTasks: 12,
            helpRequests: 5,
            skills: ['健康咨询', '用药指导', '应急处理'],
            tags: ['专业医师', '耐心细致', '乐于助人'],
            joinDate: '2024-02-05',
            bio: '社区医院医生，欢迎邻居们咨询健康问题。'
          }
        ]
        localStorage.setItem('neighborUsers', JSON.stringify(users.value))
      }
    }
  }

  function checkAuth() {
    initializeUsers()
    
    const savedToken = localStorage.getItem('userToken')
    const savedUserId = localStorage.getItem('currentUserId')
    
    if (savedToken && savedUserId) {
      const user = users.value.find(u => u.id === savedUserId)
      if (user) {
        currentUser.value = user
        token.value = savedToken
        return true
      }
    }
    return false
  }

  function login(phone, password) {
    initializeUsers()
    
    const user = users.value.find(u => u.phone === phone && u.password === password)
    
    if (user) {
      currentUser.value = user
      const newToken = generateId()
      token.value = newToken
      
      localStorage.setItem('userToken', newToken)
      localStorage.setItem('currentUserId', user.id)
      
      return { success: true, message: '登录成功' }
    }
    
    return { success: false, message: '手机号或密码错误' }
  }

  function register(userData) {
    initializeUsers()
    
    // 检查手机号是否已注册
    const existingUser = users.value.find(u => u.phone === userData.phone)
    if (existingUser) {
      return { success: false, message: '该手机号已被注册' }
    }
    
    const newUser = {
      id: generateId(),
      name: userData.name,
      phone: userData.phone,
      password: userData.password,
      avatar: userData.name.charAt(0),
      location: userData.location || '',
      creditScore: 80,
      rating: 0,
      completedTasks: 0,
      helpRequests: 0,
      skills: userData.skills || [],
      tags: [],
      joinDate: new Date().toISOString().split('T')[0],
      bio: userData.bio || ''
    }
    
    users.value.push(newUser)
    localStorage.setItem('neighborUsers', JSON.stringify(users.value))
    
    // 自动登录
    currentUser.value = newUser
    const newToken = generateId()
    token.value = newToken
    
    localStorage.setItem('userToken', newToken)
    localStorage.setItem('currentUserId', newUser.id)
    
    return { success: true, message: '注册成功', user: newUser }
  }

  function logout() {
    currentUser.value = null
    token.value = null
    localStorage.removeItem('userToken')
    localStorage.removeItem('currentUserId')
  }

  function updateProfile(updates) {
    if (!currentUser.value) return { success: false, message: '用户未登录' }
    
    const index = users.value.findIndex(u => u.id === currentUser.value.id)
    if (index !== -1) {
      // 如果修改了名字，同时更新头像（名字首字母）
      if (updates.name) {
        updates.avatar = updates.name.charAt(0)
      }
      
      // 合并更新信息
      users.value[index] = { ...users.value[index], ...updates }
      currentUser.value = users.value[index]
      
      localStorage.setItem('neighborUsers', JSON.stringify(users.value))
      return { success: true, message: '更新成功' }
    }
    
    return { success: false, message: '用户不存在' }
  }

  function updateCreditScore(userId, rating, isHelper = true) {
    const user = users.value.find(u => u.id === userId)
    if (!user) return
    
    // 计算信用分变化
    // 好评(4-5星)：+1-3分
    // 中评(3星)：0分
    // 差评(1-2星)：-2-5分
    let scoreChange = 0
    if (rating >= 4) {
      scoreChange = Math.floor(rating - 3)
    } else if (rating <= 2) {
      scoreChange = -Math.floor(3 - rating) * 2
    }
    
    // 限制信用分范围 0-100
    const newScore = Math.max(0, Math.min(100, user.creditScore + scoreChange))
    
    // 更新用户评分
    // 根据用户角色（帮助者/求助者）使用不同的计数
    let currentCount = isHelper ? user.completedTasks : user.helpRequests
    const totalRating = (user.rating || 0) * currentCount
    const newRating = currentCount === 0 ? rating : (totalRating + rating) / (currentCount + 1)
    
    const index = users.value.findIndex(u => u.id === userId)
    if (index !== -1) {
      users.value[index].creditScore = newScore
      users.value[index].rating = parseFloat(newRating.toFixed(1))
      
      // 更新计数
      if (isHelper) {
        users.value[index].completedTasks++
      } else {
        users.value[index].helpRequests++
      }
      
      // 如果是当前用户，更新currentUser
      if (currentUser.value && currentUser.value.id === userId) {
        currentUser.value = users.value[index]
      }
      
      localStorage.setItem('neighborUsers', JSON.stringify(users.value))
    }
  }

  function incrementCompletedTasks(userId) {
    const index = users.value.findIndex(u => u.id === userId)
    if (index !== -1) {
      users.value[index].completedTasks++
      
      if (currentUser.value && currentUser.value.id === userId) {
        currentUser.value.completedTasks++
      }
      
      localStorage.setItem('neighborUsers', JSON.stringify(users.value))
    }
  }

  function incrementHelpRequests(userId) {
    const index = users.value.findIndex(u => u.id === userId)
    if (index !== -1) {
      users.value[index].helpRequests++
      
      if (currentUser.value && currentUser.value.id === userId) {
        currentUser.value.helpRequests++
      }
      
      localStorage.setItem('neighborUsers', JSON.stringify(users.value))
    }
  }

  function getUserById(userId) {
    initializeUsers()
    return users.value.find(u => u.id === userId)
  }

  function getUsersBySkill(skill) {
    initializeUsers()
    return users.value.filter(u => u.skills.includes(skill))
  }

  function getTopRatedUsers(limit = 10) {
    initializeUsers()
    return [...users.value]
      .sort((a, b) => b.rating - a.rating)
      .slice(0, limit)
  }

  return {
    // State
    currentUser,
    users,
    token,
    
    // Getters
    isLoggedIn,
    userCreditScore,
    
    // Actions
    initializeUsers,
    checkAuth,
    login,
    register,
    logout,
    updateProfile,
    updateCreditScore,
    incrementCompletedTasks,
    incrementHelpRequests,
    getUserById,
    getUsersBySkill,
    getTopRatedUsers
  }
})
