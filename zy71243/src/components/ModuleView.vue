<template>
  <div>
    <div class="mb-4 p-3 bg-secondary rounded-lg">
      <div class="flex justify-between items-center mb-3">
        <h4 class="font-semibold text-sm">📝 配平归档备注</h4>
        <button 
          class="btn btn-primary text-xs py-1 px-3"
          @click="saveArchiveNote"
        >
          保存归档
        </button>
      </div>
      <textarea
        v-model="archiveNote"
        class="w-full p-2 bg-primary rounded text-sm border border-gray-600 focus:border-blue-500 focus:outline-none"
        rows="3"
        placeholder="记录本轮配平决策：如'因太阳角度偏低，关闭数据分析仪节省电量；预计下回合可恢复...'"
      ></textarea>
      <div v-if="archiveHistory.length > 0" class="mt-3">
        <div class="text-xs text-muted mb-1">历史归档：</div>
        <div 
          v-for="(note, idx) in archiveHistory.slice(-3).reverse()" 
          :key="idx"
          class="text-xs p-2 bg-primary rounded mb-1 border-l-2 border-blue-500"
        >
          <span class="text-muted">[回合 {{ note.turn }}]</span> {{ note.text }}
        </div>
      </div>
    </div>

    <div class="mb-4 p-3 bg-secondary rounded-lg">
      <h4 class="font-semibold text-sm mb-3">🔧 设备分配调整</h4>
      <div class="grid grid-3 gap-2 text-xs">
        <div>
          <label class="text-muted block mb-1">源舱段</label>
          <select 
            v-model="sourceModuleId" 
            class="w-full p-2 bg-primary rounded border border-gray-600"
          >
            <option value="">选择源舱段</option>
            <option v-for="m in modules" :key="m.id" :value="m.id">{{ m.name }}</option>
          </select>
        </div>
        <div>
          <label class="text-muted block mb-1">目标舱段</label>
          <select 
            v-model="targetModuleId" 
            class="w-full p-2 bg-primary rounded border border-gray-600"
          >
            <option value="">选择目标舱段</option>
            <option v-for="m in modules" :key="m.id" :value="m.id">{{ m.name }}</option>
          </select>
        </div>
        <div>
          <label class="text-muted block mb-1">设备类型</label>
          <select 
            v-model="transferType" 
            class="w-full p-2 bg-primary rounded border border-gray-600"
          >
            <option value="solar">太阳能板</option>
            <option value="battery">电池组</option>
            <option value="load">负载设备</option>
          </select>
        </div>
      </div>
      
      <div v-if="sourceModuleId && transferType" class="mt-3">
        <div class="text-xs text-muted mb-2">可分配设备：</div>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="device in availableDevices"
            :key="device.id"
            class="text-xs px-2 py-1 bg-primary rounded border border-gray-600 hover:border-blue-500 transition-colors"
            :class="{ 'opacity-50': !canTransfer(device) }"
            :disabled="!canTransfer(device)"
            @click="transferDevice(device)"
          >
            {{ device.name }} ({{ getDevicePower(device) }})
          </button>
        </div>
      </div>
    </div>

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
        <div class="text-right">
          <span class="text-xs" :class="getIntegrityTextClass(module.integrity)">
            完整度 {{ module.integrity }}%
          </span>
          <div class="text-xs text-muted">ID: {{ module.id }}</div>
        </div>
      </div>
      
      <div class="grid grid-3 gap-2 text-xs mb-3">
        <div class="bg-primary p-2 rounded">
          <div class="text-muted">太阳能</div>
          <div class="font-semibold text-success">{{ module.getTotalSolarOutput().toFixed(1) }} kW</div>
          <div class="text-muted text-xs">{{ module.solarPanels.length }} 块</div>
        </div>
        <div class="bg-primary p-2 rounded">
          <div class="text-muted">电池</div>
          <div class="font-semibold text-primary">
            {{ (module.getTotalBatteryCharge() / (module.getTotalBatteryCapacity() || 1) * 100).toFixed(0) }}%
          </div>
          <div class="text-muted text-xs">{{ module.batteries.length }} 组</div>
        </div>
        <div class="bg-primary p-2 rounded">
          <div class="text-muted">负载</div>
          <div class="font-semibold text-warning">{{ module.getTotalLoadDemand().toFixed(1) }} kW</div>
          <div class="text-muted text-xs">{{ module.loads.length }} 台</div>
        </div>
      </div>
      
      <div v-if="module.solarPanels.length > 0" class="mb-3">
        <div class="flex justify-between items-center mb-2">
          <h4 class="text-sm text-muted">☀️ 太阳能板 ({{ module.solarPanels.length }})</h4>
          <span class="text-xs text-muted">点击分配</span>
        </div>
        <div class="grid grid-1 gap-2">
          <div 
            v-for="panel in module.solarPanels" 
            :key="panel.id"
            class="bg-primary p-2 rounded text-xs cursor-pointer hover:bg-card-hover transition-colors border border-transparent hover:border-blue-500"
            @click="selectDeviceForTransfer(panel, 'solar', module.id)"
          >
            <div class="flex justify-between">
              <span class="font-medium">{{ panel.name }}</span>
              <span :class="getStatusColor(panel.status)">{{ getStatusText(panel.status) }}</span>
            </div>
            <div class="text-muted mt-1 flex justify-between">
              <span>倾角: {{ panel.tiltAngle }}°</span>
              <span>输出: {{ panel.calculateOutput(90).toFixed(1) }} kW</span>
            </div>
            <div v-if="panel.damageLevel > 0" class="text-danger mt-1">
              ⚠️ 损坏 {{ (panel.damageLevel * 100).toFixed(0) }}%
            </div>
          </div>
        </div>
      </div>

      <div v-if="module.batteries.length > 0" class="mb-3">
        <div class="flex justify-between items-center mb-2">
          <h4 class="text-sm text-muted">🔋 电池组 ({{ module.batteries.length }})</h4>
          <span class="text-xs text-muted">点击分配</span>
        </div>
        <div class="grid grid-1 gap-2">
          <div 
            v-for="battery in module.batteries" 
            :key="battery.id"
            class="bg-primary p-2 rounded text-xs cursor-pointer hover:bg-card-hover transition-colors border border-transparent hover:border-blue-500"
            @click="selectDeviceForTransfer(battery, 'battery', module.id)"
          >
            <div class="flex justify-between">
              <span class="font-medium">{{ battery.name }}</span>
              <span class="status-badge text-xs" :class="'status-' + battery.getHealthStatus()">
                {{ getBatteryHealthText(battery.getHealthStatus()) }}
              </span>
            </div>
            <div class="mt-1">
              <div class="progress-bar mb-1">
                <div 
                  class="progress-fill"
                  :class="getBatterySOCClass(battery.stateOfCharge)"
                  :style="{ width: (battery.stateOfCharge * 100) + '%' }"
                ></div>
              </div>
              <div class="flex justify-between text-muted">
                <span>{{ battery.currentCharge.toFixed(1) }} / {{ battery.effectiveCapacity.toFixed(1) }} kWh</span>
                <span>{{ (battery.stateOfCharge * 100).toFixed(0) }}%</span>
              </div>
            </div>
            <div v-if="battery.overDischargeCount > 0" class="text-danger mt-1">
              ⚠️ 过放 {{ battery.overDischargeCount }} 次 · 温度 {{ battery.temperature }}°C
            </div>
          </div>
        </div>
      </div>
      
      <div v-if="module.loads.length > 0">
        <div class="flex justify-between items-center mb-2">
          <h4 class="text-sm text-muted">⚡ 负载设备 ({{ module.loads.length }})</h4>
          <span class="text-xs text-muted">点击开关/分配</span>
        </div>
        <div 
          v-for="load in module.loads" 
          :key="load.id"
          class="load-item"
          :class="['priority-' + load.priority, load.isPowered ? 'powered' : 'unpowered']"
        >
          <div class="flex-1" @click="selectDeviceForTransfer(load, 'load', module.id)">
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
              <span class="text-primary ml-2 cursor-pointer hover:underline">
                [点击分配到其他舱段]
              </span>
            </div>
          </div>
          <div 
            class="toggle-switch"
            :class="{ active: load.isPowered }"
            @click.stop="$emit('toggle-load', load.id)"
          ></div>
        </div>
      </div>
    </div>

    <div v-if="selectedDevice" class="fixed bottom-4 left-4 right-4 bg-card border border-blue-500 rounded-lg p-4 shadow-xl z-50">
      <div class="flex justify-between items-center mb-3">
        <h4 class="font-semibold">设备分配 - {{ selectedDevice.name }}</h4>
        <button class="text-muted hover:text-white" @click="selectedDevice = null">✕</button>
      </div>
      <p class="text-sm text-muted mb-3">选择目标舱段进行设备转移：</p>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="m in modules"
          :key="m.id"
          class="btn text-sm"
          :class="m.id === selectedDevice.sourceModuleId ? 'bg-secondary' : 'btn-primary'"
          :disabled="m.id === selectedDevice.sourceModuleId"
          @click="confirmTransfer(m.id)"
        >
          {{ m.name }}
          <span v-if="m.id === selectedDevice.sourceModuleId" class="text-xs ml-1">(当前)</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  modules: {
    type: Array,
    required: true
  },
  currentTurn: {
    type: Number,
    default: 0
  }
})

const emit = defineEmits(['toggle-load', 'transfer-device', 'archive-note'])

const archiveNote = ref('')
const archiveHistory = ref([])
const sourceModuleId = ref('')
const targetModuleId = ref('')
const transferType = ref('solar')
const selectedDevice = ref(null)

const availableDevices = computed(() => {
  if (!sourceModuleId.value) return []
  const sourceModule = props.modules.find(m => m.id === sourceModuleId.value)
  if (!sourceModule) return []
  
  switch (transferType.value) {
    case 'solar': return sourceModule.solarPanels
    case 'battery': return sourceModule.batteries
    case 'load': return sourceModule.loads
    default: return []
  }
})

function canTransfer(device) {
  return sourceModuleId.value && targetModuleId.value && sourceModuleId.value !== targetModuleId.value
}

function getDevicePower(device) {
  if ('maxOutput' in device) return device.maxOutput + ' kW'
  if ('capacity' in device) return device.capacity + ' kWh'
  if ('powerDemand' in device) return device.powerDemand + ' kW'
  return ''
}

function selectDeviceForTransfer(device, type, moduleId) {
  selectedDevice.value = {
    ...device,
    deviceType: type,
    sourceModuleId: moduleId
  }
}

function transferDevice(device) {
  if (!canTransfer(device)) return
  
  const sourceModule = props.modules.find(m => m.id === sourceModuleId.value)
  const targetModule = props.modules.find(m => m.id === targetModuleId.value)
  
  if (!sourceModule || !targetModule) return
  
  emit('transfer-device', {
    device,
    type: transferType.value,
    from: sourceModuleId.value,
    to: targetModuleId.value
  })
}

function confirmTransfer(targetModuleId) {
  if (!selectedDevice.value) return
  
  emit('transfer-device', {
    device: selectedDevice.value,
    type: selectedDevice.value.deviceType,
    from: selectedDevice.value.sourceModuleId,
    to: targetModuleId
  })
  
  selectedDevice.value = null
}

function saveArchiveNote() {
  if (!archiveNote.value.trim()) return
  
  archiveHistory.value.push({
    turn: props.currentTurn,
    text: archiveNote.value.trim(),
    timestamp: new Date()
  })
  
  emit('archive-note', {
    turn: props.currentTurn,
    text: archiveNote.value.trim()
  })
  
  archiveNote.value = ''
}

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

function getBatteryHealthText(status) {
  const texts = {
    normal: '健康',
    warning: '警告',
    critical: '危急'
  }
  return texts[status] || status
}

function getBatterySOCClass(soc) {
  if (soc < 0.2) return 'progress-fill-danger'
  if (soc < 0.5) return 'progress-fill-warning'
  return 'progress-fill-success'
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
