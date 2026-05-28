<template>
  <div class="card">
    <h2 class="card-title">📋 事件日志</h2>
    
    <div v-if="events.length === 0" class="text-center text-muted py-8">
      暂无事件记录
    </div>
    
    <div v-else class="event-log">
      <div 
        v-for="(event, index) in events" 
        :key="index"
        class="event-item"
        :class="event.severity"
      >
        <div class="flex justify-between items-start">
          <div>
            <div class="font-medium text-sm">{{ event.message }}</div>
            <div class="text-xs text-muted mt-1">
              类型: {{ getEventTypeText(event.type) }}
            </div>
          </div>
          <span class="text-xs text-muted">回合 {{ event.turn }}</span>
        </div>
        
        <div v-if="event.details && Object.keys(event.details).length > 0" class="mt-2 text-xs text-muted">
          <div v-for="(value, key) in event.details" :key="key">
            {{ getDetailLabel(key) }}: {{ formatDetailValue(key, value) }}
          </div>
        </div>
      </div>
    </div>
    
    <div class="mt-4 p-3 bg-secondary rounded text-xs">
      <div class="flex justify-between items-center mb-2">
        <span class="text-muted">事件统计</span>
      </div>
      <div class="grid grid-3 gap-2">
        <div>
          <div class="text-muted">总计</div>
          <div class="font-semibold">{{ events.length }}</div>
        </div>
        <div>
          <div class="text-muted">严重</div>
          <div class="font-semibold text-danger">{{ highSeverityCount }}</div>
        </div>
        <div>
          <div class="text-muted">中等</div>
          <div class="font-semibold text-warning">{{ mediumSeverityCount }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  events: {
    type: Array,
    default: () => []
  }
})

const highSeverityCount = computed(() => 
  props.events.filter(e => e.severity === 'high').length
)

const mediumSeverityCount = computed(() => 
  props.events.filter(e => e.severity === 'medium').length
)

function getEventTypeText(type) {
  const types = {
    meteor_strike: '陨石撞击',
    solar_flare: '太阳耀斑',
    equipment_failure: '设备故障',
    thermal_cycling: '热循环',
    crew_error: '操作失误'
  }
  return types[type] || type
}

function getDetailLabel(key) {
  const labels = {
    moduleId: '舱段',
    damage: '伤害值',
    targetType: '目标类型',
    targetId: '目标ID',
    outputBoost: '输出增益',
    duration: '持续回合',
    equipmentId: '设备ID',
    equipmentType: '设备类型',
    degradation: '性能下降'
  }
  return labels[key] || key
}

function formatDetailValue(key, value) {
  if (key === 'damage' || key === 'degradation' || key === 'outputBoost') {
    return (value * 100).toFixed(0) + '%'
  }
  if (key === 'duration') {
    return value + ' 回合'
  }
  if (typeof value === 'number') {
    return value.toFixed(2)
  }
  return String(value)
}
</script>
