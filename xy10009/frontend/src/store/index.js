import { createStore } from 'vuex'
import { authApi } from '@/services/api'
import offlineStorage from '@/services/offlineStorage'

export default createStore({
  state: {
    user: null,
    token: null,
    isOnline: navigator.onLine,
    isSyncing: false,
    currentTask: null,
    localCounts: [],
    warehouses: [],
    products: []
  },

  mutations: {
    SET_USER(state, user) {
      state.user = user
    },
    SET_TOKEN(state, token) {
      state.token = token
    },
    SET_ONLINE(state, isOnline) {
      state.isOnline = isOnline
    },
    SET_SYNCING(state, isSyncing) {
      state.isSyncing = isSyncing
    },
    SET_CURRENT_TASK(state, task) {
      state.currentTask = task
    },
    SET_LOCAL_COUNTS(state, counts) {
      state.localCounts = counts
    },
    SET_WAREHOUSES(state, warehouses) {
      state.warehouses = warehouses
    },
    SET_PRODUCTS(state, products) {
      state.products = products
    },
    LOGOUT(state) {
      state.user = null
      state.token = null
      localStorage.removeItem('token')
      localStorage.removeItem('user')
    }
  },

  actions: {
    async login({ commit }, credentials) {
      try {
        const response = await authApi.login(credentials)
        const { token, user } = response.data

        localStorage.setItem('token', token)
        localStorage.setItem('user', JSON.stringify(user))

        commit('SET_TOKEN', token)
        commit('SET_USER', user)

        return response
      } catch (error) {
        throw error
      }
    },

    async logout({ commit }) {
      commit('LOGOUT')
    },

    checkAuth({ commit }) {
      const token = localStorage.getItem('token')
      const userStr = localStorage.getItem('user')

      if (token && userStr) {
        try {
          const user = JSON.parse(userStr)
          commit('SET_TOKEN', token)
          commit('SET_USER', user)
          return true
        } catch (e) {
          return false
        }
      }
      return false
    },

    updateOnlineStatus({ commit }, isOnline) {
      commit('SET_ONLINE', isOnline)
    },

    setCurrentTask({ commit }, task) {
      commit('SET_CURRENT_TASK', task)
    },

    async syncLocalCounts({ commit, state }) {
      if (state.currentTask) {
        const counts = await offlineStorage.getLocalCountsByTask(state.currentTask.id)
        commit('SET_LOCAL_COUNTS', counts)
      }
    },

    async saveCount({ dispatch }, countData) {
      await offlineStorage.saveLocalCount(countData)
      await dispatch('syncLocalCounts')
    },

    async loadOfflineData({ commit, state }) {
      const pendingQueue = await offlineStorage.getPendingQueue()
      console.log('待同步队列:', pendingQueue.length)

      const localCounts = await offlineStorage.getUnsyncedCounts()
      console.log('未同步盘点数据:', localCounts.length)
    }
  },

  getters: {
    isAuthenticated: state => !!state.token,
    isAdmin: state => state.user?.role === 'admin',
    currentTaskId: state => state.currentTask?.id,
    pendingCount: state => state.currentTask?.pendingCount || 0
  }
})
