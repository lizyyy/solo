<template>
  <div class="space-y-4">
    <div v-if="record.calculation">
      <div class="bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg p-4">
        <div class="flex items-center justify-between">
          <div>
            <div class="text-sm opacity-80">拥堵评分</div>
            <div class="text-3xl font-bold">{{ record.calculation.score }}</div>
          </div>
          <div class="text-right">
            <div class="text-sm opacity-80">评估等级</div>
            <div class="text-xl font-bold">{{ getLevelText(record.calculation.level) }}</div>
          </div>
        </div>
      </div>

      <div>
        <h6 class="text-sm font-medium text-gray-700 mb-3">评分因子占比</h6>
        <div class="space-y-2">
          <div
            v-for="(value, key) in record.calculation.factors"
            :key="key"
            class="flex items-center gap-3"
          >
            <span class="text-sm text-gray-600 w-24">{{ getFactorName(key as string) }}</span>
            <div class="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
              <div
                class="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full"
                :style="{ width: `${(value as number) / 25 * 100}%` }"
              ></div>
            </div>
            <span class="text-sm font-medium text-gray-800 w-10 text-right">{{ value }}</span>
          </div>
        </div>
      </div>

      <div class="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div class="flex items-center justify-between mb-3">
          <h6 class="text-sm font-medium text-gray-700">模型参数版本</h6>
          <span class="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
            {{ record.calculation.paramsSnapshot.version }}
          </span>
        </div>

        <div class="text-sm text-gray-600 mb-3">
          {{ record.calculation.paramsSnapshot.name }}
        </div>

        <div class="text-xs text-gray-500 mb-3">
          {{ record.calculation.paramsSnapshot.description }}
        </div>

        <div class="grid grid-cols-2 gap-2 mb-3">
          <div
            v-for="(value, key) in record.calculation.paramsSnapshot.parameters"
            :key="key"
            class="bg-white rounded p-2 border border-gray-200"
          >
            <div class="text-xs text-gray-500">{{ getParamName(key as string) }}</div>
            <div class="text-sm font-medium text-gray-800">{{ value }}</div>
          </div>
        </div>

        <div class="bg-yellow-50 border border-yellow-200 rounded p-3">
          <div class="text-xs font-medium text-yellow-700 mb-1">⚖️ 取舍理由</div>
          <p class="text-xs text-yellow-600">{{ record.calculation.paramsSnapshot.tradeOffs }}</p>
        </div>

        <div class="text-xs text-gray-500 mt-3">
          计算时间：{{ record.calculation.calculatedAt }}
        </div>
      </div>
    </div>

    <div v-else class="text-center py-8 text-gray-400">
      <p class="text-3xl mb-2">📊</p>
      <p>暂无模型计算结果</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CongestionRecord } from '../types'

defineProps<{
  record: CongestionRecord
}>()

function getLevelText(level: string) {
  const map: Record<string, string> = {
    severe: '严重拥堵',
    high: '高度拥堵',
    medium: '中度拥堵',
    low: '轻度拥堵'
  }
  return map[level] || level
}

function getFactorName(key: string) {
  const map: Record<string, string> = {
    distance: '距离因素',
    householdDensity: '小区密度',
    peakVolume: '高峰流量',
    historicalIncident: '历史事件'
  }
  return map[key] || key
}

function getParamName(key: string) {
  const map: Record<string, string> = {
    distanceWeight: '距离权重',
    householdWeight: '户数权重',
    peakHourWeight: '高峰权重',
    historicalDataWeight: '历史数据权重'
  }
  return map[key] || key
}
</script>
