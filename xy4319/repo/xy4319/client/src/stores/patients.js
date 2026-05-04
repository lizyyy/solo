import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '@/api'

export const usePatientsStore = defineStore('patients', () => {
  const patients = ref([])
  const loading = ref(false)
  const error = ref(null)

  const triageLevels = {
    red: { label: '红区（紧急）', color: '#ef4444', bgColor: '#fecaca' },
    yellow: { label: '黄区（紧急）', color: '#eab308', bgColor: '#fef08a' },
    green: { label: '绿区（非紧急）', color: '#22c55e', bgColor: '#bbf7d0' }
  }

  const statusOptions = [
    { value: 'waiting', label: '等待中' },
    { value: 'triage', label: '分诊中' },
    { value: 'treatment', label: '治疗中' },
    { value: 'transferred', label: '已转运' },
    { value: 'discharged', label: '已出院' }
  ]

  const patientsByTriage = computed(() => ({
    red: patients.value.filter(p => p.triageLevel === 'red'),
    yellow: patients.value.filter(p => p.triageLevel === 'yellow'),
    green: patients.value.filter(p => p.triageLevel === 'green')
  }))

  const patientsByStatus = computed(() => ({
    waiting: patients.value.filter(p => p.status === 'waiting'),
    triage: patients.value.filter(p => p.status === 'triage'),
    treatment: patients.value.filter(p => p.status === 'treatment'),
    transferred: patients.value.filter(p => p.status === 'transferred'),
    discharged: patients.value.filter(p => p.status === 'discharged')
  }))

  const stats = computed(() => ({
    total: patients.value.length,
    red: patientsByTriage.value.red.length,
    yellow: patientsByTriage.value.yellow.length,
    green: patientsByTriage.value.green.length,
    waiting: patientsByStatus.value.waiting.length,
    triage: patientsByStatus.value.triage.length,
    treatment: patientsByStatus.value.treatment.length
  }))

  async function fetchPatients(params = {}) {
    loading.value = true
    error.value = null
    try {
      const response = await api.patients.getAll(params)
      patients.value = response.data
      return response.data
    } catch (err) {
      error.value = err.response?.data?.error || '获取患者列表失败'
      throw err
    } finally {
      loading.value = false
    }
  }

  async function fetchPatient(id) {
    loading.value = true
    error.value = null
    try {
      const response = await api.patients.get(id)
      return response.data
    } catch (err) {
      error.value = err.response?.data?.error || '获取患者信息失败'
      throw err
    } finally {
      loading.value = false
    }
  }

  async function createPatient(data) {
    loading.value = true
    error.value = null
    try {
      const response = await api.patients.create(data)
      patients.value.unshift(response.data)
      return response.data
    } catch (err) {
      error.value = err.response?.data?.error || '创建患者失败'
      throw err
    } finally {
      loading.value = false
    }
  }

  async function updatePatient(id, data) {
    loading.value = true
    error.value = null
    try {
      const response = await api.patients.update(id, data)
      const index = patients.value.findIndex(p => p.id === id)
      if (index !== -1) {
        patients.value[index] = response.data
      }
      return response.data
    } catch (err) {
      error.value = err.response?.data?.error || '更新患者失败'
      throw err
    } finally {
      loading.value = false
    }
  }

  async function deletePatient(id) {
    loading.value = true
    error.value = null
    try {
      await api.patients.delete(id)
      patients.value = patients.value.filter(p => p.id !== id)
    } catch (err) {
      error.value = err.response?.data?.error || '删除患者失败'
      throw err
    } finally {
      loading.value = false
    }
  }

  async function batchImport(patientsData) {
    loading.value = true
    error.value = null
    try {
      const response = await api.patients.batch(patientsData)
      return response.data
    } catch (err) {
      error.value = err.response?.data?.error || '批量导入患者失败'
      throw err
    } finally {
      loading.value = false
    }
  }

  function addPatientToList(patient) {
    const exists = patients.value.find(p => p.id === patient.id)
    if (!exists) {
      patients.value.unshift(patient)
    }
  }

  function updatePatientInList(patient) {
    const index = patients.value.findIndex(p => p.id === patient.id)
    if (index !== -1) {
      patients.value[index] = patient
    }
  }

  function removePatientFromList(id) {
    patients.value = patients.value.filter(p => p.id !== id)
  }

  function getStatusLabel(status) {
    const option = statusOptions.find(o => o.value === status)
    return option?.label || status
  }

  function getTriageLabel(level) {
    return triageLevels[level]?.label || level
  }

  function getTriageColor(level) {
    return triageLevels[level]?.color || '#6b7280'
  }

  function getTriageBgColor(level) {
    return triageLevels[level]?.bgColor || '#e5e7eb'
  }

  return {
    patients,
    loading,
    error,
    triageLevels,
    statusOptions,
    patientsByTriage,
    patientsByStatus,
    stats,
    fetchPatients,
    fetchPatient,
    createPatient,
    updatePatient,
    deletePatient,
    batchImport,
    addPatientToList,
    updatePatientInList,
    removePatientFromList,
    getStatusLabel,
    getTriageLabel,
    getTriageColor,
    getTriageBgColor
  }
})
