<template>
  <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
    <h2 class="text-lg font-semibold text-gray-900 mb-4">数据导入</h2>
    
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <div class="border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-blue-500 transition-colors">
        <div class="text-center">
          <div class="text-3xl mb-2">🏠</div>
          <h3 class="font-medium text-gray-700 mb-1">房间机关清单</h3>
          <p class="text-sm text-gray-500 mb-3">导入房间和设备配置</p>
          <input 
            type="file" 
            @change="handleFileUpload($event, 'rooms')"
            accept=".json,.csv"
            class="hidden" 
            ref="roomsInput"
          />
          <button 
            @click="$refs.roomsInput.click()"
            class="px-3 py-2 bg-blue-100 text-blue-700 rounded-md text-sm hover:bg-blue-200 transition-colors"
          >
            选择文件
          </button>
          <div v-if="rooms.length > 0" class="mt-2 text-sm text-green-600">
            ✓ 已导入 {{ rooms.length }} 个房间
          </div>
        </div>
      </div>

      <div class="border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-blue-500 transition-colors">
        <div class="text-center">
          <div class="text-3xl mb-2">📊</div>
          <h3 class="font-medium text-gray-700 mb-1">传感器触发日志</h3>
          <p class="text-sm text-gray-500 mb-3">导入触发和复位记录</p>
          <input 
            type="file" 
            @change="handleFileUpload($event, 'sensors')"
            accept=".json,.csv"
            class="hidden" 
            ref="sensorsInput"
          />
          <button 
            @click="$refs.sensorsInput.click()"
            class="px-3 py-2 bg-blue-100 text-blue-700 rounded-md text-sm hover:bg-blue-200 transition-colors"
          >
            选择文件
          </button>
          <div v-if="sensorsCount > 0" class="mt-2 text-sm text-green-600">
            ✓ 已导入 {{ sensorsCount }} 条记录
          </div>
        </div>
      </div>

      <div class="border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-blue-500 transition-colors">
        <div class="text-center">
          <div class="text-3xl mb-2">🔋</div>
          <h3 class="font-medium text-gray-700 mb-1">道具电量表</h3>
          <p class="text-sm text-gray-500 mb-3">导入设备电量信息</p>
          <input 
            type="file" 
            @change="handleFileUpload($event, 'batteries')"
            accept=".json,.csv"
            class="hidden" 
            ref="batteriesInput"
          />
          <button 
            @click="$refs.batteriesInput.click()"
            class="px-3 py-2 bg-blue-100 text-blue-700 rounded-md text-sm hover:bg-blue-200 transition-colors"
          >
            选择文件
          </button>
          <div v-if="batteriesCount > 0" class="mt-2 text-sm text-green-600">
            ✓ 已导入 {{ batteriesCount }} 个设备
          </div>
        </div>
      </div>

      <div class="border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-blue-500 transition-colors">
        <div class="text-center">
          <div class="text-3xl mb-2">📅</div>
          <h3 class="font-medium text-gray-700 mb-1">次日预约人数</h3>
          <p class="text-sm text-gray-500 mb-3">导入明日预约信息</p>
          <input 
            type="file" 
            @change="handleFileUpload($event, 'reservations')"
            accept=".json,.csv"
            class="hidden" 
            ref="reservationsInput"
          />
          <button 
            @click="$refs.reservationsInput.click()"
            class="px-3 py-2 bg-blue-100 text-blue-700 rounded-md text-sm hover:bg-blue-200 transition-colors"
          >
            选择文件
          </button>
          <div v-if="reservationsCount > 0" class="mt-2 text-sm text-green-600">
            ✓ 已导入 {{ reservationsCount }} 个预约
          </div>
        </div>
      </div>
    </div>

    <div class="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
      <p class="text-sm text-yellow-800">
        <span class="font-medium">提示：</span>支持 JSON 和 CSV 格式导入。点击"加载示例数据"可体验完整功能。
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
  }
});

const emit = defineEmits(['update-rooms', 'update-sensors', 'update-batteries', 'update-reservations']);

const sensorsCount = computed(() => props.rooms.reduce((sum, room) => {
  return sum + (room.sensors?.length || 0);
}, 0));

const batteriesCount = computed(() => props.rooms.reduce((sum, room) => {
  return sum + (room.devices?.filter(d => d.battery).length || 0);
}, 0));

const reservationsCount = computed(() => props.rooms.reduce((sum, room) => {
  return sum + (room.reservations?.length || 0);
}, 0));

function handleFileUpload(event, type) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const content = e.target.result;
      let data;

      if (file.name.endsWith('.json')) {
        data = JSON.parse(content);
      } else if (file.name.endsWith('.csv')) {
        data = parseCSV(content, type);
      }

      if (data) {
        switch (type) {
          case 'rooms':
            emit('update-rooms', data);
            break;
          case 'sensors':
            emit('update-sensors', data);
            break;
          case 'batteries':
            emit('update-batteries', data);
            break;
          case 'reservations':
            emit('update-reservations', data);
            break;
        }
      }
    } catch (error) {
      console.error('文件解析错误:', error);
      alert('文件解析失败，请检查文件格式');
    }
  };
  reader.readAsText(file);
  event.target.value = '';
}

function parseCSV(content, type) {
  const lines = content.split('\n').filter(line => line.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim());
  const data = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = values[index] || '';
    });
    data.push(obj);
  }

  return data;
}
</script>
