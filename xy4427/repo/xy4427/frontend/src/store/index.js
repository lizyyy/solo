import { createStore } from 'vuex'

export default createStore({
  state: {
    riskStats: {
      total: 0,
      byStatus: {
        pending: 0,
        reviewed: 0,
        overruled: 0,
        resolved: 0,
        ignored: 0
      },
      byType: {}
    },
    teacherName: localStorage.getItem('teacherName') || '',
    importHistory: JSON.parse(localStorage.getItem('importHistory') || '[]')
  },
  getters: {
    totalRisks: (state) => state.riskStats.total,
    pendingRisks: (state) => state.riskStats.byStatus.pending,
    canRelease: (state) => state.riskStats.byStatus.pending === 0
  },
  mutations: {
    SET_RISK_STATS(state, stats) {
      state.riskStats = stats
    },
    SET_TEACHER_NAME(state, name) {
      state.teacherName = name
      localStorage.setItem('teacherName', name)
    },
    ADD_IMPORT_HISTORY(state, record) {
      state.importHistory.unshift(record)
      if (state.importHistory.length > 50) {
        state.importHistory = state.importHistory.slice(0, 50)
      }
      localStorage.setItem('importHistory', JSON.stringify(state.importHistory))
    },
    CLEAR_IMPORT_HISTORY(state) {
      state.importHistory = []
      localStorage.removeItem('importHistory')
    }
  },
  actions: {
    updateRiskStats({ commit }, stats) {
      commit('SET_RISK_STATS', stats)
    },
    updateTeacherName({ commit }, name) {
      commit('SET_TEACHER_NAME', name)
    },
    addImportHistory({ commit }, record) {
      commit('ADD_IMPORT_HISTORY', record)
    },
    clearImportHistory({ commit }) {
      commit('CLEAR_IMPORT_HISTORY')
    }
  },
  modules: {}
})
