<template>
  <div v-if="record" class="bg-white rounded-lg shadow-sm border border-gray-100 h-full overflow-y-auto">
    <div class="p-4 border-b border-gray-100 bg-gray-50">
      <div class="flex items-center justify-between">
        <h3 class="text-lg font-semibold text-gray-800">记录详情</h3>
        <button @click="setSelectedRecord(null)" class="text-gray-400 hover:text-gray-600">
          ✕
        </button>
      </div>
    </div>

    <div class="p-4 space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <h4 class="text-xl font-semibold text-gray-800">{{ record.redLineNote.communityName }}</h4>
          <p class="text-sm text-gray-500 mt-1">{{ record.redLineNote.schoolName }} · 距离 {{ record.redLineNote.distanceToSchool }}米</p>
        </div>
        <span :class="['px-3 py-1 rounded-full text-sm font-medium border', getLevelClass(record.redLineNote.congestionLevel)]">
          {{ getLevelText(record.redLineNote.congestionLevel) }}
        </span>
      </div>

      <div v-if="record.needsReview" class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div class="flex items-start gap-3">
          <span class="text-yellow-500 text-xl">⚠️</span>
          <div>
            <h5 class="font-medium text-yellow-800 mb-1">需市政巡检员复核</h5>
            <p class="text-sm text-yellow-700">{{ record.reviewReason }}</p>
            <div v-if="currentUser === 'inspector' && !record.reviewedByInspector" class="mt-3 flex gap-2">
              <button
                @click="handleInspectorReview(true)"
                class="px-3 py-1.5 bg-green-500 text-white rounded text-sm hover:bg-green-600"
              >
                确认无误
              </button>
              <button
                @click="handleInspectorReview(false)"
                class="px-3 py-1.5 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300"
              >
                标记问题
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="border border-gray-200 rounded-lg overflow-hidden">
        <div class="flex border-b border-gray-200">
          <button
            v-for="tab in detailTabs"
            :key="tab.value"
            @click="activeDetailTab = tab.value"
            :class="[
              'flex-1 px-4 py-3 text-sm font-medium transition-colors',
              activeDetailTab === tab.value
                ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-500'
                : 'text-gray-600 hover:bg-gray-50'
            ]"
          >
            {{ tab.label }}
          </button>
        </div>

        <div class="p-4">
          <div v-show="activeDetailTab === 'redline'">
            <RedLineNoteEditor :record="record" />
          </div>

          <div v-show="activeDetailTab === 'inspector'">
            <GridInspectorView :record="record" />
          </div>

          <div v-show="activeDetailTab === 'summary'">
            <StreetSummaryView :record="record" />
          </div>

          <div v-show="activeDetailTab === 'history'">
            <HistoryVersionView :record="record" />
          </div>

          <div v-show="activeDetailTab === 'calculation'">
            <CalculationView :record="record" />
          </div>
        </div>
      </div>
    </div>
  </div>

  <div v-else class="bg-white rounded-lg shadow-sm border border-gray-100 h-full flex items-center justify-center">
    <div class="text-center text-gray-400">
      <p class="text-4xl mb-2">📋</p>
      <p>请选择一条记录查看详情</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useStore } from '../store'
import RedLineNoteEditor from './RedLineNoteEditor.vue'
import GridInspectorView from './GridInspectorView.vue'
import StreetSummaryView from './StreetSummaryView.vue'
import HistoryVersionView from './HistoryVersionView.vue'
import CalculationView from './CalculationView.vue'

const { selectedRecord, setSelectedRecord, inspectorReview, state } = useStore()

const record = selectedRecord
const currentUser = state.currentUser

const activeDetailTab = ref('redline')

const detailTabs = [
  { value: 'redline', label: '红线图备注' },
  { value: 'inspector', label: '网格员巡查表' },
  { value: 'summary', label: '街道会看摘要' },
  { value: 'history', label: '历史版本' },
  { value: 'calculation', label: '模型计算' }
]

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
    severe: '严重拥堵',
    high: '高度拥堵',
    medium: '中度拥堵',
    low: '轻度拥堵'
  }
  return map[level] || '中度拥堵'
}

function handleInspectorReview(approved: boolean) {
  if (record.value) {
    inspectorReview(record.value.id, approved, approved ? '名称核实无误' : '需要进一步确认')
  }
}
</script>
