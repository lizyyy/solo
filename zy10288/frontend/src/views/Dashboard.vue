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

        <el-tabs v-model="activeTab" style="margin-top: 16px">
          <el-tab-pane label="异常队列" name="anomalies">
            <el-row :gutter="16" style="flex: 1; min-height: 500px">
              <el-col :span="14">
                <el-card class="list-card">
                  <template #header>
                    <div class="card-header">
                      <span><el-icon><Warning /></el-icon> 异常列表</span>
                      <el-select v-model="anomalyFilter" size="small" placeholder="筛选状态" style="width: 120px" @change="fetchAnomalies">
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
          </el-tab-pane>

          <el-tab-pane label="月卡管理" name="cards">
            <el-card class="list-card">
              <template #header>
                <div class="card-header">
                  <span><el-icon><CreditCard /></el-icon> 月卡列表</span>
                  <div class="header-actions">
                    <el-button type="primary" size="small" @click="showImportDialog = true">
                      <el-icon><Upload /></el-icon>批量导入
                    </el-button>
                    <el-button type="success" size="small" @click="handleCreateCard">
                      <el-icon><Plus /></el-icon>新增月卡
                    </el-button>
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
                <el-table-column label="操作" width="200" fixed="right">
                  <template #default="{ row }">
                    <el-button 
                      type="primary" 
                      size="small" 
                      link
                      @click.stop="handleEditCard(row)"
                    >
                      编辑
                    </el-button>
                    <el-button 
                      type="success" 
                      size="small" 
                      link
                      @click.stop="handleSyncCardDirect(row)"
                      :disabled="row.syncStatus === 'success'"
                    >
                      同步
                    </el-button>
                    <el-button 
                      type="warning" 
                      size="small" 
                      link
                      @click.stop="handleCreateRefund(row)"
                      :disabled="row.status === 'refunded'"
                    >
                      退款
                    </el-button>
                    <el-button 
                      type="danger" 
                      size="small" 
                      link
                      @click.stop="handleDeleteCard(row)"
                    >
                      删除
                    </el-button>
                  </template>
                </el-table-column>
              </el-table>
            </el-card>
          </el-tab-pane>

          <el-tab-pane label="黑名单管理" name="blacklist">
            <el-card class="list-card">
              <template #header>
                <div class="card-header">
                  <span><el-icon><Delete /></el-icon> 黑名单列表</span>
                  <el-button type="danger" size="small" @click="showBlacklistDialog = true">
                    <el-icon><Plus /></el-icon>添加黑名单
                  </el-button>
                </div>
              </template>
              <el-table :data="blacklist" style="width: 100%" size="small">
                <el-table-column prop="plateNumber" label="车牌号" width="120" />
                <el-table-column prop="reason" label="拉黑原因" show-overflow-tooltip />
                <el-table-column label="有效期" width="220">
                  <template #default="{ row }">
                    {{ row.startTime }} 至 {{ row.endTime || '永久' }}
                  </template>
                </el-table-column>
                <el-table-column prop="isActive" label="状态" width="90">
                  <template #default="{ row }">
                    <el-tag :type="row.isActive ? 'danger' : 'info'" size="small">
                      {{ row.isActive ? '生效中' : '已解除' }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column prop="createdAt" label="创建时间" width="160">
                  <template #default="{ row }">
                    {{ formatTime(row.createdAt) }}
                  </template>
                </el-table-column>
                <el-table-column label="操作" width="100" fixed="right">
                  <template #default="{ row }">
                    <el-button 
                      type="primary" 
                      size="small" 
                      link
                      @click.stop="handleDeleteBlacklist(row)"
                      v-if="row.isActive"
                    >
                      解除拉黑
                    </el-button>
                  </template>
                </el-table-column>
              </el-table>
            </el-card>
          </el-tab-pane>

          <el-tab-pane label="退款记录" name="refunds">
            <el-card class="list-card">
              <template #header>
                <div class="card-header">
                  <span><el-icon><Money /></el-icon> 退款记录</span>
                </div>
              </template>
              <el-table :data="refunds" style="width: 100%" size="small">
                <el-table-column prop="plateNumber" label="车牌号" width="120" />
                <el-table-column prop="refundAmount" label="退款金额" width="100" align="right">
                  <template #default="{ row }">
                    ¥{{ row.refundAmount }}
                  </template>
                </el-table-column>
                <el-table-column prop="refundReason" label="退款原因" show-overflow-tooltip />
                <el-table-column prop="refundDate" label="退款日期" width="120" />
                <el-table-column prop="operator" label="操作人" width="100" />
                <el-table-column prop="synced" label="同步状态" width="90">
                  <template #default="{ row }">
                    <el-tag :type="row.synced ? 'success' : 'warning'" size="small">
                      {{ row.synced ? '已同步' : '待同步' }}
                    </el-tag>
                  </template>
                </el-table-column>
              </el-table>
            </el-card>
          </el-tab-pane>
        </el-tabs>
      </el-main>
    </el-container>

    <el-dialog v-model="showCardDialog" :title="editingCard ? '编辑月卡' : '新增月卡'" width="600px">
      <el-form :model="cardForm" label-width="100px" :rules="cardRules" ref="cardFormRef">
        <el-form-item label="卡号" prop="cardNo">
          <el-input v-model="cardForm.cardNo" :disabled="!!editingCard" placeholder="请输入卡号" />
        </el-form-item>
        <el-form-item label="车牌号" prop="plateNumber">
          <el-input v-model="cardForm.plateNumber" placeholder="请输入车牌号" />
        </el-form-item>
        <el-form-item label="车主姓名" prop="ownerName">
          <el-input v-model="cardForm.ownerName" placeholder="请输入车主姓名" />
        </el-form-item>
        <el-form-item label="联系电话" prop="ownerPhone">
          <el-input v-model="cardForm.ownerPhone" placeholder="请输入联系电话" />
        </el-form-item>
        <el-form-item label="有效期" prop="dateRange">
          <el-date-picker 
            v-model="cardForm.dateRange" 
            type="daterange" 
            range-separator="至" 
            start-placeholder="开始日期" 
            end-placeholder="结束日期"
            value-format="YYYY-MM-DD"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="卡状态" prop="status">
          <el-select v-model="cardForm.status" placeholder="请选择状态" style="width: 100%">
            <el-option label="有效" value="active" />
            <el-option label="已过期" value="expired" />
            <el-option label="已退款" value="refunded" />
            <el-option label="已拉黑" value="blacklisted" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCardDialog = false">取消</el-button>
        <el-button type="primary" @click="handleSaveCard" :loading="loading">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showBlacklistDialog" title="添加黑名单" width="500px">
      <el-form :model="blacklistForm" label-width="100px" ref="blacklistFormRef">
        <el-form-item label="车牌号" prop="plateNumber">
          <el-input v-model="blacklistForm.plateNumber" placeholder="请输入车牌号" />
        </el-form-item>
        <el-form-item label="拉黑原因" prop="reason">
          <el-input v-model="blacklistForm.reason" type="textarea" :rows="3" placeholder="请输入拉黑原因" />
        </el-form-item>
        <el-form-item label="开始日期" prop="startTime">
          <el-date-picker 
            v-model="blacklistForm.startTime" 
            type="date" 
            placeholder="选择开始日期"
            value-format="YYYY-MM-DD"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="结束日期" prop="endTime">
          <el-date-picker 
            v-model="blacklistForm.endTime" 
            type="date" 
            placeholder="选择结束日期（不选则永久有效）"
            value-format="YYYY-MM-DD"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="操作人" prop="operator">
          <el-input v-model="blacklistForm.operator" placeholder="请输入操作人姓名" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showBlacklistDialog = false">取消</el-button>
        <el-button type="primary" @click="handleSaveBlacklist" :loading="loading">确认拉黑</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showRefundDialog" title="办理退款" width="500px">
      <el-form :model="refundForm" label-width="100px" ref="refundFormRef">
        <el-form-item label="车牌号">
          <el-input v-model="refundForm.plateNumber" disabled />
        </el-form-item>
        <el-form-item label="退款金额" prop="refundAmount">
          <el-input-number v-model="refundForm.refundAmount" :min="0" style="width: 100%" />
        </el-form-item>
        <el-form-item label="退款原因" prop="refundReason">
          <el-input v-model="refundForm.refundReason" type="textarea" :rows="3" placeholder="请输入退款原因" />
        </el-form-item>
        <el-form-item label="退款日期" prop="refundDate">
          <el-date-picker 
            v-model="refundForm.refundDate" 
            type="date" 
            placeholder="选择退款日期"
            value-format="YYYY-MM-DD"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="操作人" prop="operator">
          <el-input v-model="refundForm.operator" placeholder="请输入操作人姓名" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showRefundDialog = false">取消</el-button>
        <el-button type="primary" @click="handleSaveRefund" :loading="loading">确认退款</el-button>
      </template>
    </el-dialog>

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

    <el-dialog v-model="showImportDialog" title="批量导入月卡" width="600px">
      <el-alert 
        title="导入说明" 
        :closable="false"
        style="margin-bottom: 16px"
      >
        请按以下格式准备数据：[{"cardNo":"MC001","plateNumber":"京A12345","ownerName":"张三","ownerPhone":"13800138000","startDate":"2024-01-01","endDate":"2024-12-31","status":"active"}]
      </el-alert>
      <el-form label-width="80px">
        <el-form-item label="操作人">
          <el-input v-model="operator" placeholder="请输入操作人姓名" />
        </el-form-item>
        <el-form-item label="导入数据">
          <el-input 
            v-model="importData" 
            type="textarea" 
            :rows="10" 
            placeholder="请粘贴JSON格式的月卡数据"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showImportDialog = false">取消</el-button>
        <el-button type="primary" @click="handleImport" :loading="loading">开始导入</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showImportResult" title="导入结果" width="500px">
      <div v-if="importResult">
        <el-alert :title="`成功 ${importResult.success?.length || 0} 条`" type="success" :closable="false" style="margin-bottom: 8px" />
        <el-alert :title="`失败 ${importResult.failed?.length || 0} 条`" type="warning" :closable="false" v-if="importResult.failed?.length > 0" />
        <div v-if="importResult.failed?.length > 0" style="margin-top: 16px; max-height: 200px; overflow-y: auto">
          <el-table :data="importResult.failed" size="small">
            <el-table-column prop="cardNo" label="卡号" width="100" />
            <el-table-column prop="plateNumber" label="车牌号" width="100" />
            <el-table-column prop="reason" label="失败原因" />
          </el-table>
        </div>
      </div>
      <template #footer>
        <el-button type="primary" @click="showImportResult = false">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useParkingStore } from '../stores/parking'
import dayjs from 'dayjs'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'

const store = useParkingStore()

const { 
  statistics, 
  anomalies, 
  cards, 
  blacklist, 
  refunds,
  selectedAnomaly, 
  anomalyHistory, 
  loading, 
  openAnomaliesCount,
  fetchStatistics, 
  fetchAnomalies, 
  fetchCards,
  fetchBlacklist,
  fetchRefunds,
  fetchAnomalyHistory,
  doCreateCard,
  doUpdateCard,
  doDeleteCard,
  doSyncCard,
  doProcessAnomaly,
  doCreateBlacklist,
  doDeleteBlacklist,
  doCreateRefund,
  doImportCards
} = store

const activeTab = ref('anomalies')
const anomalyFilter = ref('')
const plateSearch = ref('')

const showCardDialog = ref(false)
const showBlacklistDialog = ref(false)
const showRefundDialog = ref(false)
const showResolveDialog = ref(false)
const showIgnoreDialog = ref(false)
const showImportDialog = ref(false)
const showImportResult = ref(false)

const editingCard = ref<any>(null)
const cardFormRef = ref<FormInstance>()
const cardForm = ref({
  cardNo: '',
  plateNumber: '',
  ownerName: '',
  ownerPhone: '',
  dateRange: [] as string[],
  status: 'active'
})

const cardRules: FormRules = {
  cardNo: [{ required: true, message: '请输入卡号', trigger: 'blur' }],
  plateNumber: [{ required: true, message: '请输入车牌号', trigger: 'blur' }],
  ownerName: [{ required: true, message: '请输入车主姓名', trigger: 'blur' }],
  ownerPhone: [{ required: true, message: '请输入联系电话', trigger: 'blur' }],
  dateRange: [{ required: true, message: '请选择有效期', trigger: 'change' }],
  status: [{ required: true, message: '请选择卡状态', trigger: 'change' }]
}

const blacklistFormRef = ref<FormInstance>()
const blacklistForm = ref({
  plateNumber: '',
  reason: '',
  startTime: dayjs().format('YYYY-MM-DD'),
  endTime: '',
  operator: '管理员'
})

const refundFormRef = ref<FormInstance>()
const refundForm = ref({
  cardId: '',
  plateNumber: '',
  refundAmount: 0,
  refundReason: '',
  refundDate: dayjs().format('YYYY-MM-DD'),
  operator: '管理员',
  synced: false
})

const resolveResult = ref('')
const ignoreReason = ref('')
const operator = ref('管理员')
const importData = ref('')
const importResult = ref<any>(null)

onMounted(() => {
  refreshAll()
})

async function refreshAll() {
  await Promise.all([
    fetchStatistics(),
    fetchAnomalies(),
    fetchCards(),
    fetchBlacklist(),
    fetchRefunds()
  ])
}

function handleAnomalyClick(row: any) {
  store.selectedAnomaly = row
  fetchAnomalyHistory(row.id)
}

function handleProcessAnomaly(row: any) {
  store.selectedAnomaly = row
  fetchAnomalyHistory(row.id)
}

function handleCardClick(row: any) {
  console.log('选中卡片:', row)
}

function handleCreateCard() {
  editingCard.value = null
  cardForm.value = {
    cardNo: '',
    plateNumber: '',
    ownerName: '',
    ownerPhone: '',
    dateRange: [],
    status: 'active'
  }
  showCardDialog.value = true
}

function handleEditCard(row: any) {
  editingCard.value = row
  cardForm.value = {
    cardNo: row.cardNo,
    plateNumber: row.plateNumber,
    ownerName: row.ownerName,
    ownerPhone: row.ownerPhone,
    dateRange: [row.startDate, row.endDate],
    status: row.status
  }
  showCardDialog.value = true
}

async function handleSaveCard() {
  if (!cardFormRef.value) return
  
  await cardFormRef.value.validate(async (valid) => {
    if (valid) {
      const data = {
        cardNo: cardForm.value.cardNo,
        plateNumber: cardForm.value.plateNumber,
        ownerName: cardForm.value.ownerName,
        ownerPhone: cardForm.value.ownerPhone,
        startDate: cardForm.value.dateRange[0],
        endDate: cardForm.value.dateRange[1],
        status: cardForm.value.status
      }
      
      if (editingCard.value) {
        await doUpdateCard(editingCard.value.id, data)
        ElMessage.success('更新成功')
      } else {
        await doCreateCard(data)
        ElMessage.success('创建成功')
      }
      
      showCardDialog.value = false
    }
  })
}

async function handleDeleteCard(row: any) {
  try {
    await ElMessageBox.confirm(`确定要删除月卡 ${row.cardNo} 吗？`, '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    
    await doDeleteCard(row.id)
    ElMessage.success('删除成功')
  } catch {
  }
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

function handleCreateRefund(row: any) {
  refundForm.value = {
    cardId: row.id,
    plateNumber: row.plateNumber,
    refundAmount: 300,
    refundReason: '',
    refundDate: dayjs().format('YYYY-MM-DD'),
    operator: '管理员',
    synced: false
  }
  showRefundDialog.value = true
}

async function handleSaveRefund() {
  await doCreateRefund(refundForm.value)
  ElMessage.success('退款办理成功')
  showRefundDialog.value = false
}

async function handleSaveBlacklist() {
  const data = {
    ...blacklistForm.value,
    isActive: true
  }
  await doCreateBlacklist(data)
  ElMessage.success('添加黑名单成功')
  showBlacklistDialog.value = false
}

async function handleDeleteBlacklist(row: any) {
  try {
    await ElMessageBox.confirm(`确定要解除 ${row.plateNumber} 的黑名单吗？`, '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    
    await doDeleteBlacklist(row.id)
    ElMessage.success('已解除黑名单')
  } catch {
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

async function handleImport() {
  try {
    const cards = JSON.parse(importData.value)
    const result = await doImportCards({ cards, operator: operator.value })
    importResult.value = result.data
    showImportDialog.value = false
    showImportResult.value = true
    importData.value = ''
  } catch (e) {
    ElMessage.error('数据格式错误，请检查JSON格式')
  }
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
    blacklisted: '已拉黑'
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
    auto_resolve: '自动解决',
    import: '批量导入'
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

.header-actions {
  display: flex;
  gap: 8px;
  align-items: center;
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
