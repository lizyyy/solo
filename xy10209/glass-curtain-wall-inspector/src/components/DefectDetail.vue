<script setup lang="ts">
import { computed, ref } from 'vue';
import { useInspectorStore } from '../stores/inspectorStore';
import { DefectStatus, DefectType } from '../types';
import { X, Edit, AlertCircle, Clock, CheckCircle, Trash2, FileJson, Eye } from 'lucide-vue-next';

const store = useInspectorStore();

const transitionNote = ref('');

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'edit'): void;
}>();

const defect = computed(() => store.selectedDefect);
const building = computed(() => 
  store.buildings.find(b => b.id === defect.value?.buildingId)
);

const history = computed(() => 
  defect.value ? store.getDefectHistory(defect.value.id) : []
);

const typeLabel = computed(() => {
  const labels: Record<DefectType, string> = {
    [DefectType.CRACK]: '裂纹',
    [DefectType.LOOSENESS]: '松动'
  };
  return defect.value ? labels[defect.value.type] : '';
});

const statusInfo = computed(() => {
  const defaultInfo = { label: '', color: '#9ca3af', bgColor: 'rgba(156, 163, 175, 0.1)' };
  if (!defect.value) return defaultInfo;
  
  const statusMap: Record<DefectStatus, { label: string; color: string; bgColor: string }> = {
    [DefectStatus.PENDING]: { label: '待处理', color: '#e53935', bgColor: 'rgba(229, 57, 53, 0.1)' },
    [DefectStatus.IN_PROGRESS]: { label: '处理中', color: '#f57c00', bgColor: 'rgba(245, 124, 0, 0.1)' },
    [DefectStatus.REINSPECTED]: { label: '已复检', color: '#7cb342', bgColor: 'rgba(124, 179, 66, 0.1)' },
    [DefectStatus.CLOSED]: { label: '已关闭', color: '#546e7a', bgColor: 'rgba(84, 110, 122, 0.1)' }
  };
  
  return statusMap[defect.value.status];
});

const availableTransitions = computed(() => {
  if (!defect.value) return [];
  
  const transitions: Record<DefectStatus, { status: DefectStatus; label: string; color: string }[]> = {
    [DefectStatus.PENDING]: [
      { status: DefectStatus.IN_PROGRESS, label: '开始处理', color: '#f57c00' },
      { status: DefectStatus.CLOSED, label: '直接关闭', color: '#546e7a' }
    ],
    [DefectStatus.IN_PROGRESS]: [
      { status: DefectStatus.REINSPECTED, label: '申请复检', color: '#7cb342' },
      { status: DefectStatus.CLOSED, label: '关闭工单', color: '#546e7a' }
    ],
    [DefectStatus.REINSPECTED]: [
      { status: DefectStatus.IN_PROGRESS, label: '返工处理', color: '#f57c00' },
      { status: DefectStatus.CLOSED, label: '验收通过', color: '#546e7a' }
    ],
    [DefectStatus.CLOSED]: [
      { status: DefectStatus.IN_PROGRESS, label: '重新打开', color: '#f57c00' }
    ]
  };
  
  return transitions[defect.value.status];
});

const formatDate = (ts: number) => new Date(ts).toLocaleString('zh-CN');

const handleTransition = (newStatus: DefectStatus) => {
  if (!defect.value) return;
  
  if (!transitionNote.value.trim()) {
    console.error('[流转] 请填写流转备注');
    alert('请填写流转备注');
    return;
  }
  
  const success = store.transitionStatus(defect.value.id, newStatus, transitionNote.value);
  if (success) {
    transitionNote.value = '';
    console.log(`[流转] 成功: ${defect.value.status} -> ${newStatus}`);
  } else {
    console.error('[流转] 状态流转失败');
  }
};

const handleDelete = () => {
  if (!defect.value) return;
  
  if (confirm(`确定要删除缺陷 ${defect.value.id} 吗？此操作不可恢复。`)) {
    const success = store.deleteDefect(defect.value.id);
    if (success) {
      emit('close');
      console.log('[删除] 缺陷成功:', defect.value.id);
    }
  }
};

const handleExportSingleJSON = () => {
  if (!defect.value) return;
  const data = {
    defect: defect.value,
    building: building.value,
    history: history.value
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `defect-${defect.value.id}-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  console.log('[导出] 单个缺陷JSON');
};

const getStatusLabel = (status: DefectStatus) => {
  const labels: Record<DefectStatus, string> = {
    [DefectStatus.PENDING]: '待处理',
    [DefectStatus.IN_PROGRESS]: '处理中',
    [DefectStatus.REINSPECTED]: '已复检',
    [DefectStatus.CLOSED]: '已关闭'
  };
  return labels[status];
};
</script>

<template>
  <div v-if="defect" class="detail-panel">
    <div class="panel-header">
      <h3>缺陷详情</h3>
      <div class="header-actions">
        <button class="icon-btn" title="导出JSON" @click="handleExportSingleJSON">
          <FileJson :size="18" />
        </button>
        <button class="icon-btn" title="编辑" @click="emit('edit')">
          <Edit :size="18" />
        </button>
        <button class="icon-btn danger" title="删除" @click="handleDelete">
          <Trash2 :size="18" />
        </button>
        <button class="icon-btn" title="关闭" @click="emit('close')">
          <X :size="18" />
        </button>
      </div>
    </div>
    
    <div class="panel-body">
      <div class="section">
        <div class="info-row">
          <span class="info-label">缺陷ID</span>
          <span class="info-value code">{{ defect.id }}</span>
        </div>
        <div class="info-row">
          <span class="info-label">建筑</span>
          <span class="info-value">{{ building?.name || '-' }}</span>
        </div>
        <div class="info-row">
          <span class="info-label">位置</span>
          <span class="info-value highlight">
            {{ defect.floor }}层 - 第{{ defect.column }}列
          </span>
        </div>
        <div class="info-row">
          <span class="info-label">类型</span>
          <span 
            class="info-badge"
            :class="defect.type === DefectType.CRACK ? 'type-crack' : 'type-looseness'"
          >
            {{ typeLabel }}
          </span>
        </div>
        <div class="info-row">
          <span class="info-label">状态</span>
          <span 
            class="info-badge status-badge"
            :style="{ color: statusInfo.color, backgroundColor: statusInfo.bgColor }"
          >
            <component :is="defect.status === DefectStatus.PENDING ? AlertCircle : 
                            defect.status === DefectStatus.IN_PROGRESS ? Clock : 
                            defect.status === DefectStatus.REINSPECTED ? Eye : CheckCircle" 
              :size="14" 
            />
            {{ statusInfo.label }}
          </span>
        </div>
      </div>
      
      <div class="section">
        <h4>缺陷描述</h4>
        <p class="description">{{ defect.description }}</p>
      </div>
      
      <div v-if="defect.inspectionNote" class="section">
        <h4>巡检备注</h4>
        <p class="description">{{ defect.inspectionNote }}</p>
      </div>
      
      <div v-if="defect.reinspectionNote" class="section">
        <h4>复检备注</h4>
        <p class="description">{{ defect.reinspectionNote }}</p>
      </div>
      
      <div class="section">
        <h4>照片附件 ({{ defect.photos.length }})</h4>
        <div v-if="defect.photos.length > 0" class="photos-preview">
          <div v-for="photo in defect.photos" :key="photo.id" class="photo-card">
            <img :src="photo.url" :alt="photo.name" />
            <span class="photo-filename">{{ photo.name }}</span>
          </div>
        </div>
        <div v-else class="no-data">
          暂无照片附件
        </div>
      </div>
      
      <div class="section">
        <h4>时间信息</h4>
        <div class="info-row">
          <span class="info-label">创建时间</span>
          <span class="info-value">{{ formatDate(defect.createdAt) }}</span>
        </div>
        <div class="info-row">
          <span class="info-label">更新时间</span>
          <span class="info-value">{{ formatDate(defect.updatedAt) }}</span>
        </div>
      </div>
      
      <div v-if="availableTransitions.length > 0" class="section">
        <h4>状态流转</h4>
        <div class="transition-area">
          <textarea 
            v-model="transitionNote"
            placeholder="请填写流转备注（必填）..."
            rows="2"
          ></textarea>
          <div class="transition-buttons">
            <button 
              v-for="t in availableTransitions" 
              :key="t.status"
              class="transition-btn"
              :style="{ backgroundColor: t.color }"
              @click="handleTransition(t.status)"
            >
              {{ t.label }}
            </button>
          </div>
        </div>
      </div>
      
      <div v-if="history.length > 0" class="section">
        <h4>流转历史 ({{ history.length }})</h4>
        <div class="history-timeline">
          <div v-for="record in history" :key="record.id" class="timeline-item">
            <div class="timeline-dot"></div>
            <div class="timeline-content">
              <div class="timeline-header">
                <span class="timeline-status">{{ getStatusLabel(record.newStatus) }}</span>
                <span class="timeline-time">{{ formatDate(record.timestamp) }}</span>
              </div>
              <div class="timeline-detail">
                {{ getStatusLabel(record.previousStatus) }} → {{ getStatusLabel(record.newStatus) }}
              </div>
              <p class="timeline-note">{{ record.note }}</p>
              <span class="timeline-operator">操作人: {{ record.operator }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.detail-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg, #fff);
  border-left: 1px solid var(--border, #e5e4e7);
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border, #e5e4e7);
  background: var(--code-bg, #f4f3ec);
}

.panel-header h3 {
  margin: 0;
  font-size: 16px;
  color: var(--text-h, #08060d);
}

.header-actions {
  display: flex;
  gap: 8px;
}

.icon-btn {
  background: none;
  border: 1px solid var(--border, #e5e4e7);
  border-radius: 6px;
  padding: 6px;
  cursor: pointer;
  color: var(--text, #6b6375);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.icon-btn:hover {
  background: var(--accent-bg, rgba(170, 59, 255, 0.1));
  border-color: var(--accent, #aa3bff);
  color: var(--accent, #aa3bff);
}

.icon-btn.danger:hover {
  background: rgba(229, 57, 53, 0.1);
  border-color: #e53935;
  color: #e53935;
}

.panel-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.section {
  margin-bottom: 24px;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--border, #e5e4e7);
}

.section:last-child {
  border-bottom: none;
  margin-bottom: 0;
  padding-bottom: 0;
}

.section h4 {
  margin: 0 0 12px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-h, #08060d);
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
}

.info-label {
  font-size: 13px;
  color: var(--text, #6b6375);
}

.info-value {
  font-size: 13px;
  color: var(--text-h, #08060d);
  font-weight: 500;
}

.info-value.code {
  font-family: var(--mono, ui-monospace);
  font-size: 12px;
  background: var(--code-bg, #f4f3ec);
  padding: 2px 8px;
  border-radius: 4px;
}

.info-value.highlight {
  background: var(--accent-bg, rgba(170, 59, 255, 0.1));
  color: var(--accent, #aa3bff);
  padding: 2px 8px;
  border-radius: 4px;
}

.info-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.info-badge.type-crack {
  background: rgba(229, 57, 53, 0.1);
  color: #e53935;
}

.info-badge.type-looseness {
  background: rgba(245, 124, 0, 0.1);
  color: #f57c00;
}

.status-badge {
  font-weight: 600;
}

.description {
  margin: 0;
  padding: 12px;
  background: var(--code-bg, #f4f3ec);
  border-radius: 6px;
  font-size: 13px;
  line-height: 1.6;
  color: var(--text-h, #08060d);
  white-space: pre-wrap;
}

.photos-preview {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.photo-card {
  border: 1px solid var(--border, #e5e4e7);
  border-radius: 6px;
  overflow: hidden;
  background: var(--code-bg, #f4f3ec);
}

.photo-card img {
  width: 100%;
  height: 80px;
  object-fit: cover;
}

.photo-filename {
  display: block;
  padding: 6px 8px;
  font-size: 11px;
  color: var(--text, #6b6375);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.no-data {
  text-align: center;
  padding: 20px;
  background: var(--code-bg, #f4f3ec);
  border-radius: 6px;
  color: var(--text, #6b6375);
  font-size: 13px;
}

.transition-area {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.transition-area textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--border, #e5e4e7);
  border-radius: 6px;
  font-size: 13px;
  resize: vertical;
  box-sizing: border-box;
  min-height: 60px;
}

.transition-area textarea:focus {
  outline: none;
  border-color: var(--accent, #aa3bff);
}

.transition-buttons {
  display: flex;
  gap: 10px;
}

.transition-btn {
  flex: 1;
  padding: 10px 16px;
  border: none;
  border-radius: 6px;
  color: white;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.transition-btn:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}

.history-timeline {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.timeline-item {
  display: flex;
  gap: 12px;
}

.timeline-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--accent, #aa3bff);
  margin-top: 6px;
  flex-shrink: 0;
}

.timeline-content {
  flex: 1;
  padding-bottom: 12px;
  border-bottom: 1px dashed var(--border, #e5e4e7);
}

.timeline-item:last-child .timeline-content {
  border-bottom: none;
  padding-bottom: 0;
}

.timeline-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.timeline-status {
  font-size: 13px;
  font-weight: 600;
  color: var(--accent, #aa3bff);
}

.timeline-time {
  font-size: 11px;
  color: var(--text, #6b6375);
}

.timeline-detail {
  font-size: 12px;
  color: var(--text, #6b6375);
  margin-bottom: 4px;
}

.timeline-note {
  margin: 4px 0;
  font-size: 12px;
  color: var(--text-h, #08060d);
  background: var(--code-bg, #f4f3ec);
  padding: 8px;
  border-radius: 4px;
}

.timeline-operator {
  font-size: 11px;
  color: var(--text, #6b6375);
}
</style>
