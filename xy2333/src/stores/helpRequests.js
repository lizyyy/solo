import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { generateId, STATUS_OPTIONS, findBestMatches } from '../utils/helpers'
import { useUserStore } from './user'

export const useHelpRequestsStore = defineStore('helpRequests', () => {
  // State
  const helpRequests = ref([])
  const currentHelpRequest = ref(null)

  // Getters
  const pendingRequests = computed(() => {
    return helpRequests.value.filter(req => req.status === STATUS_OPTIONS.PENDING)
  })

  const urgentRequests = computed(() => {
    return helpRequests.value.filter(req => req.category === 'emergency' && req.status === STATUS_OPTIONS.PENDING)
  })

  const completedRequests = computed(() => {
    return helpRequests.value.filter(req => req.status === STATUS_OPTIONS.COMPLETED)
  })

  // Actions
  function initializeHelpRequests() {
    if (helpRequests.value.length === 0) {
      const savedRequests = localStorage.getItem('helpRequests')
      if (savedRequests) {
        helpRequests.value = JSON.parse(savedRequests)
      } else {
        // 初始化示例数据
        helpRequests.value = [
          {
            id: 'hr001',
            title: '紧急送医求助 - 家中老人突发不适',
            description: '我家老人突然感到胸闷头晕，需要紧急送医。我现在不在家，附近有没有有车的邻居能帮忙？老人住在阳光花园1号楼3单元502室，需要送到社区医院。',
            category: 'emergency',
            subcategory: 'medical',
            location: '阳光花园1号楼3单元',
            requesterId: 'u001',
            helperId: null,
            status: STATUS_OPTIONS.PENDING,
            priority: 'high',
            reward: '感谢费200元',
            createdAt: new Date(Date.now() - 1800000).toISOString(),
            updatedAt: new Date(Date.now() - 1800000).toISOString(),
            tags: ['紧急', '送医', '老人'],
            estimatedTime: '30分钟内',
            contactPhone: '13800138001'
          },
          {
            id: 'hr002',
            title: '代买一些生活用品',
            description: '我需要买一些生活用品，包括牛奶、面包、鸡蛋和一些蔬菜。如果有邻居去超市的话，能不能帮我带一下？我住在2号楼1单元，下楼不方便。',
            category: 'daily',
            subcategory: 'shopping',
            location: '阳光花园2号楼1单元',
            requesterId: 'u002',
            helperId: null,
            status: STATUS_OPTIONS.PENDING,
            priority: 'medium',
            reward: '感谢费30元',
            createdAt: new Date(Date.now() - 7200000).toISOString(),
            updatedAt: new Date(Date.now() - 7200000).toISOString(),
            tags: ['代买', '生活用品', '超市'],
            estimatedTime: '今天下午',
            contactPhone: '13800138002'
          },
          {
            id: 'hr003',
            title: '空调不制冷了，需要维修',
            description: '我家客厅的空调突然不制冷了，吹出来的都是热风。遥控器显示正常，温度也调到最低了，但就是不制冷。有没有懂空调维修的邻居能帮忙看看？',
            category: 'skill',
            subcategory: 'repair',
            location: '阳光花园3号楼2单元',
            requesterId: 'u003',
            helperId: null,
            status: STATUS_OPTIONS.PENDING,
            priority: 'medium',
            reward: '感谢费80元',
            createdAt: new Date(Date.now() - 14400000).toISOString(),
            updatedAt: new Date(Date.now() - 14400000).toISOString(),
            tags: ['维修', '空调', '家电'],
            estimatedTime: '本周内',
            contactPhone: '13800138003'
          },
          {
            id: 'hr004',
            title: '借用一下电钻',
            description: '我需要在墙上挂个画，需要用电钻打几个孔。有没有邻居家里有电钻可以借用一下？用完马上归还，非常感谢！',
            category: 'resource',
            subcategory: 'tools',
            location: '阳光花园5号楼2单元',
            requesterId: 'u004',
            helperId: null,
            status: STATUS_OPTIONS.PENDING,
            priority: 'low',
            reward: '请喝奶茶',
            createdAt: new Date(Date.now() - 28800000).toISOString(),
            updatedAt: new Date(Date.now() - 28800000).toISOString(),
            tags: ['借用', '工具', '电钻'],
            estimatedTime: '今天晚上',
            contactPhone: '13800138004'
          },
          {
            id: 'hr005',
            title: '水龙头漏水，需要维修',
            description: '厨房的水龙头突然漏水了，关不紧，一直滴水。有没有会修水龙头的邻居？能帮忙修一下吗？',
            category: 'emergency',
            subcategory: 'repair',
            location: '阳光花园1号楼2单元',
            requesterId: 'u001',
            helperId: 'u003',
            status: STATUS_OPTIONS.COMPLETED,
            priority: 'high',
            reward: '感谢费50元',
            createdAt: new Date(Date.now() - 172800000).toISOString(),
            updatedAt: new Date(Date.now() - 86400000).toISOString(),
            tags: ['维修', '水龙头', '漏水'],
            estimatedTime: '当天',
            contactPhone: '13800138001',
            rating: {
              requesterToHelper: 5,
              helperToRequester: 5
            }
          },
          {
            id: 'hr006',
            title: '帮忙接送孩子放学',
            description: '今天下午有事，不能去接孩子放学。孩子在附近的小学，下午4:30放学，需要帮忙接到小区。有没有时间方便的邻居？',
            category: 'daily',
            subcategory: 'pickup',
            location: '阳光花园2号楼3单元',
            requesterId: 'u002',
            helperId: 'u001',
            status: STATUS_OPTIONS.IN_PROGRESS,
            priority: 'medium',
            reward: '感谢费40元',
            createdAt: new Date(Date.now() - 43200000).toISOString(),
            updatedAt: new Date(Date.now() - 21600000).toISOString(),
            tags: ['接送', '孩子', '放学'],
            estimatedTime: '今天下午',
            contactPhone: '13800138002'
          }
        ]
        localStorage.setItem('helpRequests', JSON.stringify(helpRequests.value))
      }
    }
  }

  function createHelpRequest(requestData) {
    const userStore = useUserStore()
    
    if (!userStore.isLoggedIn) {
      return { success: false, message: '请先登录' }
    }
    
    const newRequest = {
      id: generateId(),
      title: requestData.title,
      description: requestData.description,
      category: requestData.category,
      subcategory: requestData.subcategory,
      location: requestData.location || userStore.currentUser.location,
      requesterId: userStore.currentUser.id,
      helperId: null,
      status: STATUS_OPTIONS.PENDING,
      priority: requestData.priority || 'medium',
      reward: requestData.reward || '感谢帮助',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: requestData.tags || [],
      estimatedTime: requestData.estimatedTime || '尽快',
      contactPhone: requestData.contactPhone || userStore.currentUser.phone
    }
    
    helpRequests.value.unshift(newRequest)
    localStorage.setItem('helpRequests', JSON.stringify(helpRequests.value))
    
    // 更新用户求助次数
    userStore.incrementHelpRequests(userStore.currentUser.id)
    
    return { success: true, message: '求助发布成功', request: newRequest }
  }

  function getHelpRequestById(id) {
    initializeHelpRequests()
    return helpRequests.value.find(req => req.id === id)
  }

  function getHelpRequestsByCategory(category) {
    initializeHelpRequests()
    if (category === 'all') {
      return helpRequests.value
    }
    return helpRequests.value.filter(req => req.category === category)
  }

  function getHelpRequestsByRequester(requesterId) {
    initializeHelpRequests()
    return helpRequests.value.filter(req => req.requesterId === requesterId)
  }

  function getHelpRequestsByHelper(helperId) {
    initializeHelpRequests()
    return helpRequests.value.filter(req => req.helperId === helperId)
  }

  function updateHelpRequest(id, updates) {
    const index = helpRequests.value.findIndex(req => req.id === id)
    if (index !== -1) {
      helpRequests.value[index] = {
        ...helpRequests.value[index],
        ...updates,
        updatedAt: new Date().toISOString()
      }
      localStorage.setItem('helpRequests', JSON.stringify(helpRequests.value))
      return { success: true, message: '更新成功' }
    }
    return { success: false, message: '求助不存在' }
  }

  function acceptHelpRequest(requestId, helperId) {
    const request = getHelpRequestById(requestId)
    if (!request) {
      return { success: false, message: '求助不存在' }
    }
    
    if (request.status !== STATUS_OPTIONS.PENDING) {
      return { success: false, message: '该求助已被接单或已完成' }
    }
    
    return updateHelpRequest(requestId, {
      helperId: helperId,
      status: STATUS_OPTIONS.MATCHED
    })
  }

  function startHelpRequest(requestId) {
    return updateHelpRequest(requestId, {
      status: STATUS_OPTIONS.IN_PROGRESS
    })
  }

  function completeHelpRequest(requestId, rating, raterId, rateeId) {
    const userStore = useUserStore()
    const request = getHelpRequestById(requestId)
    
    if (!request) {
      return { success: false, message: '求助不存在' }
    }
    
    // 更新求助状态
    const ratingData = request.rating || {}
    let isFirstTimeRating = false
    
    if (raterId === request.requesterId) {
      // 求助者评价帮助者
      if (!ratingData.requesterToHelper) {
        isFirstTimeRating = true
      }
      ratingData.requesterToHelper = rating
    } else if (raterId === request.helperId) {
      // 帮助者评价求助者
      if (!ratingData.helperToRequester) {
        isFirstTimeRating = true
      }
      ratingData.helperToRequester = rating
    }
    
    // 检查是否双方都已评价
    const bothRated = ratingData.requesterToHelper && ratingData.helperToRequester
    
    const updateData = {
      rating: ratingData
    }
    
    if (bothRated) {
      updateData.status = STATUS_OPTIONS.COMPLETED
    }
    
    updateHelpRequest(requestId, updateData)
    
    // 每一方评价后立即更新被评价者的评分（不需要等待双方都评价）
    if (isFirstTimeRating) {
      // rateeId 是被评价者的ID
      if (rateeId === request.helperId) {
        // 被评价者是帮助者 - 更新帮助者的评分和完成任务数
        userStore.updateCreditScore(rateeId, rating, true)
      } else if (rateeId === request.requesterId) {
        // 被评价者是求助者 - 更新求助者的评分
        userStore.updateCreditScore(rateeId, rating, false)
      }
    }
    
    return { success: true, message: '评价成功' }
  }

  function cancelHelpRequest(requestId, userId) {
    const request = getHelpRequestById(requestId)
    if (!request) {
      return { success: false, message: '求助不存在' }
    }
    
    if (request.requesterId !== userId) {
      return { success: false, message: '只能取消自己发布的求助' }
    }
    
    if (request.status === STATUS_OPTIONS.COMPLETED) {
      return { success: false, message: '已完成的求助无法取消' }
    }
    
    return updateHelpRequest(requestId, {
      status: STATUS_OPTIONS.CANCELLED
    })
  }

  function getMatchesForRequest(requestId) {
    const userStore = useUserStore()
    const request = getHelpRequestById(requestId)
    
    if (!request) {
      return []
    }
    
    userStore.initializeUsers()
    
    return findBestMatches(request, userStore.users, 5)
  }

  return {
    // State
    helpRequests,
    currentHelpRequest,
    
    // Getters
    pendingRequests,
    urgentRequests,
    completedRequests,
    
    // Actions
    initializeHelpRequests,
    createHelpRequest,
    getHelpRequestById,
    getHelpRequestsByCategory,
    getHelpRequestsByRequester,
    getHelpRequestsByHelper,
    updateHelpRequest,
    acceptHelpRequest,
    startHelpRequest,
    completeHelpRequest,
    cancelHelpRequest,
    getMatchesForRequest
  }
})
