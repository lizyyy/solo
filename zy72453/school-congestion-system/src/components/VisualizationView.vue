<template>
  <div class="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-lg font-semibold text-gray-800">数据可视化</h3>
      <div class="flex gap-2">
        <button
          v-for="mode in viewModes"
          :key="mode.value"
          @click="setViewMode(mode.value)"
          :class="[
            'px-3 py-1.5 rounded-md text-sm transition-colors',
            viewMode === mode.value
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          ]"
        >
          {{ mode.label }}
        </button>
      </div>
    </div>

    <div v-if="viewMode === 'chart'" class="space-y-6">
      <div>
        <h4 class="text-sm font-medium text-gray-700 mb-3">拥堵等级分布（点击柱子跳转到对应记录）</h4>
        <div class="flex items-end gap-4 h-48">
          <div
            v-for="item in levelDistribution"
            :key="item.level"
            class="flex-1 flex flex-col items-center"
          >
            <div
              :class="[
                'w-full rounded-t transition-all cursor-pointer hover:opacity-80 relative group',
                item.bgClass,
                selectedLevel === item.level ? 'ring-2 ring-offset-2 ring-blue-500' : ''
              ]"
              :style="{ height: `${item.height}%` }"
              @click="handleLevelClick(item.level)"
            >
              <div
                v-if="item.count > 0 && selectedLevel === item.level"
                class="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap"
              >
                共 {{ item.count }} 条 · 已定位第1条
              </div>
            </div>
            <div class="mt-2 text-sm font-medium text-gray-800">{{ item.count }}</div>
            <div class="text-xs text-gray-500">{{ item.label }}</div>
          </div>
        </div>
      </div>

      <div>
        <h4 class="text-sm font-medium text-gray-700 mb-3">流程进度分布（点击进度条跳转到对应记录）</h4>
        <div class="space-y-3">
          <div
            v-for="step in flowDistribution"
            :key="step.step"
            class="flex items-center gap-3 cursor-pointer hover:bg-gray-50 rounded-md p-1 -ml-1 transition-colors"
            @click="handleFlowStepClick(step.step)"
          >
            <span class="text-sm text-gray-600 w-24">{{ step.label }}</span>
            <div class="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
              <div
                :class="['h-full flex items-center justify-end pr-2 text-xs text-white', step.bgClass]"
                :style="{ width: `${step.percent}%` }"
              >
                {{ step.count }}
              </div>
            </div>
            <span class="text-sm text-gray-500 w-12">{{ step.percent }}%</span>
          </div>
        </div>
      </div>

      <div class="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <p class="text-sm text-blue-700 mb-1">
          💡 点击图表中的数据点，可直接跳转到对应原始记录的红线图备注详情
        </p>
        <p v-if="selectedRecord" class="text-xs text-blue-600 mt-1">
          📌 当前定位：<span class="font-medium">{{ selectedRecord.redLineNote.communityName }}</span>
          <span class="text-blue-500 ml-2">(ID: {{ selectedRecord.id }})</span>
        </p>
      </div>
    </div>

    <div v-else-if="viewMode === '3d'" class="relative">
      <div class="aspect-video bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg flex items-center justify-center relative overflow-hidden">
        <div class="absolute inset-0 flex items-center justify-center">
          <div
            v-for="(record, index) in records"
            :key="record.id"
            :style="{
              transform: `translate3d(${getX(index)}px, ${getY(index)}px, ${getZ(record)}px)`,
              opacity: getOpacity(record)
            }"
            class="absolute transition-all cursor-pointer hover:scale-110"
            @click="handle3DClick(record)"
          >
            <div
              :class="[
                'w-16 h-16 rounded-lg flex items-center justify-center text-white text-xs font-medium shadow-lg',
                get3DBlockClass(record)
              ]"
            >
              <div class="text-center">
                <div class="text-lg font-bold">{{ getSeverityScore(record) }}</div>
                <div class="text-[10px] opacity-80">{{ record.redLineNote.communityName.slice(0, 4) }}</div>
              </div>
            </div>
          </div>
        </div>

        <div class="absolute bottom-4 left-4 bg-white bg-opacity-90 rounded px-3 py-2 text-xs text-gray-600">
          <div class="font-medium mb-1">图例</div>
          <div class="space-y-1">
            <div class="flex items-center gap-2">
              <span class="w-3 h-3 rounded bg-red-500"></span>
              <span>严重拥堵</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="w-3 h-3 rounded bg-orange-500"></span>
              <span>高度拥堵</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="w-3 h-3 rounded bg-yellow-500"></span>
              <span>中度拥堵</span>
            </div>
          </div>
        </div>

        <div class="absolute top-4 right-4 bg-white bg-opacity-90 rounded px-3 py-2 text-xs text-gray-600">
          <div>X轴: 距离学校</div>
          <div>Y轴: 小区规模</div>
          <div>Z轴: 拥堵等级</div>
        </div>
      </div>

      <div class="mt-3 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
        <p class="text-sm text-yellow-700">
          🎯 点击 3D 视图中的方块，可以直接跳转到该记录的红线图备注或网格员巡查表详情
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useStore, type DetailTab } from '../store'

const {
  state,
  setViewMode,
  selectRecordAndJump,
  findFirstRecordByLevel,
  findFirstRecordByFlowStep,
  selectedRecord
} = useStore()

const viewMode = computed(() => state.viewMode)
const records = computed(() => state.records)

const selectedLevel = ref<string | null>(null)

const viewModes = [
  { value: 'chart' as const, label: '📊 图表' },
  { value: '3d' as const, label: '🧊 3D 视图' }
]

const levelDistribution = computed(() => {
  const counts: Record<string, number> = { severe: 0, high: 0, medium: 0, low: 0 }
  records.value.forEach(r => {
    counts[r.redLineNote.congestionLevel]++
  })
  const max = Math.max(...Object.values(counts), 1)
  return [
    { level: 'severe', label: '严重', count: counts.severe, height: (counts.severe / max) * 100, bgClass: 'bg-red-500' },
    { level: 'high', label: '高度', count: counts.high, height: (counts.high / max) * 100, bgClass: 'bg-orange-500' },
    { level: 'medium', label: '中度', count: counts.medium, height: (counts.medium / max) * 100, bgClass: 'bg-yellow-500' },
    { level: 'low', label: '轻度', count: counts.low, height: (counts.low / max) * 100, bgClass: 'bg-green-500' }
  ]
})

const flowDistribution = computed(() => {
  const counts: Record<string, number> = { import: 0, inspector_review: 0, summary_update: 0 }
  records.value.forEach(r => {
    counts[r.flowStep]++
  })
  const total = records.value.length || 1
  return [
    { step: 'import', label: '第一步：导入', count: counts.import, percent: Math.round(counts.import / total * 100), bgClass: 'bg-blue-500' },
    { step: 'inspector_review', label: '第二步：网格员巡查', count: counts.inspector_review, percent: Math.round(counts.inspector_review / total * 100), bgClass: 'bg-purple-500' },
    { step: 'summary_update', label: '第三步：街道摘要', count: counts.summary_update, percent: Math.round(counts.summary_update / total * 100), bgClass: 'bg-green-500' }
  ]
})

function handleLevelClick(level: string) {
  selectedLevel.value = level
  const record = findFirstRecordByLevel(level)
  if (record) {
    selectRecordAndJump(record.id, 'redline')
  }
}

function handleFlowStepClick(step: string) {
  const record = findFirstRecordByFlowStep(step)
  if (!record) return
  const tabMap: Record<string, DetailTab> = {
    import: 'redline',
    inspector_review: 'inspector',
    summary_update: 'summary'
  }
  selectRecordAndJump(record.id, tabMap[step] || 'redline')
}

function getX(index: number) {
  return (index % 3 - 1) * 120
}

function getY(index: number) {
  return (Math.floor(index / 3) - 1) * 100
}

function getZ(record: typeof records.value[0]) {
  const levelMap: Record<string, number> = { low: 0, medium: 30, high: 60, severe: 100 }
  return levelMap[record.redLineNote.congestionLevel] || 0
}

function getOpacity(record: typeof records.value[0]) {
  const levelMap: Record<string, number> = { low: 0.5, medium: 0.7, high: 0.85, severe: 1 }
  return levelMap[record.redLineNote.congestionLevel] || 0.5
}

function get3DBlockClass(record: typeof records.value[0]) {
  const map: Record<string, string> = {
    severe: 'bg-red-500',
    high: 'bg-orange-500',
    medium: 'bg-yellow-500',
    low: 'bg-green-500'
  }
  return map[record.redLineNote.congestionLevel] || 'bg-gray-500'
}

function getSeverityScore(record: typeof records.value[0]) {
  const map: Record<string, string> = { severe: 'S', high: 'H', medium: 'M', low: 'L' }
  return map[record.redLineNote.congestionLevel] || 'M'
}

function handle3DClick(record: typeof records.value[0]) {
  const targetTab: DetailTab = record.gridInspector ? 'inspector' : 'redline'
  selectRecordAndJump(record.id, targetTab)
}
</script>
