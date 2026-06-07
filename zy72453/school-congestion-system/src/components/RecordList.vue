<template>
  <div class="bg-white rounded-lg shadow-sm border border-gray-100">
    <div class="p-4 border-b border-gray-100">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-semibold text-gray-800">拥堵记录列表</h3>
        <div class="flex gap-2">
          <button
            v-for="tab in tabs"
            :key="tab.value"
            @click="setActiveTab(tab.value)"
            :class="[
              'px-3 py-1.5 rounded-md text-sm transition-colors',
              activeTab === tab.value
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            ]"
          >
            {{ tab.label }}
          </button>
        </div>
      </div>
    </div>

    <div class="divide-y divide-gray-100">
      <div
        v-for="record in filteredRecords"
        :key="record.id"
        @click="setSelectedRecord(record.id)"
        :class="[
          'p-4 cursor-pointer transition-colors hover:bg-gray-50',
          selectedRecordId === record.id ? 'bg-blue-50' : ''
        ]"
      >
        <div class="flex items-start justify-between">
          <div class="flex-1">
            <div class="flex items-center gap-3 mb-2">
              <span class="font-medium text-gray-800">{{ record.redLineNote.communityName }}</span>
              <span :class="['px-2 py-0.5 rounded text-xs font-medium border', getLevelClass(record.redLineNote.congestionLevel)]">
                {{ getLevelText(record.redLineNote.congestionLevel) }}
              </span>
              <span v-if="record.needsReview" class="px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-700 border border-yellow-200">
                待复核
              </span>
            </div>
            <p class="text-sm text-gray-600 mb-2">{{ record.redLineNote.schoolName }} · {{ record.redLineNote.distanceToSchool }}米</p>
            <p class="text-sm text-gray-500">{{ record.redLineNote.noteContent }}</p>

            <div class="flex items-center gap-4 mt-3">
              <div class="flex items-center gap-1">
                <div
                  v-for="(step, index) in flowSteps"
                  :key="step.value"
                  :class="[
                    'w-6 h-6 rounded-full flex items-center justify-center text-xs',
                    getFlowStepClass(step.value, record.flowStep, index)
                  ]"
                >
                  {{ index + 1 }}
                </div>
              </div>
              <span class="text-xs text-gray-500">最后更新: {{ record.updatedAt }}</span>
            </div>
          </div>

          <div v-if="record.needsReview && record.reviewReason" class="ml-4 max-w-xs">
            <div class="text-xs text-yellow-600 bg-yellow-50 p-2 rounded border border-yellow-200">
              {{ record.reviewReason }}
            </div>
          </div>
        </div>
      </div>

      <div v-if="filteredRecords.length === 0" class="p-8 text-center text-gray-500">
        暂无记录
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useStore } from '../store'

const { state, filteredRecords, setSelectedRecord, setActiveTab } = useStore()

const tabs = [
  { value: 'all' as const, label: '全部' },
  { value: 'pending' as const, label: '处理中' },
  { value: 'needsReview' as const, label: '待复核' }
]

const flowSteps = [
  { value: 'import' as const, label: '导入' },
  { value: 'inspector_review' as const, label: '网格员巡查' },
  { value: 'summary_update' as const, label: '街道摘要' }
]

const activeTab = state.activeTab
const selectedRecordId = state.selectedRecordId

function getLevelClass(level: string) {
  const map: Record<string, string> = {
    severe: 'level-severe',
    high: 'level-high',
    medium: 'level-medium',
    low: 'level-low'
  }
  return map[level] || 'level-medium'
}

function getLevelText(level: string) {
  const map: Record<string, string> = {
    severe: '严重',
    high: '高度',
    medium: '中度',
    low: '轻度'
  }
  return map[level] || '中度'
}

function getFlowStepClass(step: string, currentStep: string, index: number) {
  const stepOrder = ['import', 'inspector_review', 'summary_update']
  const currentIndex = stepOrder.indexOf(currentStep)
  const stepIndex = stepOrder.indexOf(step)

  if (stepIndex < currentIndex) return 'flow-step-completed'
  if (stepIndex === currentIndex) return 'flow-step-active'
  return 'flow-step-pending'
}
</script>
