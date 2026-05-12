<template>
  <div class="dashboard">
    <el-container style="height: 100vh">
      <el-header class="header">
        <div class="header-left">
          <h1>
            <el-icon :size="28" color="#409eff"><Van /></el-icon>
            停车场月卡异常台
          </h1>
        </div>
        <div class="header-right">
          <el-tag type="danger" v-if="openAnomaliesCount > 0">
            {{ openAnomaliesCount }} 个待处理异常
          </el-tag>
          <el-button type="primary" @click="refreshAll" :loading="loading">
            <el-icon><Refresh /></el-icon>
            刷新数据
          </el-button>
        </div>
      </el-header>
      
      <el-container>
        <el-main class="main-content">
          <el-row :gutter="16" class="stats-row">
            <el-col :span="6">
              <el-card class="stat-card">
                <div class="stat-content">
                  <div class="stat-icon total">
                    <el-icon :size="24"><CreditCard /></el-icon>
                  </div>
                  <div class="stat-info">
                    <div class="stat-value">{{ statistics.totalCards || 0 }}</div>
                    <div class="stat-label">月卡总数</div>
                  </div>
                </div>
              </el-card>
            </el-col>
            <el-col :span="6">
              <el-card class="stat-card">
                <div class="stat-content">
                  <div class="stat-icon active">
                    <el-icon :size="24"><SuccessFilled /></el-icon>
                  </div>
                  <div class="stat-info">
                    <div class="stat-value">{{ statistics.activeCards || 0 }}</div>
                    <div class="stat-label">有效月卡</div>
                  </div>
                </div>
              </el-card>
            </el-col>
            <el-col :span="6">
              <el-card class="stat-card">
                <div class="stat-content">
                  <div class="stat-icon warning">
                    <el-icon :size="24"><Warning /></el-icon>
                  </div>
                  <div class="stat-info">
                    <div class="stat-value">{{ statistics.pendingSync || 0 }}</div>
                    <div class="stat-label">待同步</div>
                  </div>
                </div>
              </el-card>
            </el-col>
            <el-col :span="6">
              <el-card class="stat-card">
                <div class="stat-content">
                  <div class="stat-icon danger">
                    <el-icon :size="24"><CircleClose /></el-icon>
                  </div>
                  <div class="stat-info">
                    <div class="stat-value">{{ statistics.openAnomalies || 0 }}</div>
                    <div class="stat-label">待处理异常</div>
                  </div>
                </div>
              </el-card>
            </el-col>
          </el-row>

          <el-row :gutter="16" style="margin-top: 16px; flex: 1">
            <el-col :span="14">
              <el-card class="list-card">
                <template #header>
                  <div class="card-header">
                    <span><el-icon><Warning /></el-icon> 异常队列</span>
                    <el-select v-model="anomalyFilter" size="small" placeholder="筛选" style="width: 120px" @change="fetchAnomalies">
                      <el-option label="全部" value="" />
                      <el-option label="待处理" value="open" />
                      <el-option label="处理中" value="processing" />
                      <el-option label="已解决" value="resolved" />
                    </el-select>
                  </div>
                </template>
                <el-table 
                  :data="anomalies" 
                  style="width: 100%" 
                  @row-click="handleAnomalyClick"
                  highlight-current-row
                  size="small"
                >
                  <el-table-column prop="priority" label="优先级" width="80">
                    <template #default="{ row }">
                      <el-tag :type="getPriorityType(row.priority)" size="small">
                        {{ getPriorityLabel(row.priority) }}
                      </el-tag>
                    </template>
                  </el-table-column>
                  <el-table-column prop="type" label="类型" width="140">
                    <template #default="{ row }">
                      <el-tag :type="getAnomalyTypeColor(row.type)" size="small">
                        {{ getAnomalyTypeLabel(row.type) }}
                      </el-tag>
                    </template>
                  </el-table-column>
                  <el-table-column prop="plateNumber" label="车牌号" width="100" />
                  <el-table-column prop="description" label="描述" show-overflow-tooltip />
                  <el-table-column prop="status" label="状态" width="90">
                    <template #default="{ row }">
                      <el-tag :type="getStatusType(row.status)" size="small">
                        {{ getStatusLabel(row.status) }}
                      </el-tag>
                    </template>
                  </el-table-column>
                  <el-table-column label="操作" width="100" fixed="right">
                    <template #default="{ row }">
                      <el-button 
                        type="primary" 
                        size="small" 
                        link
                        @click.stop="handleProcessAnomaly(row)"
                        :disabled="row.status === 'resolved' || row.status === 'ignored'"
                      >
                        处理
                      </el-button>
                    </template>
                  </el-table-column>
                </el-table>
              </el-card>
            </el-col>
            
            <el-col :span="10">
              <el-card class="detail-card" v-if="selectedAnomaly">
                <template #header>
                  <div class="card-header">
                    <span><el-icon><Document /></el-icon> 异常详情</span>
                  </div>
                </template>
                
                <el-descriptions :column="1" border size="small">
                  <el-descriptions-item label="异常类型">
                    <el-tag :type="getAnomalyTypeColor(selectedAnomaly.type)" size="small">
                      {{ getAnomalyTypeLabel(selectedAnomaly.type) }}
                    </el-tag>
                  </el-descriptions-item>
                  <el-descriptions-item label="车牌号">
                    <strong>{{ selectedAnomaly.plateNumber || '-' }}</strong>
                  </el-descriptions-item>
                  <el-descriptions-item label="描述">
                    {{ selectedAnomaly.description }}
                  </el-descriptions-item>
                  <el-descriptions-item label="状态">
                    <el-tag :type="getStatusType(selectedAnomaly.status)" size="small">
                      {{ getStatusLabel(selectedAnomaly.status) }}
                    </el-tag>
                  </el-descriptions-item>
                  <el-descriptions-item label="创建时间">
                    {{ formatTime(selectedAnomaly.createdAt) }}
                  </el-descriptions-item>
                </el-descriptions>

                <div class="action-buttons" v-if="selectedAnomaly.status !== 'resolved' && selectedAnomaly.status !== 'ignored'">
                  <el-button 
                    type="primary" 
                    @click="handleSyncCard"
                    :loading="loading"
                    v-if="selectedAnomaly.cardId"
                  >
                    <el-icon><RefreshRight /></el-icon>
                    重试同步
                  </el-button>
                  <el-button @click="showResolveDialog = true">标记解决</el-button>
                  <el-button type="info" @click="showIgnoreDialog = true">忽略</el-button>
                </div>

                <div class="history-section" v-if="anomalyHistory.length > 0">
                  <h4>处理历史</h4>
                  <el-timeline>
                    <el-timeline-item 
                      v-for="item in anomalyHistory" 
                      :key="item.id"
                      :timestamp="formatTime(item.createdAt)"
                    >
                      <p><strong>{{ item.operator }}</strong> 执行了 {{ getActionLabel(item.action) }}</p>
                      <p style="color: #666; font-size: 12px">{{ item.result }}</p>
                    </el-timeline-item>
                  </el-timeline>
                </div>
              </el-card>

              <el-card class="detail-card empty-card" v-else>
                <el-empty description="点击左侧异常查看详情" />
              </el-card>
            </el-col>
          </el-row>

          <el-row :gutter="16" style="margin-top: 16px">
            <el-col :span="24">
              <el-card class="list-card">
                <template #header>
                  <div class="card-header">
                    <span><el-icon><CreditCard /></el-icon> 月卡列表</span>
                    <el-input 
                      v-model="plateSearch" 
                      placeholder="搜索车牌" 
                      size="small" 
                      style="width: 180px"
                      clearable
                      @input="fetchCards"
                    >
                      <template #prefix>
                        <el-icon><Search /></el-icon>
                      </template>
                    </el-input>
                  </div>
                </template>
                <el-table :data="cards" style="width: 100%" size="small" @row-click="handleCardClick">
                  <el-table-column prop="cardNo" label="卡号" width="100" />
                  <el-table-column prop="plateNumber" label="车牌号" width="100" />
                  <el-table-column prop="ownerName" label="车主" width="80" />
                  <el-table-column prop="ownerPhone" label="电话" width="110" />
                  <el-table-column label="有效期" width="200">
                    <template #default="{ row }">
                      {{ row.startDate }} 至 {{ row.endDate }}
                    </template>
                  </el-table-column>
                  <el-table-column prop="status" label="卡状态" width="90">
                    <template #default="{ row }">
                      <el-tag :type="getCardStatusType(row.status)" size="small">
                        {{ getCardStatusLabel(row.status) }}
                      </el-tag>
                    </template>
                  </el-table-column>
                  <el-table-column prop="syncStatus" label="同步状态" width="90">
                    <template #default="{ row }">
                      <el-tag :type="getSyncStatusType(row.syncStatus)" size="small">
                        {{ getSyncStatusLabel(row.syncStatus) }}
                      </el-tag>
                    </template>
                  </el-table-column>
                  <el-table-column label="重试次数" width="80" align="center">
                    <template #default="{ row }">
                      {{ row.syncAttempts }}
                    </template>
                  </el-table-column>
                  <el-table-column label="操作" width="100" fixed="right">
                    <template #default="{ row }">
                      <el-button 
                        type="primary" 
                        size="small" 
                        link
                        @click.stop="handleSyncCardDirect(row)"
                        :disabled="row.syncStatus === 'success'"
                      >
                        同步
                      </el-button>
                    </template>
                  </el-table-column>
                </el-table>
              </el-card>
            </el-col>
          </el-row>
        </el-main>
      </el-container>
    </el-container>

    <el-dialog v-model="showResolveDialog" title="标记解决" width="500px">
      <el-form label-width="80px">
        <el-form-item label="处理结果">
          <el-input v-model="resolveResult" type="textarea" :rows="3" placeholder="请输入处理结果说明" />
        </el-form-item>
        <el-form-item label="操作人">
          <el-input v-model="operator" placeholder="请输入操作人姓名" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showResolveDialog = false">取消</el-button>
        <el-button type="primary" @click="confirmResolve">确认解决</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showIgnoreDialog" title="忽略异常" width="500px">
      <el-form label-width="80px">
        <el-form-item label="忽略原因">
          <el-input v-model="ignoreReason" type="textarea" :rows="3" placeholder="请输入忽略原因" />
        </el-form-item>
        <el-form-item label="操作人">
          <el-input v-model="operator" placeholder="请输入操作人姓名" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showIgnoreDialog = false">取消</el-button>
        <el-button type="primary" @click="confirmIgnore">确认忽略</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useParkingStore } from '../stores/parking'
import dayjs from 'dayjs'
import { ElMessage } from 'element-plus'

const store = useParkingStore()

const { 
  statistics, 
  anomalies, 
  cards, 
  selectedAnomaly, 
  anomalyHistory, 
  loading, 
  openAnomaliesCount,
  fetchStatistics, 
  fetchAnomalies, 
  fetchCards,
  fetchAnomalyHistory,
  doSyncCard,
  doProcessAnomaly
} = store

const anomalyFilter = ref('')
const plateSearch = ref('')
const showResolveDialog = ref(false)
const showIgnoreDialog = ref(false)
const resolveResult = ref('')
const ignoreReason = ref('')
const operator = ref('客服小王')

onMounted(() => {
  refreshAll()
})

async function refreshAll() {
  await Promise.all([
    fetchStatistics(),
    fetchAnomalies(),
    fetchCards()
  ])
}

function handleAnomalyClick(row: any) {
  store.selectedAnomaly = row
  fetchAnomalyHistory(row.id)
}

function handleCardClick(row: any) {
  console.log('选中卡片:', row)
}

async function handleProcessAnomaly(row: any) {
  store.selectedAnomaly = row
  fetchAnomalyHistory(row.id)
}

async function handleSyncCard() {
  if (!selectedAnomaly.value?.cardId) return
  
  const result = await doSyncCard(selectedAnomaly.value.cardId, true)
  if (result.success) {
    ElMessage.success('同步成功，异常已自动解决')
    fetchAnomalyHistory(selectedAnomaly.value.id)
  } else {
    ElMessage.error('同步失败: ' + result.message)
  }
}

async function handleSyncCardDirect(row: any) {
  const result = await doSyncCard(row.id, true)
  if (result.success) {
    ElMessage.success('同步成功')
  } else {
    ElMessage.error('同步失败: ' + result.message)
  }
}

async function confirmResolve() {
  if (!selectedAnomaly.value) return
  
  await doProcessAnomaly(selectedAnomaly.value.id, {
    action: 'resolve',
    operator: operator.value,
    resolution: resolveResult.value
  })
  
  ElMessage.success('已标记为解决')
  showResolveDialog.value = false
  resolveResult.value = ''
  fetchAnomalyHistory(selectedAnomaly.value.id)
}

async function confirmIgnore() {
  if (!selectedAnomaly.value) return
  
  await doProcessAnomaly(selectedAnomaly.value.id, {
    action: 'ignore',
    operator: operator.value,
    resolution: ignoreReason.value
  })
  
  ElMessage.success('已忽略该异常')
  showIgnoreDialog.value = false
  ignoreReason.value = ''
  fetchAnomalyHistory(selectedAnomaly.value.id)
}

function formatTime(time: string) {
  return dayjs(time).format('YYYY-MM-DD HH:mm:ss')
}

function getPriorityType(priority: string) {
  const map: Record<string, any> = {
    high: 'danger',
    medium: 'warning',
    low: 'info'
  }
  return map[priority] || 'info'
}

function getPriorityLabel(priority: string) {
  const map: Record<string, string> = {
    high: '高',
    medium: '中',
    low: '低'
  }
  return map[priority] || priority
}

function getAnomalyTypeLabel(type: string) {
  const map: Record<string, string> = {
    plate_not_synced: '新车牌未同步',
    refund_still_active: '退款后仍有效',
    blacklist_expired: '黑名单过期未恢复',
    multiple_cards_same_plate: '同一车牌多卡',
    sync_failed: '同步失败'
  }
  return map[type] || type
}

function getAnomalyTypeColor(type: string) {
  const map: Record<string, any> = {
    plate_not_synced: 'warning',
    refund_still_active: 'danger',
    blacklist_expired: 'warning',
    multiple_cards_same_plate: 'info',
    sync_failed: 'danger'
  }
  return map[type] || 'info'
}

function getStatusType(status: string) {
  const map: Record<string, any> = {
    open: 'danger',
    processing: 'warning',
    resolved: 'success',
    ignored: 'info'
  }
  return map[status] || 'info'
}

function getStatusLabel(status: string) {
  const map: Record<string, string> = {
    open: '待处理',
    processing: '处理中',
    resolved: '已解决',
    ignored: '已忽略'
  }
  return map[status] || status
}

function getCardStatusType(status: string) {
  const map: Record<string, any> = {
    active: 'success',
    expired: 'info',
    refunded: 'warning',
    blacklisted: 'danger'
  }
  return map[status] || 'info'
}

function getCardStatusLabel(status: string) {
  const map: Record<string, string> = {
    active: '有效',
    expired: '过期',
    refunded: '已退款',
    blacklisted: '黑名单'
  }
  return map[status] || status
}

function getSyncStatusType(status: string) {
  const map: Record<string, any> = {
    pending: 'warning',
    success: 'success',
    failed: 'danger'
  }
  return map[status] || 'info'
}

function getSyncStatusLabel(status: string) {
  const map: Record<string, string> = {
    pending: '待同步',
    success: '已同步',
    failed: '同步失败'
  }
  return map[status] || status
}

function getActionLabel(action: string) {
  const map: Record<string, string> = {
    resolve: '标记解决',
    ignore: '忽略异常',
    assign: '分配处理',
    auto_resolve: '自动解决'
  }
  return map[action] || action
}
</script>

<style scoped>
.dashboard {
  height: 100%;
  background: #f5f7fa;
  display: flex;
  flex-direction: column;
}

.header {
  background: #fff;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 24px;
  border-bottom: 1px solid #e6e6e6;
  height: 64px !important;
}

.header-left h1 {
  font-size: 20px;
  font-weight: 600;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.main-content {
  padding: 16px;
  overflow: auto;
  display: flex;
  flex-direction: column;
}

.stats-row {
  margin-bottom: 0;
}

.stat-card {
  height: 100%;
}

.stat-content {
  display: flex;
  align-items: center;
  gap: 16px;
}

.stat-icon {
  width: 56px;
  height: 56px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
}

.stat-icon.total {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.stat-icon.active {
  background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
}

.stat-icon.warning {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
}

.stat-icon.danger {
  background: linear-gradient(135deg, #eb3349 0%, #f45c43 100%);
}

.stat-info {
  flex: 1;
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
  line-height: 1.2;
  color: #333;
}

.stat-label {
  font-size: 14px;
  color: #666;
  margin-top: 4px;
}

.list-card, .detail-card {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.list-card :deep(.el-card__body),
.detail-card :deep(.el-card__body) {
  flex: 1;
  overflow: auto;
  padding: 12px;
}

.empty-card :deep(.el-card__body) {
  display: flex;
  align-items: center;
  justify-content: center;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 600;
}

.card-header span {
  display: flex;
  align-items: center;
  gap: 6px;
}

.action-buttons {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #eee;
  display: flex;
  gap: 8px;
}

.history-section {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid #eee;
}

.history-section h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
}
</style>
