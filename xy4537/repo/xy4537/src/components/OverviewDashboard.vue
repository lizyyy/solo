<template>
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
    <div class="bg-white rounded-xl shadow-sm border p-5">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm text-gray-500">运动员总数</p>
          <p class="text-2xl font-bold text-gray-900 mt-1">{{ athleteCount }}</p>
        </div>
        <div class="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
          <svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        </div>
      </div>
      <div class="mt-3 text-xs text-gray-500">
        参赛队伍: {{ teamCount }} 支
      </div>
    </div>

    <div class="bg-white rounded-xl shadow-sm border p-5">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm text-gray-500">高优先级问题</p>
          <p class="text-2xl font-bold mt-1" :class="highPriorityCount > 0 ? 'text-red-600' : 'text-green-600'">
            {{ highPriorityCount }}
          </p>
        </div>
        <div :class="[
          'w-12 h-12 rounded-lg flex items-center justify-center',
          highPriorityCount > 0 ? 'bg-red-100' : 'bg-green-100'
        ]">
          <svg :class="[
            'w-6 h-6',
            highPriorityCount > 0 ? 'text-red-600' : 'text-green-600'
          ]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path v-if="highPriorityCount > 0" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
      </div>
      <div class="mt-3 text-xs text-gray-500">
        总分差异: {{ scoreIssueCount }} 项
      </div>
    </div>

    <div class="bg-white rounded-xl shadow-sm border p-5">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm text-gray-500">申诉统计</p>
          <p class="text-2xl font-bold text-amber-600 mt-1">{{ totalAppeals }}</p>
        </div>
        <div class="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
          <svg class="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        </div>
      </div>
      <div class="mt-3 text-xs text-gray-500">
        <span class="text-green-600">潜在命中: {{ hitAppeals }}</span> · 
        <span class="text-red-600 ml-1">重复: {{ duplicateAppeals }}</span>
      </div>
    </div>

    <div class="bg-white rounded-xl shadow-sm border p-5">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm text-gray-500">风险等级</p>
          <p class="text-2xl font-bold mt-1" :class="riskLevelClass">{{ riskLevelText }}</p>
        </div>
        <div :class="[
          'w-12 h-12 rounded-lg flex items-center justify-center',
          riskLevel === 'high' ? 'bg-red-100' : riskLevel === 'medium' ? 'bg-amber-100' : 'bg-green-100'
        ]">
          <svg :class="[
            'w-6 h-6',
            riskLevel === 'high' ? 'text-red-600' : riskLevel === 'medium' ? 'text-amber-600' : 'text-green-600'
          ]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
      </div>
      <div class="mt-3 text-xs text-gray-500">
        已完成复核: {{ reviewStats?.total || 0 }} 项
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  alignedData: Object,
  analysisResults: Object,
  reviewStats: Object
})

const athleteCount = computed(() => props.alignedData?.athletes?.length || 0)

const teamCount = computed(() => {
  if (!props.alignedData?.athletes) return 0
  const teams = new Set(props.alignedData.athletes.map(a => a.team))
  return teams.size
})

const highPriorityCount = computed(() => 
  props.analysisResults?.summary?.highPriorityCount || 0
)

const scoreIssueCount = computed(() => 
  props.analysisResults?.scoreDifferences?.issues?.length || 0
)

const totalAppeals = computed(() => 
  props.analysisResults?.appealAnalysis?.total || 0
)

const hitAppeals = computed(() => 
  props.analysisResults?.appealAnalysis?.hitAppeals?.length || 0
)

const duplicateAppeals = computed(() => 
  props.analysisResults?.duplicateAppeals?.count || 0
)

const riskLevel = computed(() => 
  props.analysisResults?.summary?.riskLevel || 'low'
)

const riskLevelText = computed(() => {
  const map = {
    'high': '高风险',
    'medium': '中风险',
    'low': '低风险'
  }
  return map[riskLevel.value] || '未知'
})

const riskLevelClass = computed(() => {
  const map = {
    'high': 'text-red-600',
    'medium': 'text-amber-600',
    'low': 'text-green-600'
  }
  return map[riskLevel.value] || 'text-gray-600'
})
</script>
