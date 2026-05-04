<template>
  <div class="risk">
    <div class="page-header">
      <h2 class="page-title">风险预警</h2>
      <div class="action-bar">
        <el-select v-model="selectedTradingDayId" placeholder="选择交易日" style="width: 200px" @change="loadAlerts">
          <el-option
            v-for="day in tradingDays"
            :key="day.id"
            :label="day.date"
            :value="day.id"
          />
        </el-select>
        <el-button type="primary" @click="runRiskCheck">
          <el-icon><Warning /></el-icon>
          风险检查
        </el-button>
        <el-button @click="loadAlerts">
          <el-icon><Refresh /></el-icon>
          刷新
        </el-button>
      </div>
    </div>

    <div class="position-summary">
      <el-card>
        <div class="position-summary-item">
          <div class="position-summary-label">活跃预警</div>
          <div class="position-summary-value" style="color: #f56c6c">{{ activeCount }}</div>
        </div>
      </el-card>
      <el-card>
        <div class="position-summary-item">
          <div class="position-summary-label">已确认</div>
          <div class="position-summary-value" style="color: #e6a23c">{{ acknowledgedCount }}</div>
        </div>
      </el-card>
      <el-card>
        <div class="position-summary-item">
          <div class="position-summary-label">已解决</div>
          <div class="position-summary-value" style="color: #67c23a">{{ resolvedCount }}</div>
        </div>
      </el-card>
      <el-card>
        <div class="position-summary-item">
          <div class="position-summary-label">严重级别</div>
          <div class="position-summary-value" style="color: #f56c6c">{{ criticalCount }}</div>
        </div>
      </el-card>
      <el-card>
        <div class="position-summary-item">
          <div class="position-summary-label">高危级别</div>
          <div class="position-summary-value" style="color: #e6a23c">{{ dangerCount }}</div>
        </div>
      </el-card>
      <el-card>
        <div class="position-summary-item">
          <div class="position-summary-label">预警级别</div>
          <div class="position-summary-value" style="color: #409eff">{{ warningCount }}</div>
        </div>
      </el-card>
    </div>

    <div class="search-bar">
      <el-select v-model="filterStatus" placeholder="预警状态" clearable style="width: 150px" @change="loadAlerts">
        <el-option label="活跃" value="active" />
        <el-option label="已确认" value="acknowledged" />
        <el-option label="已解决" value="resolved" />
        <el-option label="已忽略" value="ignored" />
      </el-select>
      <el-select v-model="filterSeverity" placeholder="严重程度" clearable style="width: 150px" @change="loadAlerts">
        <el-option label="提示" value="info" />
        <el-option label="警告" value="warning" />
        <el-option label="危险" value="danger" />
        <el-option label="严重" value="critical" />
      </el-select>
      <el-select v-model="filterAlertType" placeholder="预警类型" clearable style="width: 180px" @change="loadAlerts">
        <el-option label="仓位超限" value="over_position" />
        <el-option label="连续亏损" value="continuous_loss" />
        <el-option label="止损未执行" value="stop_loss_not_executed" />
        <el-option label="追高买入" value="chase_high_buy" />
        <el-option label="回撤超限" value="max_drawdown_exceed" />
        <el-option label="单票超配" value="single_stock_over_weight" />
        <el-option label="交易频繁" value="frequent_trading" />
      </el-select>
    </div>

    <el-card>
      <el-table :data="alerts" style="width: 100%" v-loading="loading">
        <el-table-column prop="severity" label="级别" width="100">
          <template #default="{ row }">
            <el-tag :type="getSeverityTagType(row.severity)" size="small">
              {{ getSeverityName(row.severity) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="alert_type" label="类型" width="140">
          <template #default="{ row }">
            {{ getAlertTypeName(row.alert_type) }}
          </template>
        </el-table-column>
        <el-table-column prop="symbol" label="标的" width="100">
          <template #default="{ row }">
            {{ row.symbol || '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="title" label="标题" width="200" show-overflow-tooltip />
        <el-table-column prop="message" label="详情" min-width="200" show-overflow-tooltip />
        <el-table-column label="触发值/阈值" width="180">
          <template #default="{ row }">
            <span v-if="row.trigger_value !== null && row.trigger_value !== undefined">
              {{ formatValue(row.trigger_value, row.unit) }}
              <span v-if="row.threshold_value !== null && row.threshold_value !== undefined">
                / {{ formatValue(row.threshold_value, row.unit) }}
              </span>
            </span>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusTagType(row.status)" size="small">
              {{ getStatusName(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="触发时间" width="160">
          <template #default="{ row }">
            {{ formatTime(row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <div class="table-actions">
              <el-button 
                text 
                type="primary" 
                size="small" 
                @click="acknowledgeAlert(row)"
                :disabled="row.status !== 'active'"
              >
                确认
              </el-button>
              <el-button 
                text 
                type="success" 
                size="small" 
                @click="openResolveDialog(row)"
                :disabled="row.status === 'resolved'"
              >
                解决
              </el-button>
              <el-button 
                text 
                type="info" 
                size="small" 
                @click="viewDetail(row)"
              >
                详情
              </el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="alerts.length === 0 && !loading" description="暂无风险预警" />
    </el-card>

    <el-dialog v-model="detailDialogVisible" title="预警详情" width="600px">
      <el-descriptions :column="2" border v-if="selectedAlert">
        <el-descriptions-item label="预警级别">
          <el-tag :type="getSeverityTagType(selectedAlert.severity)" size="small">
            {{ getSeverityName(selectedAlert.severity) }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="预警类型">{{ getAlertTypeName(selectedAlert.alert_type) }}</el-descriptions-item>
        <el-descriptions-item label="标的代码">{{ selectedAlert.symbol || '-' }}</el-descriptions-item>
        <el-descriptions-item label="当前状态">
          <el-tag :type="getStatusTagType(selectedAlert.status)" size="small">
            {{ getStatusName(selectedAlert.status) }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="触发值">{{ formatValue(selectedAlert.trigger_value, selectedAlert.unit) }}</el-descriptions-item>
        <el-descriptions-item label="阈值">{{ formatValue(selectedAlert.threshold_value, selectedAlert.unit) }}</el-descriptions-item>
        <el-descriptions-item label="预警标题" :span="2">{{ selectedAlert.title }}</el-descriptions-item>
        <el-descriptions-item label="预警详情" :span="2">{{ selectedAlert.message }}</el-descriptions-item>
        <el-descriptions-item label="确认人" :span="2">{{ selectedAlert.acknowledged_by || '-' }}</el-descriptions-item>
        <el-descriptions-item label="确认时间" :span="2">{{ formatTime(selectedAlert.acknowledged_at) }}</el-descriptions-item>
        <el-descriptions-item label="解决说明" :span="2">{{ selectedAlert.resolution_note || '-' }}</el-descriptions-item>
        <el-descriptions-item label="创建时间">{{ formatTime(selectedAlert.created_at) }}</el-descriptions-item>
        <el-descriptions-item label="更新时间">{{ formatTime(selectedAlert.updated_at) }}</el-descriptions-item>
      </el-descriptions>
    </el-dialog>

    <el-dialog v-model="resolveDialogVisible" title="处理预警" width="500px">
      <el-form :model="resolveForm" :rules="resolveRules" ref="resolveFormRef" label-width="100px">
        <el-form-item label="预警信息">
          <el-card>
            <div style="margin-bottom: 10px">
              <strong>{{ selectedAlert?.title }}</strong>
            </div>
            <div style="font-size: 13px; color: #606266">
              {{ selectedAlert?.message }}
            </div>
          </el-card>
        </el-form-item>
        <el-form-item label="处理说明" prop="resolution_note">
          <el-input 
            v-model="resolveForm.resolution_note" 
            type="textarea" 
            :rows="4" 
            placeholder="请输入处理说明..."
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="resolveDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitResolve">确认处理</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { riskApi, tradingDayApi } from '@/api'
import { ElMessage, ElMessageBox } from 'element-plus'
import dayjs from 'dayjs'

const loading = ref(false)
const tradingDays = ref([])
const selectedTradingDayId = ref(null)
const filterStatus = ref('')
const filterSeverity = ref('')
const filterAlertType = ref('')
const alerts = ref([])

const detailDialogVisible = ref(false)
const selectedAlert = ref(null)

const resolveDialogVisible = ref(false)
const resolveFormRef = ref(null)
const resolveForm = ref({
  resolution_note: ''
})
const resolveRules = {
  resolution_note: [{ required: true, message: '请输入处理说明', trigger: 'blur' }]
}

const activeCount = computed(() => alerts.value.filter(a => a.status === 'active').length)
const acknowledgedCount = computed(() => alerts.value.filter(a => a.status === 'acknowledged').length)
const resolvedCount = computed(() => alerts.value.filter(a => a.status === 'resolved').length)
const criticalCount = computed(() => alerts.value.filter(a => a.severity === 'critical').length)
const dangerCount = computed(() => alerts.value.filter(a => a.severity === 'danger').length)
const warningCount = computed(() => alerts.value.filter(a => a.severity === 'warning').length)

function formatValue(value, unit) {
  if (value === null || value === undefined) return '-'
  const formatted = typeof value === 'number' && !Number.isInteger(value) 
    ? value.toFixed(2) 
    : value
  return unit ? `${formatted}${unit}` : formatted
}

function formatTime(value) {
  if (!value) return '-'
  return dayjs(value).format('YYYY-MM-DD HH:mm:ss')
}

function getSeverityTagType(severity) {
  const map = {
    info: 'info',
    warning: 'warning',
    danger: 'danger',
    critical: 'danger'
  }
  return map[severity] || 'info'
}

function getSeverityName(severity) {
  const map = {
    info: '提示',
    warning: '警告',
    danger: '危险',
    critical: '严重'
  }
  return map[severity] || severity
}

function getAlertTypeName(type) {
  const map = {
    over_position: '仓位超限',
    continuous_loss: '连续亏损',
    stop_loss_not_executed: '止损未执行',
    chase_high_buy: '追高买入',
    max_drawdown_exceed: '回撤超限',
    single_stock_over_weight: '单票超配',
    frequent_trading: '交易频繁'
  }
  return map[type] || type
}

function getStatusTagType(status) {
  const map = {
    active: 'danger',
    acknowledged: 'warning',
    resolved: 'success',
    ignored: 'info'
  }
  return map[status] || 'info'
}

function getStatusName(status) {
  const map = {
    active: '活跃',
    acknowledged: '已确认',
    resolved: '已解决',
    ignored: '已忽略'
  }
  return map[status] || status
}

async function loadTradingDays() {
  try {
    const res = await tradingDayApi.list({ pageSize: 50 })
    tradingDays.value = res.data?.list || []
    if (tradingDays.value.length > 0) {
      const active = tradingDays.value.find(d => d.status === 'active')
      selectedTradingDayId.value = active?.id || tradingDays.value[0].id
    }
  } catch (error) {
    console.error('加载交易日失败:', error)
  }
}

async function loadAlerts() {
  if (!selectedTradingDayId.value) return
  try {
    loading.value = true
    const res = await riskApi.getAlerts({
      trading_day_id: selectedTradingDayId.value,
      status: filterStatus.value || undefined,
      severity: filterSeverity.value || undefined,
      alert_type: filterAlertType.value || undefined,
      pageSize: 200
    })
    alerts.value = res.data?.list || []
  } catch (error) {
    console.error('加载预警失败:', error)
  } finally {
    loading.value = false
  }
}

async function runRiskCheck() {
  if (!selectedTradingDayId.value) {
    ElMessage.warning('请先选择交易日')
    return
  }
  
  try {
    loading.value = true
    const res = await riskApi.runChecks(selectedTradingDayId.value)
    ElMessage.success(`风险检查完成，发现 ${res.data?.count || 0} 个新预警`)
    await loadAlerts()
  } catch (error) {
    console.error('风险检查失败:', error)
  } finally {
    loading.value = false
  }
}

function viewDetail(alert) {
  selectedAlert.value = alert
  detailDialogVisible.value = true
}

async function acknowledgeAlert(alert) {
  ElMessageBox.confirm(
    '确定要确认该预警吗？',
    '确认预警',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    }
  ).then(async () => {
    try {
      await riskApi.acknowledgeAlert(alert.id, { acknowledged_by: '模拟交易者' })
      ElMessage.success('已确认')
      await loadAlerts()
    } catch (error) {
      console.error('确认失败:', error)
    }
  }).catch(() => {})
}

function openResolveDialog(alert) {
  selectedAlert.value = alert
  resolveForm.value = {
    resolution_note: ''
  }
  resolveDialogVisible.value = true
}

async function submitResolve() {
  if (!resolveFormRef.value) return
  await resolveFormRef.value.validate(async (valid) => {
    if (valid) {
      try {
        await riskApi.resolveAlert(selectedAlert.value.id, resolveForm.value)
        ElMessage.success('处理完成')
        resolveDialogVisible.value = false
        await loadAlerts()
      } catch (error) {
        console.error('处理失败:', error)
      }
    }
  })
}

onMounted(async () => {
  await loadTradingDays()
  if (selectedTradingDayId.value) {
    await loadAlerts()
  }
})
</script>

<style scoped>
.risk {
  height: 100%;
}
</style>
