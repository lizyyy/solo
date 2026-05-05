<template>
  <div class="space-y-6">
    <div class="bg-white rounded-xl shadow-sm border p-6">
      <h3 class="text-lg font-medium text-gray-900 mb-4">当前排名</h3>
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">排名</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">运动员</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">队伍</th>
              <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">总分</th>
              <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">分差</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr
              v-for="(athlete, index) in currentRanking"
              :key="athlete.athleteId"
              class="hover:bg-gray-50"
              :class="getRankRowClass(athlete, index)"
            >
              <td class="px-4 py-3 whitespace-nowrap">
                <span class="inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium"
                  :class="getRankBadgeClass(athlete.rank)">
                  {{ athlete.rank }}
                </span>
              </td>
              <td class="px-4 py-3 whitespace-nowrap">
                <div class="font-medium text-gray-900">{{ athlete.name }}</div>
                <div class="text-xs text-gray-500">{{ athlete.athleteId }}</div>
              </td>
              <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                {{ athlete.team || '-' }}
              </td>
              <td class="px-4 py-3 whitespace-nowrap text-right">
                <span class="text-sm font-semibold text-gray-900">{{ athlete.totalScore }}</span>
              </td>
              <td class="px-4 py-3 whitespace-nowrap text-center">
                <span v-if="index > 0" class="text-xs"
                  :class="getScoreDiffClass(getScoreDiff(athlete, index))">
                  {{ formatScoreDiff(getScoreDiff(athlete, index)) }}
                </span>
                <span v-else class="text-xs text-gray-400">—</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-if="rankRisks && rankRisks.length > 0" class="bg-white rounded-xl shadow-sm border p-6">
      <h3 class="text-lg font-medium text-gray-900 mb-4">排名风险 (分差较小)</h3>
      <div class="space-y-4">
        <div
          v-for="(risk, index) in rankRisks"
          :key="index"
          class="border rounded-lg overflow-hidden"
          :class="risk.severity === 'high' ? 'border-red-300' : 'border-amber-300'"
        >
          <div class="px-4 py-3 flex items-center justify-between"
            :class="risk.severity === 'high' ? 'bg-red-50' : 'bg-amber-50'">
            <div class="flex items-center space-x-3">
              <svg class="w-5 h-5"
                :class="risk.severity === 'high' ? 'text-red-500' : 'text-amber-500'"
                fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span class="font-medium" :class="risk.severity === 'high' ? 'text-red-800' : 'text-amber-800'">
                {{ risk.description }}
              </span>
            </div>
            <span class="tag" :class="risk.severity === 'high' ? 'tag-danger' : 'tag-warning'">
              分差: {{ risk.scoreDifference }} 分
            </span>
          </div>
          <div class="p-4">
            <div class="grid grid-cols-2 gap-4">
              <div
                v-for="(a, i) in risk.athletes"
                :key="i"
                class="p-3 bg-gray-50 rounded-lg"
              >
                <div class="flex items-center justify-between">
                  <span class="font-medium text-gray-900">{{ a.name }}</span>
                  <span class="text-sm text-gray-500">第{{ a.rank }}名</span>
                </div>
                <div class="mt-1 text-sm text-gray-600">{{ a.team }}</div>
                <div class="mt-1 text-lg font-semibold text-gray-900">{{ a.score.toFixed(2) }} 分</div>
              </div>
            </div>
            <div class="mt-3 p-3 bg-blue-50 rounded-lg">
              <p class="text-sm text-blue-700">
                <strong>风险说明:</strong> {{ risk.note }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="appealImpact && appealImpact.length > 0" class="bg-white rounded-xl shadow-sm border p-6">
      <h3 class="text-lg font-medium text-gray-900 mb-4">申诉可能带来的排名变化</h3>
      <div class="space-y-4">
        <div
          v-for="(impact, index) in appealImpact"
          :key="index"
          class="border border-green-300 rounded-lg overflow-hidden"
        >
          <div class="px-4 py-3 bg-green-50 flex items-center justify-between">
            <div class="flex items-center space-x-3">
              <svg class="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span class="font-medium text-green-800">
                {{ impact.athleteName }} - 潜在加分可能影响排名
              </span>
            </div>
            <span class="tag tag-success">
              可能加分: +{{ impact.potentialGain }}
            </span>
          </div>
          <div class="p-4">
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div class="p-3 bg-gray-50 rounded-lg text-center">
                <p class="text-xs text-gray-500">当前排名</p>
                <p class="text-xl font-bold text-gray-900">第{{ impact.currentRank }}名</p>
                <p class="text-sm text-gray-600">{{ impact.currentScore.toFixed(2) }} 分</p>
              </div>
              <div class="p-3 bg-green-50 rounded-lg text-center">
                <p class="text-xs text-green-600">潜在加分</p>
                <p class="text-xl font-bold text-green-700">+{{ impact.potentialGain }}</p>
                <p class="text-sm text-green-600">→ {{ impact.potentialScore }} 分</p>
              </div>
              <div class="p-3 bg-amber-50 rounded-lg text-center">
                <p class="text-xs text-amber-600">可能超越</p>
                <p class="text-xl font-bold text-amber-700">{{ impact.potentialOvertake?.length || 0 }}</p>
                <p class="text-sm text-amber-600">名运动员</p>
              </div>
            </div>

            <div v-if="impact.potentialOvertake && impact.potentialOvertake.length > 0">
              <h4 class="text-sm font-medium text-gray-700 mb-2">可能超越的运动员:</h4>
              <div class="space-y-2">
                <div
                  v-for="(a, i) in impact.potentialOvertake"
                  :key="i"
                  class="flex items-center justify-between p-2 bg-amber-50 rounded-lg"
                >
                  <div>
                    <span class="font-medium text-gray-900">{{ a.name }}</span>
                    <span class="text-sm text-gray-500 ml-2">(第{{ a.rank }}名)</span>
                  </div>
                  <span class="text-sm font-medium text-gray-700">{{ a.score.toFixed(2) }} 分</span>
                </div>
              </div>
            </div>

            <div class="mt-4 p-3 bg-gray-50 rounded-lg">
              <h4 class="text-sm font-medium text-gray-700 mb-1">相关申诉:</h4>
              <div class="text-sm text-gray-600">
                <span class="font-medium">{{ impact.relatedAppeal?.id || '-' }}</span>
                <span class="text-gray-400 mx-2">·</span>
                <span>{{ impact.relatedAppeal?.event || '-' }}</span>
                <p class="mt-1 text-xs text-gray-500">{{ impact.relatedAppeal?.complaint }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-else-if="!rankRisks || rankRisks.length === 0" class="text-center py-8 bg-white rounded-xl shadow-sm border">
      <svg class="mx-auto h-12 w-12 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <h3 class="mt-2 text-sm font-medium text-gray-900">排名相对稳定</h3>
      <p class="mt-1 text-sm text-gray-500">当前分差较大，申诉成功对排名影响有限</p>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  analysisResults: Object,
  alignedData: Object
})

const currentRanking = computed(() => 
  props.analysisResults?.rankingImpact?.currentRanking || []
)

const rankRisks = computed(() => 
  props.analysisResults?.rankingImpact?.rankRisks || []
)

const appealImpact = computed(() => 
  props.analysisResults?.rankingImpact?.appealImpact || []
)

function getRankBadgeClass(rank) {
  if (rank === 1) return 'bg-yellow-400 text-white'
  if (rank === 2) return 'bg-gray-300 text-white'
  if (rank === 3) return 'bg-amber-600 text-white'
  return 'bg-gray-100 text-gray-600'
}

function getRankRowClass(athlete, index) {
  if (appealImpact.value.some(i => i.athleteId === athlete.athleteId)) {
    return 'bg-green-50'
  }
  return ''
}

function getScoreDiff(athlete, index) {
  if (index === 0) return 0
  const prev = currentRanking.value[index - 1]
  return parseFloat(prev.totalScore) - parseFloat(athlete.totalScore)
}

function formatScoreDiff(diff) {
  if (diff === 0) return '0'
  return `-${diff.toFixed(2)}`
}

function getScoreDiffClass(diff) {
  if (diff < 0.2) return 'text-red-600 font-medium'
  if (diff < 0.5) return 'text-amber-600 font-medium'
  return 'text-gray-500'
}
</script>
