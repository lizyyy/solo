import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { tablesApi, scriptsApi, hostsApi, reservationsApi, waitlistApi } from '../api'
import dayjs from 'dayjs'
import { ElMessage } from 'element-plus'

export const useSchedulerStore = defineStore('scheduler', () => {
  const tables = ref([])
  const scripts = ref([])
  const hosts = ref([])
  const reservations = ref([])
  const waitlist = ref([])
  const selectedDate = ref(dayjs().format('YYYY-MM-DD'))
  const loading = ref(false)

  const loadAll = async () => {
    loading.value = true
    try {
      await Promise.all([
        loadTables(),
        loadScripts(),
        loadHosts(),
        loadReservations(),
        loadWaitlist()
      ])
    } finally {
      loading.value = false
    }
  }

  const loadTables = async () => {
    const res = await tablesApi.getAll()
    if (res.data.success) {
      tables.value = res.data.data
    }
  }

  const loadScripts = async () => {
    const res = await scriptsApi.getAll()
    if (res.data.success) {
      scripts.value = res.data.data
    }
  }

  const loadHosts = async () => {
    const res = await hostsApi.getAll()
    if (res.data.success) {
      hosts.value = res.data.data
    }
  }

  const loadReservations = async () => {
    const res = await reservationsApi.getByDate(selectedDate.value)
    if (res.data.success) {
      reservations.value = res.data.data
    }
  }

  const loadWaitlist = async () => {
    const res = await waitlistApi.getAll(selectedDate.value)
    if (res.data.success) {
      waitlist.value = res.data.data
    }
  }

  const createReservation = async (data, idempotencyKey = null) => {
    const payload = idempotencyKey ? { ...data, idempotency_key: idempotencyKey } : data
    const res = await reservationsApi.create(payload)
    if (res.data.success) {
      if (res.data.idempotent) {
        ElMessage.info(res.data.message)
      } else {
        ElMessage.success('预约创建成功')
      }
      await loadReservations()
      return res.data.data
    } else {
      throw new Error(res.data.errors?.join('; ') || '创建失败')
    }
  }

  const updateReservation = async (id, data) => {
    const res = await reservationsApi.update(id, data)
    if (res.data.success) {
      ElMessage.success('预约更新成功')
      await loadReservations()
      return res.data.data
    } else {
      throw new Error(res.data.errors?.join('; ') || '更新失败')
    }
  }

  const cancelReservation = async (id) => {
    const res = await reservationsApi.cancel(id)
    if (res.data.success) {
      ElMessage.success('预约已取消')
      await loadReservations()
    }
  }

  const validateReservation = async (data) => {
    const res = await reservationsApi.validate(data)
    return res.data
  }

  const addToWaitlist = async (data, idempotencyKey = null) => {
    const payload = idempotencyKey ? { ...data, idempotency_key: idempotencyKey } : data
    const res = await waitlistApi.create(payload)
    if (res.data.success) {
      if (res.data.idempotent) {
        ElMessage.info(res.data.message)
      } else {
        ElMessage.success('已加入候补队列')
      }
      await loadWaitlist()
      return res.data.data
    } else {
      throw new Error(res.data.errors?.join('; ') || '加入失败')
    }
  }

  const convertWaitlist = async (id, data, idempotencyKey = null) => {
    const payload = idempotencyKey ? { ...data, idempotency_key: idempotencyKey } : data
    const res = await waitlistApi.convert(id, payload)
    if (res.data.success) {
      if (res.data.idempotent) {
        ElMessage.info(res.data.message)
      } else {
        ElMessage.success('候补转正成功')
      }
      await loadWaitlist()
      await loadReservations()
      return res.data.data
    } else {
      throw new Error(res.data.errors?.join('; ') || '转正失败')
    }
  }

  const getScriptById = (id) => scripts.value.find(s => s.id === id)
  const getTableById = (id) => tables.value.find(t => t.id === id)
  const getHostById = (id) => hosts.value.find(h => h.id === id)

  const reservationsByTable = computed(() => {
    const grouped = {}
    reservations.value.forEach(r => {
      if (!grouped[r.table_id]) {
        grouped[r.table_id] = []
      }
      grouped[r.table_id].push(r)
    })
    return grouped
  })

  const privateReservations = computed(() => 
    reservations.value.filter(r => r.reservation_type === 'private' && r.status !== 'cancelled')
  )

  const sharedReservations = computed(() => 
    reservations.value.filter(r => r.reservation_type === 'shared' && r.status !== 'cancelled')
  )

  return {
    tables,
    scripts,
    hosts,
    reservations,
    waitlist,
    selectedDate,
    loading,
    loadAll,
    loadTables,
    loadScripts,
    loadHosts,
    loadReservations,
    loadWaitlist,
    createReservation,
    updateReservation,
    cancelReservation,
    validateReservation,
    addToWaitlist,
    convertWaitlist,
    getScriptById,
    getTableById,
    getHostById,
    reservationsByTable,
    privateReservations,
    sharedReservations
  }
})
