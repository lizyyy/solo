<template>
  <div class="card">
    <h2 class="card-title">🔋 电池组状态</h2>
    
    <div v-if="batteries.length === 0" class="text-center text-muted py-4">
      无电池组
    </div>
    
    <div v-else class="space-y-3">
      <div 
        v-for="battery in batteries" 
        :key="battery.id"
        class="p-3 bg-secondary rounded-lg"
      >
        <div class="flex justify-between items-center mb-2">
          <span class="font-medium text-sm">{{ battery.name }}</span>
          <span 
            class="status-badge text-xs"
            :class="'status-' + battery.getHealthStatus()"
          >
            {{ getHealthStatusText(battery.getHealthStatus()) }}
          </span>
        </div>
        
        <div class="mb-2">
          <div class="flex justify-between text-xs mb-1">
            <span class="text-muted">电量</span>
            <span>{{ (battery.stateOfCharge * 100).toFixed(1) }}%</span>
          </div>
          <div class="progress-bar">
            <div 
              class="progress-fill"
              :class="getBatteryClass(battery.stateOfCharge)"
              :style="{ width: (battery.stateOfCharge * 100) + '%' }"
            ></div>
          </div>
        </div>
        
        <div class="grid grid-2 gap-2 text-xs">
          <div>
            <div class="text-muted">容量</div>
            <div>{{ battery.currentCharge.toFixed(1) }} / {{ battery.effectiveCapacity.toFixed(1) }} kWh</div>
          </div>
          <div>
            <div class="text-muted">温度</div>
            <div :class="battery.temperature > 40 ? 'text-warning' : ''">
              {{ battery.temperature }}°C
            </div>
          </div>
          <div>
            <div class="text-muted">循环次数</div>
            <div>{{ battery.cycleCount }}</div>
          </div>
          <div>
            <div class="text-muted">损坏度</div>
            <div :class="battery.damageLevel > 0 ? 'text-warning' : ''">
              {{ (battery.damageLevel * 100).toFixed(0) }}%
            </div>
          </div>
        </div>
        
        <div v-if="battery.overDischargeCount > 0 || battery.overChargeCount > 0" class="mt-2 pt-2 border-t border-gray-700 text-xs">
          <span v-if="battery.overDischargeCount > 0" class="text-danger mr-3">
            ⚠️ 过放 {{ battery.overDischargeCount }}次
          </span>
          <span v-if="battery.overChargeCount > 0" class="text-warning">
            ⚠️ 过充 {{ battery.overChargeCount }}次
          </span>
        </div>
      </div>
    </div>
    
    <div class="mt-4 p-3 bg-secondary rounded text-xs">
      <div class="flex justify-between text-muted mb-2">
        <span>电池组汇总</span>
      </div>
      <div class="grid grid-2 gap-2">
        <div>
          <div class="text-muted">总容量</div>
          <div class="font-semibold text-primary">{{ totalCapacity.toFixed(1) }} kWh</div>
        </div>
        <div>
          <div class="text-muted">总电量</div>
          <div class="font-semibold">{{ totalCharge.toFixed(1) }} kWh</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  batteries: {
    type: Array,
    required: true
  }
})

const totalCapacity = computed(() => 
  props.batteries.reduce((sum, b) => sum + b.effectiveCapacity, 0)
)

const totalCharge = computed(() => 
  props.batteries.reduce((sum, b) => sum + b.currentCharge, 0)
)

function getBatteryClass(stateOfCharge) {
  if (stateOfCharge < 0.2) return 'progress-fill-danger'
  if (stateOfCharge < 0.5) return 'progress-fill-warning'
  return 'progress-fill-success'
}

function getHealthStatusText(status) {
  const texts = {
    normal: '正常',
    warning: '警告',
    critical: '危急'
  }
  return texts[status] || status
}
</script>
