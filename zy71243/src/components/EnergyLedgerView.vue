<template>
  <div class="card">
    <h2 class="card-title">📊 能源账本</h2>
    
    <div v-if="entries.length === 0" class="text-center text-muted py-8">
      暂无账本数据，开始游戏后自动记录
    </div>
    
    <div v-else class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="text-left text-muted border-b border-gray-700">
            <th class="pb-2 pr-4">回合</th>
            <th class="pb-2 pr-4">太阳角</th>
            <th class="pb-2 pr-4">发电 (kW)</th>
            <th class="pb-2 pr-4">负载 (kW)</th>
            <th class="pb-2 pr-4">电池 (kWh)</th>
            <th class="pb-2 pr-4">变化</th>
            <th class="pb-2">状态</th>
          </tr>
        </thead>
        <tbody>
          <tr 
            v-for="entry in reversedEntries" 
            :key="entry.turn"
            class="border-b border-gray-800"
          >
            <td class="py-2 pr-4 font-mono">#{{ entry.turn }}</td>
            <td class="py-2 pr-4">{{ entry.sunAngle.toFixed(0) }}°</td>
            <td class="py-2 pr-4 text-success">{{ entry.solarOutput.toFixed(1) }}</td>
            <td class="py-2 pr-4 text-warning">{{ entry.totalLoadDemand.toFixed(1) }}</td>
            <td class="py-2 pr-4">
              {{ entry.batteryEndCharge.toFixed(1) }}
            </td>
            <td 
              class="py-2 pr-4"
              :class="entry.batteryDelta >= 0 ? 'text-success' : 'text-danger'"
            >
              {{ entry.batteryDelta >= 0 ? '+' : '' }}{{ entry.batteryDelta.toFixed(1) }}
            </td>
            <td class="py-2">
              <span class="status-badge" :class="'status-' + entry.status">
                {{ getStatusText(entry.status) }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    
    <div v-if="entries.length > 0" class="mt-4 p-3 bg-secondary rounded text-xs">
      <div class="flex justify-between text-muted mb-2">
        <span>最近 {{ entries.length }} 回合摘要</span>
      </div>
      <div class="grid grid-4 gap-2">
        <div>
          <div class="text-muted">平均发电</div>
          <div class="font-semibold text-success">{{ avgSolar.toFixed(1) }} kW</div>
        </div>
        <div>
          <div class="text-muted">平均负载</div>
          <div class="font-semibold text-warning">{{ avgLoad.toFixed(1) }} kW</div>
        </div>
        <div>
          <div class="text-muted">断电次数</div>
          <div class="font-semibold text-danger">{{ totalShed }}</div>
        </div>
        <div>
          <div class="text-muted">过放事件</div>
          <div class="font-semibold" :class="totalOverDischarge > 0 ? 'text-danger' : 'text-success'">
            {{ totalOverDischarge }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  ledgerEntries: {
    type: Array,
    default: () => []
  }
})

const entries = computed(() => props.ledgerEntries || [])
const reversedEntries = computed(() => [...entries.value].reverse())

const avgSolar = computed(() => {
  if (entries.value.length === 0) return 0
  return entries.value.reduce((sum, e) => sum + e.solarOutput, 0) / entries.value.length
})

const avgLoad = computed(() => {
  if (entries.value.length === 0) return 0
  return entries.value.reduce((sum, e) => sum + e.totalLoadDemand, 0) / entries.value.length
})

const totalShed = computed(() => {
  return entries.value.reduce((sum, e) => sum + e.loadsShed.length, 0)
})

const totalOverDischarge = computed(() => {
  return entries.value.reduce((sum, e) => sum + e.batteryOverDischargeEvents, 0)
})

function getStatusText(status) {
  const texts = {
    normal: '正常',
    warning: '警告',
    danger: '危险',
    critical: '危急',
    failed: '失败'
  }
  return texts[status] || status
}
</script>
