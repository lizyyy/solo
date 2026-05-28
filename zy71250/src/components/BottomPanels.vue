<template>
  <div class="bottom-panel">
    <div class="panel">
      <h4>异常合约列表</h4>
      <table class="data-table">
        <thead>
          <tr>
            <th>合约代码</th>
            <th>行权价</th>
            <th>到期</th>
            <th>IV</th>
            <th>状态</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="record in store.anomalyRecords.slice(0, 10)" :key="record.id"
              @click="selectRecord(record)" :class="{ selected: store.selectedRecordId === record.id }">
            <td>{{ record.contractCode }}</td>
            <td>{{ record.strikePrice.toFixed(2) }}</td>
            <td>{{ record.expiryDays }}天</td>
            <td :class="{ 'iv-high': record.iv > 0.5, 'iv-low': record.iv < 0.1 }">
              {{ (record.iv * 100).toFixed(1) }}%
            </td>
            <td>
              <span :class="['tag', 'tag-' + record.status]">{{ statusLabel(record.status) }}</span>
            </td>
            <td>
              <button class="btn btn-danger btn-xs" @click.stop="revoke(record.id)">撤回</button>
            </td>
          </tr>
          <tr v-if="store.anomalyRecords.length === 0">
            <td colspan="6" class="empty-cell">暂无异常合约</td>
          </tr>
        </tbody>
      </table>
    </div>
    
    <div class="panel">
      <h4>合约明细</h4>
      <div v-if="store.selectedRecord" class="detail-content">
        <div class="detail-header">
          <h5>{{ store.selectedRecord.contractCode }}</h5>
          <span :class="['tag', 'tag-' + store.selectedRecord.status]">
            {{ statusLabel(store.selectedRecord.status) }}
          </span>
        </div>
        
        <div class="detail-grid">
          <div class="detail-item">
            <span class="label">标的</span>
            <span class="value">{{ store.selectedRecord.underlying }}</span>
          </div>
          <div class="detail-item">
            <span class="label">行权价</span>
            <span class="value">{{ store.selectedRecord.strikePrice.toFixed(2) }}</span>
          </div>
          <div class="detail-item">
            <span class="label">到期日</span>
            <span class="value">{{ store.selectedRecord.expiryDate }}</span>
          </div>
          <div class="detail-item">
            <span class="label">剩余天数</span>
            <span class="value">{{ store.selectedRecord.expiryDays }}天</span>
          </div>
          <div class="detail-item">
            <span class="label">隐含波动率</span>
            <span class="value highlight">{{ (store.selectedRecord.iv * 100).toFixed(2) }}%</span>
          </div>
          <div class="detail-item">
            <span class="label">成交量</span>
            <span class="value">{{ store.selectedRecord.volume.toLocaleString() }}</span>
          </div>
          <div class="detail-item">
            <span class="label">持仓量</span>
            <span class="value">{{ store.selectedRecord.openInterest.toLocaleString() }}</span>
          </div>
          <div class="detail-item">
            <span class="label">异常分</span>
            <span :class="['value', store.selectedRecord.anomalyScore >= 50 ? 'danger' : '']">
              {{ store.selectedRecord.anomalyScore }}
            </span>
          </div>
          <div class="detail-item full">
            <span class="label">数据来源</span>
            <span class="value">{{ store.selectedRecord.isInterpolated ? '插值生成' : '实际报价' }}</span>
          </div>
        </div>
        
        <div v-if="store.selectedRecord.anomalyReason?.length" class="anomaly-reasons">
          <h6>异常原因</h6>
          <ul>
            <li v-for="(r, idx) in store.selectedRecord.anomalyReason" :key="idx">{{ r }}</li>
          </ul>
        </div>
        
        <div class="status-flow">
          <span class="label">状态流转:</span>
          <template v-for="(step, idx) in StatusFlow" :key="step.key">
            <span :class="['step', store.selectedRecord.statusFlow.includes(step.key) ? 'active' : '']">
              {{ step.label }}
            </span>
            <span v-if="idx < StatusFlow.length - 1" class="arrow">→</span>
          </template>
        </div>
        
        <div class="detail-actions">
          <button class="btn btn-warning" @click="editRecord">编辑</button>
          <button class="btn btn-danger" @click="revoke(store.selectedRecord.id)">撤回</button>
          <button class="btn btn-secondary" @click="store.selectRecord(null)">关闭</button>
        </div>
      </div>
      <div v-else class="empty-cell">点击列表选择合约查看详情</div>
    </div>
    
    <div class="panel">
      <h4>操作历史</h4>
      <div class="history-list">
        <div v-for="item in store.operationHistory.slice(0, 20)" :key="item.id" class="history-item">
          <span class="history-time">{{ formatTime(item.timestamp) }}</span>
          <span :class="['history-action', item.action]">{{ item.label }}</span>
          <span class="history-detail">{{ item.detail }}</span>
        </div>
        <div v-if="store.operationHistory.length === 0" class="empty-cell">暂无操作记录</div>
      </div>
    </div>
    
    <div v-if="showEditModal" class="modal-overlay" @click.self="showEditModal = false">
      <div class="modal">
        <h3>编辑合约</h3>
        <div class="form-row">
          <div>
            <label>行权价</label>
            <input type="number" step="0.1" v-model.number="editForm.strikePrice" />
          </div>
          <div>
            <label>隐含波动率(%)</label>
            <input type="number" step="0.1" v-model.number="editForm.iv" />
          </div>
        </div>
        <div class="form-row">
          <div>
            <label>成交量</label>
            <input type="number" v-model.number="editForm.volume" />
          </div>
          <div>
            <label>持仓量</label>
            <input type="number" v-model.number="editForm.openInterest" />
          </div>
        </div>
        <div class="form-row full">
          <label>状态</label>
          <select v-model="editForm.status">
            <option value="normal">正常</option>
            <option value="warning">警告</option>
            <option value="anomaly">异常</option>
            <option value="pending">待处理</option>
          </select>
        </div>
        <div class="btn-group" style="margin-top: 12px;">
          <button class="btn btn-secondary" @click="showEditModal = false">取消</button>
          <button class="btn btn-primary" @click="saveEdit">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useOptionStore } from '../stores/optionStore.js'
import { OptionStatus, StatusFlow } from '../types/option.js'

const store = useOptionStore()

const showEditModal = ref(false)
const editForm = reactive({
  strikePrice: 0,
  iv: 0,
  volume: 0,
  openInterest: 0,
  status: 'normal'
})

function statusLabel(status) {
  const map = { pending: '待处理', normal: '正常', warning: '警告', anomaly: '异常', revoked: '已撤回' }
  return map[status] || status
}

function formatTime(ts) {
  const d = new Date(ts)
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`
}

function selectRecord(record) {
  store.selectRecord(record.id)
}

function revoke(id) {
  if (confirm('确认撤回该合约数据？')) {
    store.revokeRecord(id)
  }
}

function editRecord() {
  if (!store.selectedRecord) return
  Object.assign(editForm, {
    strikePrice: store.selectedRecord.strikePrice,
    iv: store.selectedRecord.iv * 100,
    volume: store.selectedRecord.volume,
    openInterest: store.selectedRecord.openInterest,
    status: store.selectedRecord.status
  })
  showEditModal.value = true
}

function saveEdit() {
  if (!store.selectedRecord) return
  store.updateRecord(store.selectedRecord.id, {
    strikePrice: editForm.strikePrice,
    iv: editForm.iv / 100,
    volume: editForm.volume,
    openInterest: editForm.openInterest,
    status: editForm.status,
    statusFlow: [...store.selectedRecord.statusFlow, 'published']
  })
  showEditModal.value = false
}
</script>

<style scoped>
.panel {
  min-width: 0;
}

.iv-high { color: var(--accent-red); font-weight: 600; }
.iv-low { color: var(--accent-yellow); font-weight: 600; }

.selected {
  background: rgba(59, 130, 246, 0.2) !important;
}

.empty-cell {
  text-align: center;
  color: var(--text-secondary);
  padding: 20px;
  font-size: 12px;
}

.btn-xs {
  padding: 2px 8px;
  font-size: 11px;
}

.detail-content {
  font-size: 12px;
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border-color);
}

.detail-header h5 {
  font-size: 14px;
  margin: 0;
}

.detail-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 12px;
}

.detail-item {
  display: flex;
  justify-content: space-between;
}

.detail-item.full {
  grid-column: 1 / -1;
}

.detail-item .label {
  color: var(--text-secondary);
}

.detail-item .value {
  font-weight: 500;
}

.detail-item .value.highlight {
  color: var(--accent-blue);
}

.detail-item .value.danger {
  color: var(--accent-red);
}

.anomaly-reasons {
  background: rgba(239, 68, 68, 0.1);
  border-radius: 4px;
  padding: 8px;
  margin-bottom: 12px;
}

.anomaly-reasons h6 {
  margin: 0 0 6px 0;
  font-size: 11px;
  color: var(--accent-red);
}

.anomaly-reasons ul {
  margin: 0;
  padding-left: 16px;
  font-size: 11px;
  color: var(--text-secondary);
}

.status-flow {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 0;
  margin-bottom: 12px;
  font-size: 11px;
  flex-wrap: wrap;
}

.status-flow .label {
  color: var(--text-secondary);
  margin-right: 4px;
}

.detail-actions {
  display: flex;
  gap: 6px;
}

.detail-actions .btn {
  flex: 1;
  padding: 6px;
  font-size: 12px;
}

.history-list {
  font-size: 11px;
}

.history-item {
  display: flex;
  gap: 8px;
  padding: 4px 0;
  border-bottom: 1px solid var(--border-color);
}

.history-time {
  color: var(--text-secondary);
  min-width: 60px;
}

.history-action {
  font-weight: 500;
  min-width: 60px;
}

.history-action.add { color: var(--accent-green); }
.history-action.update { color: var(--accent-blue); }
.history-action.revoke { color: var(--accent-red); }
.history-action.import { color: var(--accent-purple); }
.history-action.export { color: var(--accent-yellow); }
.history-action.init { color: var(--text-secondary); }

.history-detail {
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 20px;
  width: 380px;
  max-width: 90vw;
}

.modal h3 {
  margin-bottom: 16px;
  font-size: 16px;
}
</style>
