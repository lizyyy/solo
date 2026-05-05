<template>
  <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
    <h2 class="text-lg font-semibold text-gray-900 mb-4">传感器触发时间轴</h2>
    
    <div class="mb-4">
      <label class="text-sm font-medium text-gray-700 mb-2 block">选择房间</label>
      <select 
        v-model="selectedRoomId"
        class="w-full md:w-64 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">全部房间</option>
        <option v-for="room in rooms" :key="room.id" :value="room.id">
          {{ room.name }}
        </option>
      </select>
    </div>

    <div v-if="filteredSensors.length === 0" class="text-center py-8 text-gray-500">
      暂无传感器数据
    </div>

    <div v-else class="relative">
      <div class="flex items-center justify-between mb-4 px-4">
        <span class="text-xs text-gray-500">{{ startTimeLabel }}</span>
        <span class="text-xs text-gray-500">{{ endTimeLabel }}</span>
      </div>
      
      <div class="relative bg-gray-50 rounded-lg p-4">
        <div class="absolute left-1/2 top-0 bottom-0 w-0.5 bg-gray-300 transform -translate-x-1/2"></div>
        
        <div class="space-y-6">
          <div 
            v-for="(sensor, index) in sortedSensors" 
            :key="sensor.id"
            class="relative flex items-center"
          >
            <div class="absolute left-1/2 transform -translate-x-1/2 w-4 h-4 rounded-full border-2 border-white z-10"
                 :class="getSensorDotClass(sensor.type)">
            </div>
            
            <div 
              class="w-5/12"
              :class="index % 2 === 0 ? 'pr-8 text-right' : 'pl-8 text-left order-3'"
            >
              <div class="p-3 rounded-lg shadow-sm"
                   :class="getSensorCardClass(sensor.type)">
                <div class="flex items-center justify-between mb-1"
                     :class="index % 2 === 0 ? '' : 'flex-row-reverse'">
                  <span class="text-xs font-medium"
                        :class="getSensorTextClass(sensor.type)">
                    {{ getSensorTypeLabel(sensor.type) }}
                  </span>
                  <span class="text-xs text-gray-500">
                    {{ formatTime(sensor.timestamp) }}
                  </span>
                </div>
                <p class="text-sm text-gray-700">
                  {{ getDeviceName(sensor) }}
                </p>
                <p v-if="sensor.notes" class="text-xs text-gray-500 mt-1">
                  {{ sensor.notes }}
                </p>
              </div>
            </div>
            
            <div class="w-2/12"></div>
          </div>
        </div>
      </div>
    </div>
    
    <div class="mt-4 flex items-center space-x-4 text-sm">
      <div class="flex items-center space-x-2">
        <span class="w-3 h-3 rounded-full bg-green-500"></span>
        <span class="text-gray-600">正常触发</span>
      </div>
      <div class="flex items-center space-x-2">
        <span class="w-3 h-3 rounded-full bg-blue-500"></span>
        <span class="text-gray-600">复位</span>
      </div>
      <div class="flex items-center space-x-2">
        <span class="w-3 h-3 rounded-full bg-yellow-500"></span>
        <span class="text-gray-600">警告</span>
      </div>
      <div class="flex items-center space-x-2">
        <span class="w-3 h-3 rounded-full bg-red-500"></span>
        <span class="text-gray-600">异常</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import dayjs from 'dayjs';

const props = defineProps({
  sensors: {
    type: Array,
    default: () => []
  },
  rooms: {
    type: Array,
    default: () => []
  },
  selectedRoom: {
    type: Object,
    default: null
  }
});

const selectedRoomId = ref('');

const filteredSensors = computed(() => {
  if (!selectedRoomId.value) {
    return props.sensors;
  }
  return props.sensors.filter(s => s.roomId === selectedRoomId.value);
});

const sortedSensors = computed(() => {
  return [...filteredSensors.value].sort((a, b) => 
    dayjs(a.timestamp).valueOf() - dayjs(b.timestamp).valueOf()
  );
});

const startTimeLabel = computed(() => {
  if (sortedSensors.value.length === 0) return '';
  return dayjs(sortedSensors.value[0].timestamp).format('HH:mm');
});

const endTimeLabel = computed(() => {
  if (sortedSensors.value.length === 0) return '';
  return dayjs(sortedSensors.value[sortedSensors.value.length - 1].timestamp).format('HH:mm');
});

function formatTime(timestamp) {
  return dayjs(timestamp).format('MM-DD HH:mm:ss');
}

function getDeviceName(sensor) {
  const room = props.rooms.find(r => r.id === sensor.roomId);
  const device = room?.devices?.find(d => d.id === sensor.deviceId);
  return device?.name || sensor.deviceId;
}

function getSensorTypeLabel(type) {
  const labels = {
    trigger: '触发',
    reset: '复位',
    error: '异常',
    warning: '警告'
  };
  return labels[type] || type;
}

function getSensorDotClass(type) {
  const classes = {
    trigger: 'bg-green-500',
    reset: 'bg-blue-500',
    error: 'bg-red-500',
    warning: 'bg-yellow-500'
  };
  return classes[type] || 'bg-gray-500';
}

function getSensorCardClass(type) {
  const classes = {
    trigger: 'bg-green-50 border border-green-200',
    reset: 'bg-blue-50 border border-blue-200',
    error: 'bg-red-50 border border-red-200',
    warning: 'bg-yellow-50 border border-yellow-200'
  };
  return classes[type] || 'bg-gray-50 border border-gray-200';
}

function getSensorTextClass(type) {
  const classes = {
    trigger: 'text-green-800',
    reset: 'text-blue-800',
    error: 'text-red-800',
    warning: 'text-yellow-800'
  };
  return classes[type] || 'text-gray-800';
}
</script>
