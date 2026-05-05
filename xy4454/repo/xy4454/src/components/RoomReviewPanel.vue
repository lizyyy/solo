<template>
  <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
    <div class="flex justify-between items-center mb-6">
      <h2 class="text-lg font-semibold text-gray-900">房间复核 - {{ room.name }}</h2>
      <button 
        @click="closePanel"
        class="text-gray-400 hover:text-gray-600"
      >
        ✕
      </button>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <div class="p-4 bg-gray-50 rounded-lg">
        <div class="text-sm text-gray-500 mb-1">房间状态</div>
        <div class="flex items-center space-x-2">
          <span class="px-2 py-1 rounded text-sm font-medium"
                :class="getRoomStatusBadgeClass(room.status)">
            {{ getRoomStatusLabel(room.status) }}
          </span>
          <select 
            v-model="roomStatus"
            @change="updateRoomStatus"
            class="text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="normal">正常</option>
            <option value="warning">注意</option>
            <option value="error">异常</option>
          </select>
        </div>
      </div>
      <div class="p-4 bg-gray-50 rounded-lg">
        <div class="text-sm text-gray-500 mb-1">设备数量</div>
        <div class="text-xl font-bold text-gray-900">{{ room.devices?.length || 0 }}</div>
      </div>
      <div class="p-4 bg-gray-50 rounded-lg">
        <div class="text-sm text-gray-500 mb-1">待处理风险</div>
        <div class="text-xl font-bold"
             :class="pendingRisks.length > 0 ? 'text-red-600' : 'text-green-600'">
          {{ pendingRisks.length }}
        </div>
      </div>
    </div>

    <div class="mb-6">
      <h3 class="text-sm font-medium text-gray-700 mb-3">房间平面图</h3>
      <div class="bg-gray-50 rounded-lg p-4">
        <svg 
          :width="room.layout?.width || 300" 
          :height="room.layout?.height || 200"
          class="w-full h-auto max-w-2xl mx-auto"
          viewBox="0 0 300 200"
        >
          <rect 
            x="5" y="5" 
            :width="(room.layout?.width || 300) - 10" 
            :height="(room.layout?.height || 200) - 10"
            fill="none" 
            stroke="#94a3b8" 
            stroke-width="3"
            rx="4"
          />
          
          <line 
            v-for="(wall, index) in room.layout?.walls || []" 
            :key="index"
            :x1="wall.x1" :y1="wall.y1"
            :x2="wall.x2" :y2="wall.y2"
            stroke="#64748b" 
            stroke-width="3"
          />
          
          <g v-for="device in room.devices" :key="device.id">
            <circle 
              :cx="device.x" 
              :cy="device.y" 
              r="15"
              :fill="getDeviceColor(device.id)"
              stroke="white"
              stroke-width="2"
              class="cursor-pointer hover:opacity-80 transition-opacity"
              @click="selectDevice(device)"
            />
            <text 
              :x="device.x" 
              :y="device.y + 5" 
              text-anchor="middle" 
              fill="white" 
              font-size="12"
              font-weight="bold"
            >
              {{ getDeviceIcon(device.type) }}
            </text>
            <text 
              :x="device.x" 
              :y="device.y + 30" 
              text-anchor="middle" 
              fill="#475569" 
              font-size="10"
            >
              {{ device.name }}
            </text>
          </g>
        </svg>
      </div>
    </div>

    <div>
      <h3 class="text-sm font-medium text-gray-700 mb-3">风险复核</h3>
      
      <div v-if="risks.length === 0" class="text-center py-8 text-gray-500">
        该房间暂无风险
      </div>

      <div v-else class="space-y-4">
        <div 
          v-for="risk in risks" 
          :key="risk.id"
          class="border rounded-lg overflow-hidden"
          :class="getRiskBorderClass(risk.level)"
        >
          <div class="p-4" :class="getRiskHeaderClass(risk.level)">
            <div class="flex justify-between items-start">
              <div class="flex-1">
                <div class="flex items-center space-x-2 mb-1">
                  <span class="px-2 py-0.5 rounded text-xs font-medium"
                        :class="getRiskBadgeClass(risk.level)">
                    {{ getRiskLevelLabel(risk.level) }}
                  </span>
                  <span class="text-xs text-gray-600">
                    {{ getRiskTypeLabel(risk.type) }}
                  </span>
                  <span class="px-2 py-0.5 rounded text-xs font-medium"
                        :class="getStatusBadgeClass(risk.status)">
                    {{ getStatusLabel(risk.status) }}
                  </span>
                </div>
                <p class="text-sm">{{ risk.description }}</p>
              </div>
              <select 
                v-model="riskStatusMap[risk.id] || risk.status"
                @change="handleStatusChange(risk.id, $event)"
                class="ml-4 text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="pending">待处理</option>
                <option value="reviewed">已复核</option>
                <option value="resolved">已解决</option>
              </select>
            </div>
          </div>
          
          <div class="p-4 bg-white border-t" :class="getRiskBorderClass(risk.level)">
            <label class="block text-sm font-medium text-gray-700 mb-2">处理备注</label>
            <textarea 
              v-model="riskRemarkMap[risk.id] || risk.remark || ''"
              @input="handleRemarkChange(risk.id, $event)"
              placeholder="输入处理备注..."
              rows="2"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            ></textarea>
            
            <div class="flex justify-end space-x-2 mt-3">
              <button 
                @click="markAsFalseAlarm(risk)"
                class="px-3 py-1.5 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200 transition-colors"
              >
                判为误报
              </button>
              <button 
                @click="markAsResolved(risk)"
                class="px-3 py-1.5 bg-green-600 text-white rounded text-sm hover:bg-green-700 transition-colors"
              >
                标记已解决
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { riskTypeLabels, riskLevelColors, riskStatusLabels } from '../utils/riskCalculator';

const props = defineProps({
  room: {
    type: Object,
    required: true
  },
  risks: {
    type: Array,
    default: () => []
  }
});

const emit = defineEmits(['close', 'update-risk-status', 'update-risk-remark', 'update-room-status']);

const roomStatus = ref(props.room.status);
const riskStatusMap = ref({});
const riskRemarkMap = ref({});

const pendingRisks = computed(() => 
  props.risks.filter(r => r.status !== 'resolved')
);

watch(() => props.room, (newRoom) => {
  roomStatus.value = newRoom.status;
}, { immediate: true });

function closePanel() {
  emit('close');
}

function updateRoomStatus() {
  emit('update-room-status', props.room.id, roomStatus.value);
}

function handleStatusChange(riskId, event) {
  const status = event.target.value;
  riskStatusMap.value[riskId] = status;
  emit('update-risk-status', riskId, status);
}

function handleRemarkChange(riskId, event) {
  const remark = event.target.value;
  riskRemarkMap.value[riskId] = remark;
  emit('update-risk-remark', riskId, remark);
}

function markAsFalseAlarm(risk) {
  riskStatusMap.value[risk.id] = 'resolved';
  riskRemarkMap.value[risk.id] = (riskRemarkMap.value[risk.id] || '') + ' [判为误报]';
  emit('update-risk-status', risk.id, 'resolved');
  emit('update-risk-remark', risk.id, riskRemarkMap.value[risk.id]);
}

function markAsResolved(risk) {
  riskStatusMap.value[risk.id] = 'resolved';
  emit('update-risk-status', risk.id, 'resolved');
}

function selectDevice(device) {
  console.log('Selected device:', device);
}

function getRoomStatusBadgeClass(status) {
  const classes = {
    normal: 'bg-green-100 text-green-800',
    warning: 'bg-yellow-100 text-yellow-800',
    error: 'bg-red-100 text-red-800'
  };
  return classes[status] || 'bg-gray-100 text-gray-800';
}

function getRoomStatusLabel(status) {
  const labels = {
    normal: '正常',
    warning: '注意',
    error: '异常'
  };
  return labels[status] || '未知';
}

function getDeviceColor(deviceId) {
  const hasRisk = props.risks.some(r => 
    r.deviceId === deviceId && r.status !== 'resolved'
  );
  return hasRisk ? '#ef4444' : '#3b82f6';
}

function getDeviceIcon(type) {
  const icons = {
    door_sensor: '🚪',
    touch_sensor: '👆',
    pressure_sensor: '⬇️',
    light_sensor: '💡',
    keypad: '🔢',
    beam_sensor: '⚡',
    fingerprint_sensor: '👆',
    dial_sensor: '🔘',
    valve_sensor: '🚰',
    button_sensor: '🔘',
    window_sensor: '🪟'
  };
  return icons[type] || '📱';
}

function getRiskBorderClass(level) {
  return riskLevelColors[level]?.border || 'border-gray-300';
}

function getRiskHeaderClass(level) {
  return riskLevelColors[level]?.bg || 'bg-gray-50';
}

function getRiskBadgeClass(level) {
  const classes = {
    high: 'bg-red-100 text-red-800',
    medium: 'bg-yellow-100 text-yellow-800',
    low: 'bg-blue-100 text-blue-800'
  };
  return classes[level] || 'bg-gray-100 text-gray-800';
}

function getRiskLevelLabel(level) {
  const labels = {
    high: '高风险',
    medium: '中风险',
    low: '低风险'
  };
  return labels[level] || '未知';
}

function getRiskTypeLabel(type) {
  return riskTypeLabels[type] || type;
}

function getStatusBadgeClass(status) {
  const classes = {
    pending: 'bg-gray-100 text-gray-800',
    reviewed: 'bg-blue-100 text-blue-800',
    resolved: 'bg-green-100 text-green-800'
  };
  return classes[status] || 'bg-gray-100 text-gray-800';
}

function getStatusLabel(status) {
  return riskStatusLabels[status] || status;
}
</script>
