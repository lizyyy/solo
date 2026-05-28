<template>
  <div class="card">
    <h2 class="card-title">⚡ 能源总览</h2>
    
    <div class="stat-grid mb-4">
      <div class="stat-box">
        <div class="stat-value text-success">{{ solarOutput.toFixed(1) }}</div>
        <div class="stat-label">太阳能输出 (kW)</div>
      </div>
      <div class="stat-box">
        <div class="stat-value" :class="getConsumptionColor()">{{ loadDemand.toFixed(1) }}</div>
        <div class="stat-label">负载需求 (kW)</div>
      </div>
      <div class="stat-box">
        <div class="stat-value" :class="getBalanceColor()">{{ balance.toFixed(1) }}</div>
        <div class="stat-label">功率平衡 (kW)</div>
      </div>
      <div class="stat-box">
        <div class="stat-value">{{ batteryPercent.toFixed(0) }}%</div>
        <div class="stat-label">电池电量</div>
      </div>
    </div>
    
    <div class="grid grid-2 gap-4">
      <div>
        <div class="flex justify-between items-center mb-2">
          <span class="text-sm text-muted">太阳角度</span>
          <span class="font-semibold">{{ sunAngle.toFixed(0) }}°</span>
        </div>
        <div class="angle-display">
          <div class="sun-indicator"></div>
          <div class="angle-slider">
            <div 
              class="angle-marker" 
              :style="{ left: getAnglePosition() + '%' }"
            ></div>
          </div>
        </div>
        <p class="text-xs text-muted mt-2">
          {{ getSunDescription() }}
        </p>
      </div>
      
      <div>
        <div class="flex justify-between items-center mb-2">
          <span class="text-sm text-muted">电池状态</span>
          <span 
            class="text-sm"
            :class="batteryPercent < 20 ? 'text-danger' : batteryPercent < 50 ? 'text-warning' : 'text-success'"
          >
            {{ batteryCharge.toFixed(1) }} / {{ batteryCapacity.toFixed(1) }} kWh
          </span>
        </div>
        <div class="battery-visual">
          <div 
            class="battery-fill"
            :class="getBatteryClass()"
            :style="{ width: batteryPercent + '%' }"
          ></div>
        </div>
        <p class="text-xs text-muted mt-2">
          {{ getBatteryDescription() }}
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  station: {
    type: Object,
    required: true
  },
  sunAngle: {
    type: Number,
    required: true
  },
  powerBalance: {
    type: Object,
    default: () => ({})
  }
})

const solarOutput = computed(() => props.station.getTotalSolarOutput())
const loadDemand = computed(() => props.station.getTotalLoadDemand())
const balance = computed(() => solarOutput.value - loadDemand.value)
const batteryCharge = computed(() => props.powerBalance.batteryCharge || 0)
const batteryCapacity = computed(() => props.powerBalance.batteryCapacity || 1)
const batteryPercent = computed(() => {
  if (batteryCapacity.value === 0) return 0
  return (batteryCharge.value / batteryCapacity.value) * 100
})

function getBalanceColor() {
  if (balance.value >= 0) return 'text-success'
  return 'text-danger'
}

function getConsumptionColor() {
  if (solarOutput.value >= loadDemand.value) return 'text-success'
  return 'text-warning'
}

function getBatteryClass() {
  if (batteryPercent.value < 20) return 'low'
  if (batteryPercent.value < 50) return 'medium'
  return 'high'
}

function getAnglePosition() {
  return ((props.sunAngle + 45) / 165) * 100
}

function getSunDescription() {
  if (props.sunAngle < 0) return '🌙 阴影区 - 太阳能产出极低'
  if (props.sunAngle < 30) return '🌅 日出/日落 - 太阳能产出较低'
  if (props.sunAngle < 70) return '☀️ 白昼 - 太阳能正常产出'
  return '🌟 日照峰值 - 太阳能最大产出'
}

function getBatteryDescription() {
  if (batteryPercent.value < 10) return '⚠️ 电量危急，立即削减非必要负载'
  if (batteryPercent.value < 20) return '⚡ 电量偏低，注意控制能耗'
  if (batteryPercent.value < 50) return '🔋 电量中等，可适当使用'
  if (batteryPercent.value > 90) return '💚 电池充足，考虑增加实验负载'
  return '✓ 电量正常'
}
</script>
