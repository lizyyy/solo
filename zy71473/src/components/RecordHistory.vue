<template>
  <div class="record-history">
    <div class="panel-header">
      <h2>训练记录管理</h2>
      <div class="header-actions">
        <button class="btn-export" @click="handleExport">导出数据</button>
      </div>
    </div>

    <div class="tabs">
      <button class="tab" :class="{ active: activeTab === 'normal' }" @click="activeTab = 'normal'">
        正常记录
        <span class="badge normal">{{ recordStore.records.length }}</span>
      </button>
      <button class="tab" :class="{ active: activeTab === 'pending' }" @click="activeTab = 'pending'">
        待确认
        <span class="badge pending">{{ recordStore.pendingRecords.length }}</span>
      </button>
      <button class="tab" :class="{ active: activeTab === 'anomaly' }" @click="activeTab = 'anomaly'">
        异常清单
        <span class="badge anomaly">{{ recordStore.anomalyRecords.length }}</span>
      </button>
    </div>

    <div class="record-list">
      <div v-for="record in currentRecords" :key="record.id" class="record-item" :class="record.status">
        <div class="record-header">
          <div class="record-meta">
            <span class="record-id">#{{ record.id.slice(-6) }}</span>
            <span class="record-time">{{ formatTime(record.createdAt) }}</span>
            <span class="record-status" :class="record.status">{{ getStatusLabel(record.status) }}</span>
          </div>
          <div class="record-actions">
            <button v-if="activeTab === 'pending'" class="btn-small approve" @click="approveRecord(record.id)">
              批准
            </button>
            <button v-if="activeTab === 'normal'" class="btn-small withdraw" @click="withdrawRecord(record.id)">
              撤回
            </button>
            <button v-if="activeTab === 'anomaly'" class="btn-small delete" @click="rejectRecord(record.id)">
              删除
            </button>
          </div>
        </div>

        <div class="record-params">
          <span class="param-tag">初速 {{ record.params.initialVelocity }}m/s</span>
          <span class="param-tag">距离 {{ record.params.distance }}m</span>
          <span class="param-tag">风速 {{ record.params.windSpeed }}m/s</span>
          <span class="param-tag">风向 {{ record.params.windAngle }}°</span>
        </div>

        <div class="record-result">
          <span>风偏: <strong>{{ (record.result.impact?.z || 0).toFixed(3) }}m</strong></span>
          <span>飞行: <strong>{{ (record.result.impact?.time || 0).toFixed(3) }}s</strong></span>
        </div>

        <div v-if="record.notes" class="record-notes">
          <span class="notes-icon">📝</span>
          <span>{{ record.notes }}</span>
        </div>

        <div v-if="record.validation && record.validation.messages?.length > 0" class="record-validation">
          <div v-for="(msg, idx) in record.validation.messages" :key="idx" :class="['msg', msg.type]">
            {{ msg.message }}
          </div>
        </div>

        <div class="record-footer">
          <span class="version">v{{ record.version }}</span>
          <span v-if="record.source !== 'direct'" class="source">{{ getSourceLabel(record.source) }}</span>
        </div>
      </div>

      <div v-if="currentRecords.length === 0" class="empty-state">
        <div class="empty-icon">📋</div>
        <p>{{ getEmptyMessage() }}</p>
      </div>
    </div>

    <div class="export-stats">
      <h3>导出统计</h3>
      <div class="stats-row">
        <span>累计导出次数</span>
        <span class="highlight">{{ recordStore.exportStats.exportCount }}</span>
      </div>
      <div class="stats-row">
        <span>最后导出时间</span>
        <span>{{ recordStore.exportStats.lastExport ? formatTime(recordStore.exportStats.lastExport) : '无' }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { recordStore } from '../store/recordStore.js';

const activeTab = ref('normal');

const currentRecords = computed(() => {
  switch (activeTab.value) {
    case 'pending': return recordStore.pendingRecords;
    case 'anomaly': return recordStore.anomalyRecords;
    default: return recordStore.records;
  }
});

function formatTime(isoString) {
  const d = new Date(isoString);
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

function getStatusLabel(status) {
  const labels = {
    normal: '正常',
    pending: '待确认',
    anomaly: '异常',
    duplicate: '重复',
    supplemented: '已补录',
    withdrawn: '已撤回'
  };
  return labels[status] || status;
}

function getSourceLabel(source) {
  const labels = {
    direct: '直接提交',
    supplement: '补录',
    retry: '重试'
  };
  return labels[source] || source;
}

function getEmptyMessage() {
  switch (activeTab.value) {
    case 'pending': return '暂无待确认记录';
    case 'anomaly': return '暂无异常记录';
    default: return '暂无训练记录，调整参数后点击"提交记录"';
  }
}

function approveRecord(id) {
  recordStore.approvePending(id);
}

function withdrawRecord(id) {
  recordStore.withdrawRecord(id);
}

function rejectRecord(id) {
  recordStore.rejectAnomaly(id);
}

function handleExport() {
  const data = recordStore.exportRecords();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ballistic_records_${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
</script>

<style scoped>
.record-history {
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  border-top: 1px solid #2a2a4e;
  padding: 16px 20px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  max-height: 40vh;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.panel-header h2 {
  font-size: 16px;
  color: #e0e0e0;
  font-weight: 600;
}

.btn-export {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-export:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px #10b98140;
}

.tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.tab {
  flex: 1;
  background: #0a0a15;
  border: 1px solid #2a2a4e;
  color: #8888aa;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.tab:hover {
  background: #151525;
}

.tab.active {
  background: #3b82f620;
  border-color: #3b82f6;
  color: #3b82f6;
}

.badge {
  padding: 2px 6px;
  border-radius: 10px;
  font-size: 10px;
  font-weight: 600;
}

.badge.normal { background: #10b98130; color: #10b981; }
.badge.pending { background: #f59e0b30; color: #f59e0b; }
.badge.anomaly { background: #ef444430; color: #ef4444; }

.record-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-right: 4px;
}

.record-item {
  background: #0a0a15;
  border: 1px solid #2a2a4e;
  border-radius: 8px;
  padding: 12px;
  transition: all 0.2s;
}

.record-item:hover {
  border-color: #3b82f6;
}

.record-item.normal { border-left: 3px solid #10b981; }
.record-item.pending { border-left: 3px solid #f59e0b; }
.record-item.anomaly { border-left: 3px solid #ef4444; }
.record-item.duplicate { border-left: 3px solid #8b5cf6; }
.record-item.supplemented { border-left: 3px solid #3b82f6; }
.record-item.withdrawn { border-left: 3px solid #f97316; }

.record-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 8px;
}

.record-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
}

.record-id {
  color: #8888aa;
  font-family: monospace;
}

.record-time {
  color: #666688;
}

.record-status {
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 500;
}

.record-status.normal { background: #10b98120; color: #10b981; }
.record-status.pending { background: #f59e0b20; color: #f59e0b; }
.record-status.anomaly { background: #ef444420; color: #ef4444; }
.record-status.supplemented { background: #3b82f620; color: #3b82f6; }
.record-status.duplicate { background: #8b5cf620; color: #8b5cf6; }
.record-status.withdrawn { background: #f9731620; color: #f97316; }

.record-actions {
  display: flex;
  gap: 4px;
}

.btn-small {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 10px;
  border: none;
  cursor: pointer;
  font-weight: 500;
}

.btn-small.approve { background: #10b981; color: white; }
.btn-small.withdraw { background: #f59e0b; color: white; }
.btn-small.delete { background: #ef4444; color: white; }

.record-params {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}

.param-tag {
  background: #1a1a2e;
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 11px;
  color: #aaaacc;
}

.record-result {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: #8888aa;
  margin-bottom: 8px;
}

.record-result strong {
  color: #e0e0e0;
}

.record-notes {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  background: #f59e0b15;
  padding: 6px 10px;
  border-radius: 4px;
  font-size: 11px;
  color: #f59e0b;
  margin-bottom: 8px;
}

.notes-icon {
  font-size: 12px;
}

.record-validation {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 8px;
}

.record-validation .msg {
  font-size: 10px;
  padding: 3px 8px;
  border-radius: 4px;
}

.record-validation .msg.error { background: #ef444420; color: #ef4444; }
.record-validation .msg.wind_direction { background: #f59e0b20; color: #f59e0b; }
.record-validation .msg.units { background: #f59e0b20; color: #f59e0b; }
.record-validation .msg.wind_reverse { background: #3b82f620; color: #3b82f6; }

.record-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 8px;
  border-top: 1px solid #2a2a4e;
  font-size: 10px;
  color: #666688;
}

.source {
  background: #8b5cf620;
  color: #8b5cf6;
  padding: 2px 6px;
  border-radius: 4px;
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: #666688;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 12px;
  opacity: 0.5;
}

.export-stats {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #2a2a4e;
}

.export-stats h3 {
  font-size: 12px;
  color: #8888aa;
  margin-bottom: 10px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.stats-row {
  display: flex;
  justify-content: space-between;
  padding: 6px 0;
  font-size: 12px;
  color: #aaaacc;
}

.stats-row .highlight {
  color: #10b981;
  font-weight: 600;
}
</style>
