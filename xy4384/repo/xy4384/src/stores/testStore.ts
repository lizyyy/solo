import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type {
  TestRound,
  AnalysisResult,
  ReviewRecord,
  RiskItem,
  SupportConfiguration,
  SensorCalibration
} from '@/types'

export const useTestStore = defineStore('test', () => {
  const testRounds = ref<TestRound[]>([])
  const analysisResults = ref<AnalysisResult[]>([])
  const reviewRecords = ref<ReviewRecord[]>([])
  const supportConfigs = ref<SupportConfiguration[]>([])
  const riskItems = ref<RiskItem[]>([])
  const selectedTestRoundId = ref<string | null>(null)
  const isLoading = ref(false)

  const selectedTestRound = computed(() => {
    return testRounds.value.find(t => t.id === selectedTestRoundId.value) || null
  })

  const selectedAnalysisResult = computed(() => {
    return analysisResults.value.find(a => a.testRoundId === selectedTestRoundId.value) || null
  })

  const selectedReviewRecord = computed(() => {
    return reviewRecords.value.find(r => r.testRoundId === selectedTestRoundId.value) || null
  })

  const testRoundsWithStatus = computed(() => {
    return testRounds.value.map(testRound => {
      const analysis = analysisResults.value.find(a => a.testRoundId === testRound.id)
      const review = reviewRecords.value.find(r => r.testRoundId === testRound.id)
      return {
        ...testRound,
        analysisStatus: analysis?.overallStatus || 'pending',
        reviewStatus: review?.status || 'pending'
      }
    })
  })

  const addTestRound = (testRound: TestRound) => {
    testRounds.value.push(testRound)
  }

  const addAnalysisResult = (result: AnalysisResult) => {
    const existingIndex = analysisResults.value.findIndex(a => a.testRoundId === result.testRoundId)
    if (existingIndex >= 0) {
      analysisResults.value[existingIndex] = result
    } else {
      analysisResults.value.push(result)
    }
  }

  const addReviewRecord = (record: ReviewRecord) => {
    const existingIndex = reviewRecords.value.findIndex(r => r.testRoundId === record.testRoundId)
    if (existingIndex >= 0) {
      reviewRecords.value[existingIndex] = record
    } else {
      reviewRecords.value.push(record)
    }
  }

  const addSupportConfig = (config: SupportConfiguration) => {
    supportConfigs.value.push(config)
  }

  const addRiskItem = (item: RiskItem) => {
    riskItems.value.push(item)
  }

  const selectTestRound = (id: string | null) => {
    selectedTestRoundId.value = id
  }

  const deleteTestRound = (id: string) => {
    testRounds.value = testRounds.value.filter(t => t.id !== id)
    analysisResults.value = analysisResults.value.filter(a => a.testRoundId !== id)
    reviewRecords.value = reviewRecords.value.filter(r => r.testRoundId !== id)
    riskItems.value = riskItems.value.filter(r => r.testRoundId !== id)
    if (selectedTestRoundId.value === id) {
      selectedTestRoundId.value = null
    }
  }

  const updateRiskItemStatus = (id: string, status: RiskItem['status'], resolvedBy?: string, notes?: string) => {
    const item = riskItems.value.find(r => r.id === id)
    if (item) {
      item.status = status
      if (status === 'resolved' && resolvedBy) {
        item.resolvedBy = resolvedBy
        item.resolvedAt = new Date().toISOString()
      }
      if (notes) {
        item.notes = notes
      }
    }
  }

  const clearAll = () => {
    testRounds.value = []
    analysisResults.value = []
    reviewRecords.value = []
    supportConfigs.value = []
    riskItems.value = []
    selectedTestRoundId.value = null
  }

  const getSupportConfig = (id: string) => {
    return supportConfigs.value.find(c => c.id === id)
  }

  return {
    testRounds,
    analysisResults,
    reviewRecords,
    supportConfigs,
    riskItems,
    selectedTestRoundId,
    selectedTestRound,
    selectedAnalysisResult,
    selectedReviewRecord,
    testRoundsWithStatus,
    isLoading,
    addTestRound,
    addAnalysisResult,
    addReviewRecord,
    addSupportConfig,
    addRiskItem,
    selectTestRound,
    deleteTestRound,
    updateRiskItemStatus,
    clearAll,
    getSupportConfig
  }
})
