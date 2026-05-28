<template>
  <div>
    <div 
      v-for="module in modules" 
      :key="module.id"
      class="module-card"
      :class="{ damaged: module.status === 'damaged', destroyed: module.status === 'destroyed' }"
    >
      <div class="integrity-bar">
        <div 
          class="integrity-fill"
          :class="getIntegrityClass(module.integrity)"
          :style="{ width: module.integrity + '%' }"
        ></div>
      </div>
      
      <div class="flex justify-between items-start mb-3">
        <div>
          <h3 class="font-semibold">{{ module.name }}</h3>
          <span class="text-xs text-muted">{{ getModuleTypeName(module.type) }}</span>
        </div>
        <span class="text-xs" :class="getIntegrityTextClass(module.integrity)">
          完整度 {{ module.integrity }}%
        </span>
      </div>
      
      <div class="grid grid-3 gap-2 text-xs mb-3">
        <div class="bg-secondary p-2 rounded">
          <div class="text-muted">太阳能</div>
          <div class="font-semibold text-success">{{ module.getTotalSolarOutput().toFixed(1) }} kW</div>
        </div>
        <div class="bg-secondary p-2 rounded">
          <div class="text-muted">电池</div>
          <div class="font-semibold text-primary">
            {{ (module.getTotalBatteryCharge() / module.getTotalBatteryCapacity() * 100).toFixed(0) }}%
          </div>
        </div>
        <div class="bg-secondary p-2 rounded">
          <div class="text-muted">负载</div>
          <div class="font-semibold text-warning">{{ module.getTotalLoadDemand().toFixed(1) }} kW</div>
        </div>
      </div>
      
      <div v-if="module.solarPanels.length > 0" class="mb-3">
        <h4 class="text-sm text-muted mb-2">太阳能板 ({{ module.solarPanels.length }})</h4>
        <div class="grid grid-2 gap-2">
          <div 
            v-for="panel in module.solarPanels" 
            :key="panel.id"
            class="bg-secondary p-2 rounded text-xs"
          >
            <div class="flex justify-between">
              <span>{{ panel.name }}</span>
              <span :class="getStatusColor(panel.status)">{{ getStatusText(panel.status) }}</span>
            </div>
            <div class="text-muted mt-1">
              输出: {{ panel.calculateOutput(90).toFixed(1) }} kW
              <span v-if="panel.damageLevel > 0" class="text-danger ml-2">
                损坏 {{ (panel.damageLevel * 100).toFixed(0) }}%
              </span>
            </div>
          </div>
        </div>
      </div>
      
      <div v-if="module.loads.length > 0">
        <h4 class="text-sm text-muted mb-2">负载设备 ({{ module.loads.length }})</h4>
        <div 
          v-for="load in module.loads" 
          :key="load.id"
          class="load-item"
          :class="['priority-' + load.priority, load.isPowered ? 'powered' : 'unpowered']"
        >
          <div class="flex-1">
            <div class="flex items-center gap-2">
              <span class="font-medium">{{ load.name }}</span>
              <span class="text-xs px-2 py-0.5 rounded bg-secondary">
                {{ getPriorityText(load.priority) }}
              </span>
            </div>
            <div class="text-xs text-muted mt-1">
              {{ load.powerDemand.toFixed(1) }} kW · 
              可靠性: {{ load.getReliabilityScore().toFixed(0) }}%
              <span v-if="load.trips > 0" class="text-danger ml-2">
                跳闸 {{ load.trips }} 次
              </span>
            </div>
          </div>
          <div 
            class="toggle-switch"
            :class="{ active: load.isPowered }"
            @click="$emit('toggle-load', load.id)"
          ></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  modules: {
    type: Array,
    required: true
  }
})

defineEmits(['toggle-load'])

function getModuleTypeName(type) {
  const types = {
    core: '核心舱',
    laboratory: '实验舱',
    habitat: '居住舱',
    propulsion: '推进舱'
  }
  return types[type] || type
}

function getIntegrityClass(integrity) {
  if (integrity < 30) return 'progress-fill-danger'
  if (integrity < 60) return 'progress-fill-warning'
  return 'progress-fill-success'
}

function getIntegrityTextClass(integrity) {
  if (integrity < 30) return 'text-danger'
  if (integrity < 60) return 'text-warning'
  return 'text-success'
}

function getStatusColor(status) {
  const colors = {
    operational: 'text-success',
    degraded: 'text-warning',
    destroyed: 'text-danger'
  }
  return colors[status] || 'text-muted'
}

function getStatusText(status) {
  const texts = {
    operational: '正常',
    degraded: '降级',
    destroyed: '损毁'
  }
  return texts[status] || status
}

function getPriorityText(priority) {
  const texts = {
    1: '关键',
    2: '高',
    3: '中',
    4: '低'
  }
  return texts[priority] || priority
}
</script>
