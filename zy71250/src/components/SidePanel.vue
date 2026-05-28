<template>
  <div class="sidebar">
    <div class="sidebar-header">
      <h1>期权波动率曲面</h1>
      <p>3D可视化 · 异常检测 · 报告导出</p>
    </div>
    
    <div class="sidebar-content">
      <div class="panel-section">
        <h3>数据概览</h3>
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-value">{{ store.stats.total }}</div>
            <div class="stat-label">合约总数</div>
          </div>
          <div class="stat-card">
            <div class="stat-value normal">{{ store.stats.normal }}</div>
            <div class="stat-label">正常</div>
          </div>
          <div class="stat-card">
            <div class="stat-value warning">{{ store.stats.warning }}</div>
            <div class="stat-label">警告</div>
          </div>
          <div class="stat-card">
            <div class="stat-value danger">{{ store.stats.anomaly }}</div>
            <div class="stat-label">异常</div>
          </div>
        </div>
        <div class="stat-row">
          <span class="stat-label">平均IV:</span>
          <span class="stat-value-sm">{{ (store.stats.avgIv * 100).toFixed(2) }}%</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">总成交量:</span>
          <span class="stat-value-sm">{{ store.stats.totalVolume.toLocaleString() }}</span>
        </div>
      </div>
      
      <div class="panel-section">
        <h3>数据筛选</h3>
        <label>状态</label>
        <select v-model="localFilters.status" @change="applyFilter('status', localFilters.status)">
          <option value="all">全部</option>
          <option value="normal">正常</option>
          <option value="warning">警告</option>
          <option value="anomaly">异常</option>
          <option value="pending">待处理</option>
        </select>
        
        <div class="form-row">
          <div>
            <label>最小到期(天)</label>
            <input type="number" v-model.number="localFilters.minExpiry" 
                   @change="applyFilter('minExpiry', localFilters.minExpiry || null)"
                   placeholder="无限制" />
          </div>
          <div>
            <label>最大到期(天)</label>
            <input type="number" v-model.number="localFilters.maxExpiry"
                   @change="applyFilter('maxExpiry', localFilters.maxExpiry || null)"
                   placeholder="无限制" />
          </div>
        </div>
        
        <div class="form-row">
          <div>
            <label>最小行权价</label>
            <input type="number" step="0.1" v-model.number="localFilters.minStrike"
                   @change="applyFilter('minStrike', localFilters.minStrike || null)"
                   placeholder="无限制" />
          </div>
          <div>
            <label>最大行权价</label>
            <input type="number" step="0.1" v-model.number="localFilters.maxStrike"
                   @change="applyFilter('maxStrike', localFilters.maxStrike || null)"
                   placeholder="无限制" />
          </div>
        </div>
        
        <div class="check-row">
          <input type="checkbox" id="showInterpolated" v-model="localFilters.showInterpolated"
                 @change="applyFilter('showInterpolated', localFilters.showInterpolated)" />
          <label for="showInterpolated">显示插值点</label>
        </div>
        
        <div class="btn-group">
          <button class="btn btn-secondary" @click="store.resetFilters(); resetLocalFilters()">重置</button>
        </div>
      </div>
      
      <div class="panel-section">
        <h3>切片查看</h3>
        <div class="btn-group">
          <button :class="['btn', localSlice.type === 'expiry' ? 'btn-primary' : 'btn-secondary']"
                  @click="setSliceType('expiry')">按到期</button>
          <button :class="['btn', localSlice.type === 'strike' ? 'btn-primary' : 'btn-secondary']"
                  @click="setSliceType('strike')">按行权</button>
        </div>
        
        <div v-if="store.surfaceData">
          <label v-if="localSlice.type === 'expiry'">到期日 ({{ localSlice.value }}天)</label>
          <input v-if="localSlice.type === 'expiry'" type="range"
                 :min="store.surfaceData.minExpiry" :max="store.surfaceData.maxExpiry"
                 v-model.number="localSlice.value" @input="updateSlice" />
          
          <label v-if="localSlice.type === 'strike'">行权价 ({{ localSlice.value.toFixed(2) }})</label>
          <input v-if="localSlice.type === 'strike'" type="range"
                 :min="store.surfaceData.minStrike" :max="store.surfaceData.maxStrike" step="0.1"
                 v-model.number="localSlice.value" @input="updateSlice" />
        </div>
        
        <div class="btn-group">
          <button :class="['btn', localSlice.enabled ? 'btn-success' : 'btn-secondary']"
                  @click="toggleSlice">
            {{ localSlice.enabled ? '关闭切片' : '启用切片' }}
          </button>
        </div>
      </div>
      
      <div class="panel-section">
        <h3>数据操作</h3>
        <div class="btn-group">
          <button class="btn btn-primary" @click="showAddModal = true">补录合约</button>
          <button class="btn btn-secondary" @click="triggerImport">批量导入</button>
        </div>
        <div class="btn-group">
          <button class="btn btn-warning" @click="store.runFullValidation">重新校验</button>
          <button class="btn btn-secondary" @click="store.initMockData">加载示例</button>
        </div>
        
        <input type="file" ref="fileInput" accept=".json,.csv" @change="handleImport" style="display:none" />
      </div>
      
      <div class="panel-section">
        <h3>校验状态</h3>
        <div v-if="store.verificationResults">
          <div class="check-row">
            <span :class="['status-dot', store.verificationResults.interpolationCheck.passed ? 'ok' : 'error']"></span>
            <span class="status-text">稀疏插值检查</span>
            <span :class="store.verificationResults.interpolationCheck.passed ? 'ok-text' : 'error-text'">
              {{ store.verificationResults.interpolationCheck.passed ? '通过' : '失败' }}
            </span>
          </div>
          <div class="check-row">
            <span :class="['status-dot', store.verificationResults.expiryOrderCheck.passed ? 'ok' : 'error']"></span>
            <span class="status-text">到期顺序检查</span>
            <span :class="store.verificationResults.expiryOrderCheck.passed ? 'ok-text' : 'error-text'">
              {{ store.verificationResults.expiryOrderCheck.passed ? '通过' : '失败' }}
            </span>
          </div>
          <div class="check-row">
            <span :class="['status-dot', store.verificationResults.anomalyOcclusionCheck.passed ? 'ok' : 'warn']"></span>
            <span class="status-text">异常遮挡检查</span>
            <span :class="store.verificationResults.anomalyOcclusionCheck.passed ? 'ok-text' : 'warn-text'">
              {{ store.verificationResults.anomalyOcclusionCheck.passed ? '通过' : '警告' }}
            </span>
          </div>
          <div class="check-row">
            <span :class="['status-dot', store.verificationResults.statusFlowCheck.passed ? 'ok' : 'error']"></span>
            <span class="status-text">状态流转检查</span>
            <span :class="store.verificationResults.statusFlowCheck.passed ? 'ok-text' : 'error-text'">
              {{ store.verificationResults.statusFlowCheck.passed ? '通过' : '失败' }}
            </span>
          </div>
        </div>
        <div v-else class="empty-text">暂无校验结果</div>
      </div>
    </div>
    
    <div v-if="showAddModal" class="modal-overlay" @click.self="showAddModal = false">
      <div class="modal">
        <h3>补录合约</h3>
        <div class="form-row">
          <div>
            <label>合约代码</label>
            <input v-model="newRecord.contractCode" placeholder="如 HO_4.0_2026-06-30" />
          </div>
          <div>
            <label>标的</label>
            <input v-model="newRecord.underlying" placeholder="如 510300" />
          </div>
        </div>
        <div class="form-row">
          <div>
            <label>行权价</label>
            <input type="number" step="0.1" v-model.number="newRecord.strikePrice" />
          </div>
          <div>
            <label>到期日</label>
            <input type="date" v-model="newRecord.expiryDate" />
          </div>
        </div>
        <div class="form-row">
          <div>
            <label>隐含波动率(%)</label>
            <input type="number" step="0.1" v-model.number="newRecord.iv" />
          </div>
          <div>
            <label>成交量</label>
            <input type="number" v-model.number="newRecord.volume" />
          </div>
        </div>
        <div class="form-row">
          <div>
            <label>持仓量</label>
            <input type="number" v-model.number="newRecord.openInterest" />
          </div>
          <div>
            <label>插值生成</label>
            <select v-model="newRecord.isInterpolated">
              <option :value="false">实际数据</option>
              <option :value="true">插值生成</option>
            </select>
          </div>
        </div>
        <div class="btn-group" style="margin-top: 12px;">
          <button class="btn btn-secondary" @click="showAddModal = false">取消</button>
          <button class="btn btn-primary" @click="addRecord">确认添加</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, watch } from 'vue'
import { useOptionStore } from '../stores/optionStore.js'
import { StatusFlow } from '../types/option.js'

const emit = defineEmits(['takeScreenshot', 'exportReport'])

const store = useOptionStore()

const showAddModal = ref(false)
const fileInput = ref(null)

const localFilters = reactive({
  status: 'all',
  minExpiry: null,
  maxExpiry: null,
  minStrike: null,
  maxStrike: null,
  showInterpolated: true
})

const localSlice = reactive({
  type: 'expiry',
  value: 30,
  enabled: false
})

const newRecord = reactive({
  contractCode: '',
  underlying: '510300',
  strikePrice: 4.0,
  expiryDate: '',
  iv: 20,
  volume: 0,
  openInterest: 0,
  isInterpolated: false
})

function resetLocalFilters() {
  localFilters.status = 'all'
  localFilters.minExpiry = null
  localFilters.maxExpiry = null
  localFilters.minStrike = null
  localFilters.maxStrike = null
  localFilters.showInterpolated = true
}

function applyFilter(key, value) {
  store.setFilter(key, value)
}

function setSliceType(type) {
  localSlice.type = type
  if (store.surfaceData) {
    localSlice.value = type === 'expiry' 
      ? Math.round((store.surfaceData.minExpiry + store.surfaceData.maxExpiry) / 2)
      : (store.surfaceData.minStrike + store.surfaceData.maxStrike) / 2
  }
  updateSlice()
}

function updateSlice() {
  if (localSlice.enabled) {
    store.setSliceView(true, localSlice.type, localSlice.value)
  }
}

function toggleSlice() {
  localSlice.enabled = !localSlice.enabled
  store.setSliceView(localSlice.enabled, localSlice.type, localSlice.value)
}

function triggerImport() {
  fileInput.value.click()
}

function handleImport(event) {
  const file = event.target.files[0]
  if (!file) return
  
  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const content = e.target.result
      if (file.name.endsWith('.json')) {
        const data = JSON.parse(content)
        const records = Array.isArray(data) ? data : data.records || []
        store.bulkImport(records)
      } else if (file.name.endsWith('.csv')) {
        const lines = content.split('\n').filter(l => l.trim())
        const headers = lines[0].split(',')
        const records = []
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',')
          const record = {}
          headers.forEach((h, idx) => {
            record[h.trim()] = values[idx]?.trim()
          })
          if (record['合约代码']) {
            records.push({
              contractCode: record['合约代码'],
              underlying: record['标的'],
              strikePrice: parseFloat(record['行权价']),
              expiryDate: record['到期日'],
              expiryDays: parseInt(record['剩余天数']),
              iv: parseFloat(record['IV']),
              volume: parseInt(record['成交量']) || 0,
              openInterest: parseInt(record['持仓量']) || 0
            })
          }
        }
        store.bulkImport(records)
      }
    } catch (err) {
      console.error('Import failed:', err)
      alert('导入失败: ' + err.message)
    }
  }
  reader.readAsText(file)
  event.target.value = ''
}

function addRecord() {
  if (!newRecord.contractCode || !newRecord.expiryDate) {
    alert('请填写合约代码和到期日')
    return
  }
  
  const expiry = new Date(newRecord.expiryDate)
  const now = new Date()
  const expiryDays = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24))
  
  store.addRecord({
    contractCode: newRecord.contractCode,
    underlying: newRecord.underlying,
    strikePrice: newRecord.strikePrice,
    expiryDate: newRecord.expiryDate,
    expiryDays,
    iv: newRecord.iv / 100,
    volume: newRecord.volume,
    openInterest: newRecord.openInterest,
    isInterpolated: newRecord.isInterpolated
  })
  
  showAddModal.value = false
  Object.assign(newRecord, {
    contractCode: '',
    underlying: '510300',
    strikePrice: 4.0,
    expiryDate: '',
    iv: 20,
    volume: 0,
    openInterest: 0,
    isInterpolated: false
  })
}

watch(() => store.surfaceData, (sd) => {
  if (sd && localSlice.value === 30) {
    localSlice.value = Math.round((sd.minExpiry + sd.maxExpiry) / 2)
  }
}, { immediate: true })
</script>

<style scoped>
.stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 12px;
}

.stat-card {
  background: var(--bg-tertiary);
  border-radius: 6px;
  padding: 10px;
  text-align: center;
}

.stat-value {
  font-size: 22px;
  font-weight: 700;
  color: var(--text-primary);
}

.stat-value.normal { color: var(--accent-green); }
.stat-value.warning { color: var(--accent-yellow); }
.stat-value.danger { color: var(--accent-red); }

.stat-label {
  font-size: 11px;
  color: var(--text-secondary);
  margin-top: 2px;
}

.stat-row {
  display: flex;
  justify-content: space-between;
  padding: 4px 0;
  font-size: 12px;
}

.stat-value-sm {
  font-weight: 600;
  color: var(--accent-blue);
}

.ok-text { color: var(--accent-green); font-weight: 500; }
.warn-text { color: var(--accent-yellow); font-weight: 500; }
.error-text { color: var(--accent-red); font-weight: 500; }

.empty-text {
  text-align: center;
  color: var(--text-secondary);
  font-size: 12px;
  padding: 12px;
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
  width: 420px;
  max-width: 90vw;
}

.modal h3 {
  margin-bottom: 16px;
  font-size: 16px;
}

input[type="range"] {
  width: 100%;
  height: 4px;
  margin: 8px 0 16px 0;
  padding: 0;
  background: var(--bg-tertiary);
  border-radius: 2px;
  -webkit-appearance: none;
}

input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 14px;
  height: 14px;
  background: var(--accent-blue);
  border-radius: 50%;
  cursor: pointer;
}
</style>
