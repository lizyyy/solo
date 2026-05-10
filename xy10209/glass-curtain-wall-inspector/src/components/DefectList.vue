<script setup lang="ts">
import { computed } from 'vue';
import { useInspectorStore } from '../stores/inspectorStore';
import { DefectStatus, DefectType } from '../types';
import type { Defect } from '../types';
import { MapPin, Clock, FileJson, FileSpreadsheet, Building2 } from 'lucide-vue-next';

const store = useInspectorStore();

const emit = defineEmits<{
  (e: 'selectDefect', defect: Defect): void;
}>();

const buildingMap = computed(() => 
  new Map(store.buildings.map(b => [b.id, b.name]))
);

const typeLabels: Record<DefectType, string> = {
  [DefectType.CRACK]: '裂纹',
  [DefectType.LOOSENESS]: '松动'
};

const statusLabels: Record<DefectStatus, string> = {
  [DefectStatus.PENDING]: '待处理',
  [DefectStatus.IN_PROGRESS]: '处理中',
  [DefectStatus.REINSPECTED]: '已复检',
  [DefectStatus.CLOSED]: '已关闭'
};

const statusColors: Record<DefectStatus, string> = {
  [DefectStatus.PENDING]: '#e53935',
  [DefectStatus.IN_PROGRESS]: '#f57c00',
  [DefectStatus.REINSPECTED]: '#7cb342',
  [DefectStatus.CLOSED]: '#546e7a'
};

const formatDate = (ts: number) => new Date(ts).toLocaleString('zh-CN');

const handleExportJSON = () => {
  const data = store.exportToJSON();
  console.log('[导出] JSON报告已生成:', data);
};

const handleExportCSV = () => {
  const result = store.exportToCSV();
  console.log('[导出] CSV报告已生成:', result);
};

const handleExportBuildingJSON = () => {
  if (!store.selectedBuildingId) {
    alert('请先选择一个建筑');
    return;
  }
  const data = store.exportToJSON(store.selectedBuildingId);
  console.log('[导出] 建筑JSON报告:', data);
};

const handleExportBuildingCSV = () => {
  if (!store.selectedBuildingId) {
    alert('请先选择一个建筑');
    return;
  }
  const result = store.exportToCSV(store.selectedBuildingId);
  console.log('[导出] 建筑CSV报告:', result);
};
</script>

<template>
  <div class="defect-list">
    <div class="list-header">
      <h3>缺陷列表</h3>
      <div class="export-actions">
        <div class="export-group">
          <span class="export-label">全局导出</span>
          <button class="export-btn" @click="handleExportJSON" title="导出JSON">
            <FileJson :size="16" />
            <span>JSON</span>
          </button>
          <button class="export-btn" @click="handleExportCSV" title="导出CSV">
            <FileSpreadsheet :size="16" />
            <span>CSV</span>
          </button>
        </div>
        <div v-if="store.selectedBuildingId" class="export-group">
          <span class="export-label">建筑导出</span>
          <button class="export-btn building" @click="handleExportBuildingJSON" title="导出该建筑JSON">
            <Building2 :size="16" />
            <span>JSON</span>
          </button>
          <button class="export-btn building" @click="handleExportBuildingCSV" title="导出该建筑CSV">
            <Building2 :size="16" />
            <span>CSV</span>
          </button>
        </div>
      </div>
    </div>
    
    <div class="list-body">
      <div v-if="store.filteredDefects.length === 0" class="empty-state">
        <Clock :size="48" />
        <p>暂无符合条件的缺陷记录</p>
        <span>尝试调整筛选条件或选择其他建筑</span>
      </div>
      
      <div v-else class="defect-items">
        <div 
          v-for="defect in store.filteredDefects" 
          :key="defect.id"
          class="defect-item"
          :class="{ 'is-selected': store.selectedDefect?.id === defect.id }"
          @click="emit('selectDefect', defect)"
        >
          <div class="defect-main">
            <div class="defect-header">
              <span 
                class="type-badge"
                :class="defect.type === DefectType.CRACK ? 'type-crack' : 'type-looseness'"
              >
                {{ typeLabels[defect.type] }}
              </span>
              <span 
                class="status-badge"
                :style="{ color: statusColors[defect.status], backgroundColor: statusColors[defect.status] + '20' }"
              >
                {{ statusLabels[defect.status] }}
              </span>
            </div>
            
            <p class="defect-desc">{{ defect.description }}</p>
            
            <div class="defect-meta">
              <span class="meta-item">
                <MapPin :size="14" />
                {{ buildingMap.get(defect.buildingId) }} · {{ defect.floor }}F-{{ defect.column }}列
              </span>
              <span class="meta-item">
                <Clock :size="14" />
                {{ formatDate(defect.updatedAt) }}
              </span>
              <span v-if="defect.photos.length > 0" class="photo-count">
                📷 {{ defect.photos.length }}张
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.defect-list {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg, #fff);
  border: 1px solid var(--border, #e5e4e7);
  border-radius: 8px;
  overflow: hidden;
}

.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: var(--code-bg, #f4f3ec);
  border-bottom: 1px solid var(--border, #e5e4e7);
  flex-wrap: wrap;
  gap: 12px;
}

.list-header h3 {
  margin: 0;
  font-size: 15px;
  color: var(--text-h, #08060d);
}

.export-actions {
  display: flex;
  gap: 16px;
  align-items: center;
}

.export-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.export-label {
  font-size: 11px;
  color: var(--text, #6b6375);
}

.export-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  border: 1px solid var(--accent, #aa3bff);
  border-radius: 4px;
  background: var(--accent-bg, rgba(170, 59, 255, 0.1));
  color: var(--accent, #aa3bff);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.export-btn:hover {
  background: var(--accent, #aa3bff);
  color: white;
}

.export-btn.building {
  border-color: #7cb342;
  background: rgba(124, 179, 66, 0.1);
  color: #7cb342;
}

.export-btn.building:hover {
  background: #7cb342;
  color: white;
}

.list-body {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  color: var(--text, #6b6375);
  text-align: center;
}

.empty-state p {
  margin: 12px 0 4px;
  font-size: 14px;
  color: var(--text-h, #08060d);
}

.empty-state span {
  font-size: 12px;
}

.defect-items {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.defect-item {
  padding: 12px;
  border: 1px solid var(--border, #e5e4e7);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  background: var(--bg, #fff);
}

.defect-item:hover {
  border-color: var(--accent, #aa3bff);
  box-shadow: 0 2px 8px rgba(170, 59, 255, 0.15);
}

.defect-item.is-selected {
  border-color: var(--accent, #aa3bff);
  background: var(--accent-bg, rgba(170, 59, 255, 0.05));
}

.defect-main {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.defect-header {
  display: flex;
  gap: 8px;
  align-items: center;
}

.type-badge {
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
}

.type-badge.type-crack {
  background: rgba(229, 57, 53, 0.1);
  color: #e53935;
}

.type-badge.type-looseness {
  background: rgba(245, 124, 0, 0.1);
  color: #f57c00;
}

.status-badge {
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
}

.defect-desc {
  margin: 0;
  font-size: 13px;
  color: var(--text-h, #08060d);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.defect-meta {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--text, #6b6375);
}

.photo-count {
  font-size: 11px;
  color: var(--accent, #aa3bff);
  font-weight: 500;
}
</style>
