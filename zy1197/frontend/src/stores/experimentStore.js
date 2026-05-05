import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { experimentApi, seedApi } from '@/api'

export const useExperimentStore = defineStore('experiment', () => {
  const experiments = ref([])
  const currentExperiment = ref(null)
  const currentTimeline = ref([])
  const seedData = ref(null)
  const loading = ref(false)
  const error = ref(null)
  const validationErrors = ref([])
  const validationHints = ref([])

  const statusCounts = computed(() => {
    const counts = {
      created: 0,
      running: 0,
      completed: 0,
      failed: 0
    }
    experiments.value.forEach(exp => {
      counts[exp.status] = (counts[exp.status] || 0) + 1
    })
    return counts
  })

  async function fetchExperiments() {
    loading.value = true
    error.value = null
    try {
      const response = await experimentApi.getAll()
      if (response.data.success) {
        experiments.value = response.data.data
      }
    } catch (err) {
      error.value = err.response?.data?.error || '获取实验列表失败'
      console.error('Fetch experiments error:', err)
    } finally {
      loading.value = false
    }
  }

  async function fetchExperiment(id) {
    loading.value = true
    error.value = null
    try {
      const response = await experimentApi.getById(id)
      if (response.data.success) {
        currentExperiment.value = response.data.data
      }
    } catch (err) {
      error.value = err.response?.data?.error || '获取实验详情失败'
      console.error('Fetch experiment error:', err)
    } finally {
      loading.value = false
    }
  }

  async function fetchTimeline(id, model = null) {
    loading.value = true
    try {
      const response = await experimentApi.getTimeline(id, model)
      if (response.data.success) {
        currentTimeline.value = response.data.data.events
      }
    } catch (err) {
      console.error('Fetch timeline error:', err)
    } finally {
      loading.value = false
    }
  }

  async function fetchSeedData() {
    try {
      const response = await seedApi.getAll()
      if (response.data.success) {
        seedData.value = response.data.data
      }
    } catch (err) {
      console.error('Fetch seed data error:', err)
    }
  }

  async function createExperiment(config) {
    loading.value = true
    error.value = null
    validationErrors.value = []
    validationHints.value = []
    
    try {
      const validateResponse = await experimentApi.validate(config)
      if (!validateResponse.data.valid) {
        validationErrors.value = validateResponse.data.errors
        validationHints.value = validateResponse.data.hints
        throw new Error('参数验证失败')
      }

      const response = await experimentApi.create(validateResponse.data.sanitizedValue)
      if (response.data.success) {
        await fetchExperiments()
        return response.data.data
      }
    } catch (err) {
      error.value = err.response?.data?.error || err.message || '创建实验失败'
      console.error('Create experiment error:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  async function runExperiment(id) {
    loading.value = true
    error.value = null
    try {
      const response = await experimentApi.run(id)
      if (response.data.success) {
        await fetchExperiment(id)
        return response.data
      }
    } catch (err) {
      error.value = err.response?.data?.error || '运行实验失败'
      console.error('Run experiment error:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  async function deleteExperiment(id) {
    try {
      await experimentApi.delete(id)
      await fetchExperiments()
      if (currentExperiment.value?.id === id) {
        currentExperiment.value = null
      }
    } catch (err) {
      error.value = err.response?.data?.error || '删除实验失败'
      console.error('Delete experiment error:', err)
      throw err
    }
  }

  async function validateConfig(config) {
    try {
      const response = await experimentApi.validate(config)
      validationErrors.value = response.data.errors || []
      validationHints.value = response.data.hints || []
      return response.data
    } catch (err) {
      console.error('Validate config error:', err)
      return { valid: false, errors: [], hints: [] }
    }
  }

  function clearValidation() {
    validationErrors.value = []
    validationHints.value = []
  }

  function setCurrentExperiment(experiment) {
    currentExperiment.value = experiment
  }

  return {
    experiments,
    currentExperiment,
    currentTimeline,
    seedData,
    loading,
    error,
    validationErrors,
    validationHints,
    statusCounts,
    fetchExperiments,
    fetchExperiment,
    fetchTimeline,
    fetchSeedData,
    createExperiment,
    runExperiment,
    deleteExperiment,
    validateConfig,
    clearValidation,
    setCurrentExperiment
  }
})
