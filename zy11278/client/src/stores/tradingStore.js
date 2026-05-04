import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  tradingDayApi,
  positionApi,
  riskApi,
  tradingApi
} from '@/api'

export const useTradingStore = defineStore('trading', () => {
  const currentTradingDay = ref(null)
  const activeTradingDay = ref(null)
  const positions = ref([])
  const cashAccount = ref(null)
  const portfolioMetrics = ref(null)
  const activeAlerts = ref([])
  const orders = ref([])
  const tradeHistory = ref([])

  const totalAsset = computed(() => {
    if (!portfolioMetrics.value) return 0
    return portfolioMetrics.value.totalAsset || 0
  })

  const totalPnl = computed(() => {
    if (!portfolioMetrics.value) return 0
    return portfolioMetrics.value.totalPnl || 0
  })

  const totalPnlPercent = computed(() => {
    if (!portfolioMetrics.value) return 0
    return portfolioMetrics.value.totalPnlPercent || 0
  })

  const positionRatio = computed(() => {
    if (!portfolioMetrics.value) return 0
    return portfolioMetrics.value.positionRatio || 0
  })

  const maxDrawdown = computed(() => {
    if (!portfolioMetrics.value) return 0
    return portfolioMetrics.value.maxDrawdown || 0
  })

  async function loadCurrentTradingDay() {
    try {
      const res = await tradingDayApi.getCurrent()
      currentTradingDay.value = res.data
      return res.data
    } catch (error) {
      console.error('加载当前交易日失败:', error)
      return null
    }
  }

  async function loadActiveTradingDay() {
    try {
      const res = await tradingDayApi.getActive()
      activeTradingDay.value = res.data
      return res.data
    } catch (error) {
      console.error('加载活跃交易日失败:', error)
      return null
    }
  }

  async function loadPositions(tradingDayId) {
    if (!tradingDayId) return
    try {
      const res = await positionApi.getAllPositions({ trading_day_id: tradingDayId })
      positions.value = res.data || []
      return res.data
    } catch (error) {
      console.error('加载持仓失败:', error)
      return []
    }
  }

  async function loadCashAccount(tradingDayId) {
    if (!tradingDayId) return
    try {
      const res = await positionApi.getCashAccount({ trading_day_id: tradingDayId })
      cashAccount.value = res.data
      return res.data
    } catch (error) {
      console.error('加载现金账户失败:', error)
      return null
    }
  }

  async function loadPortfolioMetrics(tradingDayId) {
    if (!tradingDayId) return
    try {
      const res = await positionApi.getPortfolioMetrics({ trading_day_id: tradingDayId })
      portfolioMetrics.value = res.data
      return res.data
    } catch (error) {
      console.error('加载组合指标失败:', error)
      return null
    }
  }

  async function loadActiveAlerts(tradingDayId) {
    try {
      const res = await riskApi.getAlerts({
        trading_day_id: tradingDayId,
        status: 'active',
        pageSize: 100
      })
      activeAlerts.value = res.data?.list || []
      return res.data
    } catch (error) {
      console.error('加载预警失败:', error)
      return null
    }
  }

  async function loadOrders(params) {
    try {
      const res = await tradingApi.getOrders(params)
      orders.value = res.data?.list || []
      return res.data
    } catch (error) {
      console.error('加载订单失败:', error)
      return null
    }
  }

  async function loadTradeHistory(params) {
    try {
      const res = await tradingApi.getTradeHistory(params)
      tradeHistory.value = res.data?.list || []
      return res.data
    } catch (error) {
      console.error('加载交易流水失败:', error)
      return null
    }
  }

  async function executeBuy(data) {
    try {
      const res = await tradingApi.executeBuy(data)
      return res.data
    } catch (error) {
      throw error
    }
  }

  async function executeSell(data) {
    try {
      const res = await tradingApi.executeSell(data)
      return res.data
    } catch (error) {
      throw error
    }
  }

  async function cancelOrder(orderId) {
    try {
      const res = await tradingApi.cancelOrder(orderId)
      return res.data
    } catch (error) {
      throw error
    }
  }

  async function refreshAll(tradingDayId) {
    if (!tradingDayId) return
    await Promise.all([
      loadCurrentTradingDay(),
      loadPositions(tradingDayId),
      loadCashAccount(tradingDayId),
      loadPortfolioMetrics(tradingDayId),
      loadActiveAlerts(tradingDayId)
    ])
  }

  return {
    currentTradingDay,
    activeTradingDay,
    positions,
    cashAccount,
    portfolioMetrics,
    activeAlerts,
    orders,
    tradeHistory,
    totalAsset,
    totalPnl,
    totalPnlPercent,
    positionRatio,
    maxDrawdown,
    loadCurrentTradingDay,
    loadActiveTradingDay,
    loadPositions,
    loadCashAccount,
    loadPortfolioMetrics,
    loadActiveAlerts,
    loadOrders,
    loadTradeHistory,
    executeBuy,
    executeSell,
    cancelOrder,
    refreshAll
  }
})
