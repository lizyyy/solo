<template>
  <div class="min-h-screen bg-gray-50">
    <header class="bg-white shadow-sm border-b border-gray-200">
      <div class="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
        <div class="flex justify-between items-center">
          <div>
            <h1 class="text-2xl font-bold text-gray-900">密室逃脱闭店机关巡检工具</h1>
            <p class="text-sm text-gray-500 mt-1">今日日期：{{ currentDate }}</p>
          </div>
          <div class="flex space-x-3">
            <button 
              @click="loadSampleData" 
              class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              加载示例数据
            </button>
            <button 
              @click="exportMarkdown" 
              class="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm font-medium"
            >
              导出Markdown交班单
            </button>
            <button 
              @click="exportJSON" 
              class="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors text-sm font-medium"
            >
              导出JSON明细
            </button>
          </div>
        </div>
      </div>
    </header>

    <main class="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
      <DataImportComponent 
        :rooms="rooms" 
        @update-rooms="updateRooms"
        @update-sensors="updateSensors"
        @update-batteries="updateBatteries"
        @update-reservations="updateReservations"
      />

      <div v-if="hasData" class="mt-8 space-y-8">
        <RiskSummary :risks="allRisks" />
        <RoomPlanner 
          :rooms="rooms" 
          :risks="allRisks"
          @select-room="selectRoom"
          @update-room-status="updateRoomStatus"
        />
        <TimelineView 
          :sensors="sensors" 
          :rooms="rooms"
          :selected-room="selectedRoom"
        />
        <RoomReviewPanel 
          v-if="selectedRoom"
          :room="selectedRoom"
          :risks="roomRisks"
          @update-risk-status="updateRiskStatus"
          @update-risk-remark="updateRiskRemark"
        />
      </div>

      <div v-else class="mt-16 text-center py-16 bg-white rounded-lg shadow-sm border border-gray-200">
        <div class="text-gray-400 text-6xl mb-4">🏚️</div>
        <h3 class="text-lg font-medium text-gray-900 mb-2">暂无数据</h3>
        <p class="text-gray-500 mb-6">请导入房间机关清单、传感器触发日志、道具电量表和次日预约人数</p>
        <button 
          @click="loadSampleData" 
          class="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
        >
          加载示例数据体验
        </button>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import dayjs from 'dayjs';
import { v4 as uuidv4 } from 'uuid';
import DataImportComponent from './components/DataImportComponent.vue';
import RiskSummary from './components/RiskSummary.vue';
import RoomPlanner from './components/RoomPlanner.vue';
import TimelineView from './components/TimelineView.vue';
import RoomReviewPanel from './components/RoomReviewPanel.vue';
import { calculateRisks } from './utils/riskCalculator';
import { sampleData } from './data/sampleData';

const rooms = ref([]);
const sensors = ref([]);
const batteries = ref([]);
const reservations = ref([]);
const selectedRoom = ref(null);

const currentDate = computed(() => dayjs().format('YYYY年MM月DD日'));

const hasData = computed(() => {
  return rooms.value.length > 0 || 
         sensors.value.length > 0 || 
         batteries.value.length > 0;
});

const allRisks = computed(() => {
  return calculateRisks({
    rooms: rooms.value,
    sensors: sensors.value,
    batteries: batteries.value,
    reservations: reservations.value
  });
});

const roomRisks = computed(() => {
  if (!selectedRoom.value) return [];
  return allRisks.value.filter(risk => risk.roomId === selectedRoom.value.id);
});

function updateRooms(newRooms) {
  rooms.value = newRooms;
  saveToLocalStorage();
}

function updateSensors(newSensors) {
  sensors.value = newSensors;
  saveToLocalStorage();
}

function updateBatteries(newBatteries) {
  batteries.value = newBatteries;
  saveToLocalStorage();
}

function updateReservations(newReservations) {
  reservations.value = newReservations;
  saveToLocalStorage();
}

function selectRoom(room) {
  selectedRoom.value = room;
}

function updateRoomStatus(roomId, status) {
  const room = rooms.value.find(r => r.id === roomId);
  if (room) {
    room.status = status;
    saveToLocalStorage();
  }
}

function updateRiskStatus(riskId, status) {
  const risk = allRisks.value.find(r => r.id === riskId);
  if (risk) {
    risk.status = status;
    saveToLocalStorage();
  }
}

function updateRiskRemark(riskId, remark) {
  const risk = allRisks.value.find(r => r.id === riskId);
  if (risk) {
    risk.remark = remark;
    saveToLocalStorage();
  }
}

function loadSampleData() {
  rooms.value = JSON.parse(JSON.stringify(sampleData.rooms));
  sensors.value = JSON.parse(JSON.stringify(sampleData.sensors));
  batteries.value = JSON.parse(JSON.stringify(sampleData.batteries));
  reservations.value = JSON.parse(JSON.stringify(sampleData.reservations));
  
  const risks = calculateRisks({
    rooms: rooms.value,
    sensors: sensors.value,
    batteries: batteries.value,
    reservations: reservations.value
  });
  
  risks.forEach(risk => {
    if (!risk.id) risk.id = uuidv4();
    if (!risk.status) risk.status = 'pending';
  });
  
  saveToLocalStorage();
}

function exportMarkdown() {
  let markdown = `# 密室逃脱闭店巡检交班单

## 巡检日期
${dayjs().format('YYYY年MM月DD日 HH:mm')}

## 房间状态概览
`;

  rooms.value.forEach(room => {
    const roomRisks = allRisks.value.filter(r => r.roomId === room.id);
    const pendingRisks = roomRisks.filter(r => r.status === 'pending');
    const resolvedRisks = roomRisks.filter(r => r.status === 'resolved');
    
    markdown += `
### ${room.name}
- **状态**: ${room.status === 'normal' ? '正常' : room.status === 'warning' ? '注意' : '异常'}
- **待处理风险**: ${pendingRisks.length} 项
- **已处理风险**: ${resolvedRisks.length} 项

#### 风险明细
`;
    
    if (roomRisks.length === 0) {
      markdown += `- 无风险\n`;
    } else {
      roomRisks.forEach((risk, index) => {
        const riskTypeMap = {
          'card_stuck': '卡关',
          'false_trigger': '误触',
          'low_battery': '低电量',
          'maintenance_conflict': '维修冲突',
          'timeout_reset': '超时未复位',
          'consecutive_trigger': '连续误触'
        };
        
        const statusMap = {
          'pending': '待处理',
          'reviewed': '已复核',
          'resolved': '已解决'
        };
        
        markdown += `
${index + 1}. **${riskTypeMap[risk.type] || risk.type}**
   - 状态: ${statusMap[risk.status]}
   - 描述: ${risk.description}
   ${risk.remark ? `- 备注: ${risk.remark}` : ''}
`;
      });
    }
  });

  markdown += `
## 次日预约情况
`;

  if (reservations.value.length === 0) {
    markdown += `- 暂无预约\n`;
  } else {
    reservations.value.forEach(res => {
      const room = rooms.value.find(r => r.id === res.roomId);
      markdown += `- **${room?.name || res.roomId}**: ${res.count} 人，${dayjs(res.date).format('MM月DD日')} ${res.timeSlot}\n`;
    });
  }

  markdown += `
---
*生成时间: ${dayjs().format('YYYY-MM-DD HH:mm:ss')}*
`;

  downloadFile(markdown, `交班单_${dayjs().format('YYYYMMDD')}.md`, 'text/markdown');
}

function exportJSON() {
  const data = {
    exportTime: dayjs().toISOString(),
    rooms: rooms.value,
    sensors: sensors.value,
    batteries: batteries.value,
    reservations: reservations.value,
    risks: allRisks.value
  };
  
  const jsonString = JSON.stringify(data, null, 2);
  downloadFile(jsonString, `巡检明细_${dayjs().format('YYYYMMDD')}.json`, 'application/json');
}

function downloadFile(content, filename, contentType) {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function saveToLocalStorage() {
  const data = {
    rooms: rooms.value,
    sensors: sensors.value,
    batteries: batteries.value,
    reservations: reservations.value,
    risks: allRisks.value,
    savedAt: dayjs().toISOString()
  };
  localStorage.setItem('escapeRoomInspectionData', JSON.stringify(data));
}

function loadFromLocalStorage() {
  const saved = localStorage.getItem('escapeRoomInspectionData');
  if (saved) {
    try {
      const data = JSON.parse(saved);
      if (data.rooms) rooms.value = data.rooms;
      if (data.sensors) sensors.value = data.sensors;
      if (data.batteries) batteries.value = data.batteries;
      if (data.reservations) reservations.value = data.reservations;
    } catch (e) {
      console.error('Failed to load from localStorage:', e);
    }
  }
}

onMounted(() => {
  loadFromLocalStorage();
});
</script>
