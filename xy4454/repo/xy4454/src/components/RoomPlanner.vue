<template>
  <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
    <h2 class="text-lg font-semibold text-gray-900 mb-4">房间平面图</h2>
    
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div 
        v-for="room in rooms" 
        :key="room.id"
        class="cursor-pointer transition-all duration-200"
        :class="isSelected(room.id) ? 'ring-2 ring-blue-500 rounded-lg' : ''"
        @click="selectRoom(room)"
      >
        <div class="border border-gray-200 rounded-lg overflow-hidden hover:shadow-md">
          <div class="p-3 flex justify-between items-center" :class="getRoomHeaderClass(room.status)">
            <span class="font-medium text-sm">{{ room.name }}</span>
            <div class="flex items-center space-x-2">
              <span class="text-xs px-2 py-0.5 rounded" :class="getRoomStatusBadgeClass(room.status)">
                {{ getRoomStatusLabel(room.status) }}
              </span>
              <span v-if="getRoomRiskCount(room.id) > 0" class="text-xs px-2 py-0.5 bg-red-100 text-red-800 rounded">
                {{ getRoomRiskCount(room.id) }} 风险
              </span>
            </div>
          </div>
          
          <div class="p-4 bg-gray-50">
            <svg 
              :width="room.layout?.width || 300" 
              :height="room.layout?.height || 200"
              class="w-full h-auto"
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
                  r="12"
                  :fill="getDeviceColor(device.id, room.id)"
                  stroke="white"
                  stroke-width="2"
                />
                <text 
                  :x="device.x" 
                  :y="device.y + 4" 
                  text-anchor="middle" 
                  fill="white" 
                  font-size="10"
                  font-weight="bold"
                >
                  {{ getDeviceIcon(device.type) }}
                </text>
              </g>
            </svg>
          </div>
          
          <div class="p-3 border-t border-gray-200">
            <div class="flex flex-wrap gap-2">
              <div 
                v-for="device in room.devices" 
                :key="device.id"
                class="flex items-center space-x-1 text-xs px-2 py-1 rounded"
                :class="getDeviceBadgeClass(device.id, room.id)"
              >
                <span>{{ getDeviceIcon(device.type) }}</span>
                <span>{{ device.name }}</span>
                <span v-if="hasDeviceRisk(device.id, room.id)" class="text-red-500">⚠</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <div class="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
      <p class="text-sm text-blue-800">
        <span class="font-medium">操作提示：</span>点击房间卡片可查看详细信息，红色标记表示存在风险的设备。
      </p>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  rooms: {
    type: Array,
    default: () => []
  },
  risks: {
    type: Array,
    default: () => []
  }
});

const emit = defineEmits(['select-room', 'update-room-status']);

function isSelected(roomId) {
  return false;
}

function selectRoom(room) {
  emit('select-room', room);
}

function getRoomHeaderClass(status) {
  const classes = {
    normal: 'bg-green-50',
    warning: 'bg-yellow-50',
    error: 'bg-red-50'
  };
  return classes[status] || 'bg-gray-50';
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

function getRoomRiskCount(roomId) {
  return props.risks.filter(r => r.roomId === roomId && r.status !== 'resolved').length;
}

function getDeviceColor(deviceId, roomId) {
  const hasRisk = props.risks.some(r => 
    r.deviceId === deviceId && 
    r.roomId === roomId && 
    r.status !== 'resolved'
  );
  
  if (hasRisk) {
    return '#ef4444';
  }
  return '#3b82f6';
}

function getDeviceBadgeClass(deviceId, roomId) {
  const hasRisk = props.risks.some(r => 
    r.deviceId === deviceId && 
    r.roomId === roomId && 
    r.status !== 'resolved'
  );
  
  if (hasRisk) {
    return 'bg-red-100 text-red-800';
  }
  return 'bg-gray-100 text-gray-700';
}

function hasDeviceRisk(deviceId, roomId) {
  return props.risks.some(r => 
    r.deviceId === deviceId && 
    r.roomId === roomId && 
    r.status !== 'resolved'
  );
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
</script>
