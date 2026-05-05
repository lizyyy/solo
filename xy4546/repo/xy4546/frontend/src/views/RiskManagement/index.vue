<template>
  <div class="risk-container">
    <el-card>
      <template #header>
        <div class="card-header">
          <span class="card-title">风险管理</span>
          <el-button type="primary" @click="handleDetect">
            <el-icon><Search /></el-icon>
            执行检测
          </el-button>
        </div>
      </template>

      <el-form :inline="true" :model="searchForm" class="search-form">
        <el-form-item label="站点">
          <el-select v-model="searchForm.station_name" placeholder="全部站点" clearable style="width: 150px">
            <el-option
              v-for="station in stations"
              :key="station"
              :label="station"
              :value="station"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="扶梯编号">
          <el-input
            v-model="searchForm.escalator_code"
            placeholder="请输入扶梯编号"
            clearable
            style="width: 150px"
          />
        </el-form-item>
        <el-form-item label="风险类型">
          <el-select v-model="searchForm.risk_type" placeholder="全部类型" clearable style="width: 150px">
            <el-option label="频繁停梯" value="frequent_stop" />
            <el-option label="超载误报" value="overload_false_alarm" />
            <el-option label="长期未复位" value="long_unreset" />
            <el-option label="维保超时" value="maintenance_timeout" />
          </el-select>
        </el-form-item>
        <el-form-item label="风险等级">
          <el-select v-model="searchForm.risk_level" placeholder="全部等级" clearable style="width: 120px">
            <el-option label="严重" value="critical" />
            <el-option label="高" value="high" />
            <el-option label="中" value="medium" />
            <el-option label="低" value="low" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="searchForm.status" placeholder="全部状态" clearable style="width: 120px">
            <el-option label="待处理" value="pending" />
            <el-option label="处理中" value="processing" />
            <el-option label="已解决" value="resolved" />
          </el-select>
        </el-form-item>
        <el-form-item label="重启后仍存在">
          <el-switch v-model="searchForm.is_reopened" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">
            <el-icon><Search /></el-icon>
            搜索
          </el-button>
          <el-button @click="handleReset">
            <el-icon><Refresh /></el-icon>
            重置
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card style="margin-top: 20px;">
      <el-table
        :data="riskList"
        v-loading="loading"
        style="width: 100%"
        @selection-change="handleSelectionChange"
      >
        <el-table-column type="selection" width="50" />
        <el-table-column prop="station_name" label="站点" width="130" />
        <el-table-column prop="escalator_code" label="扶梯编号" width="120" />
        <el-table-column prop="risk_type" label="风险类型" width="130">
          <template #default="{ row }">
            <el-tag :type="getRiskTypeTagType(row.risk_type)">
              {{ getRiskTypeName(row.risk_type) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="risk_level" label="风险等级" width="100">
          <template #default="{ row }">
            <el-tag :type="getRiskLevelTagType(row.risk_level)">
              {{ getRiskLevelName(row.risk_level) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="is_reopened" label="状态" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.is_reopened" type="danger" effect="dark">
              ⚠️ 重启后仍在
            </el-tag>
            <el-tag v-else :type="getStatusTagType(row.status)">
              {{ getStatusName(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="description" label="描述" min-width="200" show-overflow-tooltip />
        <el-table-column prop="manual_judgment" label="人工判改" width="100">
          <template #default="{ row }">
            <span v-if="row.manual_judgment">
              <el-tag size="small" :type="getJudgmentTagType(row.manual_judgment)">
                {{ getJudgmentName(row.manual_judgment) }}
              </el-tag>
            </span>
            <span v-else class="text-gray">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="detected_time" label="检测时间" width="170" />
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="handleViewDetail(row)">
              详情
            </el-button>
            <el-button type="warning" link size="small" @click="handleJudgment(row)">
              判改
            </el-button>
            <el-button 
              v-if="row.status !== 'resolved'" 
              type="success" 
              link 
              size="small" 
              @click="handleResolve(row)"
            >
              解决
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-container">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.page_size"
          :page-sizes="[10, 20, 50, 100]"
          :total="pagination.total"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
        />
      </div>
    </el-card>

    <el-dialog
      v-model="detailDialogVisible"
      title="风险详情"
      width="800px"
      :close-on-click-modal="false"
    >
      <el-descriptions :column="2" border v-if="currentRisk">
        <el-descriptions-item label="站点">{{ currentRisk.station_name || '-' }}</el-descriptions-item>
        <el-descriptions-item label="扶梯编号">{{ currentRisk.escalator_code }}</el-descriptions-item>
        <el-descriptions-item label="风险类型">
          <el-tag :type="getRiskTypeTagType(currentRisk.risk_type)">
            {{ getRiskTypeName(currentRisk.risk_type) }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="风险等级">
          <el-tag :type="getRiskLevelTagType(currentRisk.risk_level)">
            {{ getRiskLevelName(currentRisk.risk_level) }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="状态">
          <template v-if="currentRisk.is_reopened">
            <el-tag type="danger" effect="dark">⚠️ 重启后仍存在 ({{ currentRisk.reopened_count }}次)</el-tag>
          </template>
          <template v-else>
            <el-tag :type="getStatusTagType(currentRisk.status)">
              {{ getStatusName(currentRisk.status) }}
            </el-tag>
          </template>
        </el-descriptions-item>
        <el-descriptions-item label="检测时间">{{ currentRisk.detected_time }}</el-descriptions-item>
        <el-descriptions-item label="描述" :span="2">{{ currentRisk.description }}</el-descriptions-item>
        <el-descriptions-item label="人工判改" v-if="currentRisk.manual_judgment">
          <el-tag :type="getJudgmentTagType(currentRisk.manual_judgment)">
            {{ getJudgmentName(currentRisk.manual_judgment) }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="人工备注" v-if="currentRisk.manual_remarks" :span="2">
          {{ currentRisk.manual_remarks }}
        </el-descriptions-item>
      </el-descriptions>

      <el-divider>相关数据</el-divider>
      
      <el-collapse v-if="currentRisk.related_records">
        <el-collapse-item title="详细数据">
          <pre style="white-space: pre-wrap; word-wrap: break-word; background: #f5f7fa; padding: 15px; border-radius: 4px;">
{{ formatRelatedRecords(currentRisk.related_records) }}
          </pre>
        </el-collapse-item>
      </el-collapse>

      <el-divider>状态变更历史</el-divider>
      
      <el-table :data="statusLogs" style="width: 100%" v-if="statusLogs.length > 0">
        <el-table-column prop="old_status" label="原状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusTagType(row.old_status)" size="small">
              {{ getStatusName(row.old_status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="new_status" label="新状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusTagType(row.new_status)" size="small">
              {{ getStatusName(row.new_status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="operator" label="操作人" width="100" />
        <el-table-column prop="remarks" label="备注" min-width="200" />
        <el-table-column prop="created_at" label="时间" width="170" />
      </el-table>
      <el-empty v-else description="暂无状态变更历史" />
    </el-dialog>

    <el-dialog
      v-model="judgmentDialogVisible"
      title="人工判改"
      width="500px"
      :close-on-click-modal="false"
    >
      <el-form :model="judgmentForm" :rules="judgmentRules" ref="judgmentFormRef" label-width="100px">
        <el-form-item label="判改结果" prop="manual_judgment">
          <el-select v-model="judgmentForm.manual_judgment" placeholder="请选择判改结果" style="width: 100%">
            <el-option label="确认风险" value="confirmed" />
            <el-option label="误报" value="false_alarm" />
            <el-option label="待观察" value="observe" />
            <el-option label="已处理" value="resolved" />
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input
            v-model="judgmentForm.manual_remarks"
            type="textarea"
            :rows="4"
            placeholder="请输入备注信息"
          />
        </el-form-item>
        <el-form-item label="操作人">
          <el-input v-model="judgmentForm.operator" placeholder="请输入操作人姓名" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="judgmentDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitJudgment">确认</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="resolveDialogVisible"
      title="标记已解决"
      width="500px"
      :close-on-click-modal="false"
    >
      <el-form :model="resolveForm" :rules="resolveRules" ref="resolveFormRef" label-width="100px">
        <el-form-item label="处理人" prop="resolver">
          <el-input v-model="resolveForm.resolver" placeholder="请输入处理人姓名" />
        </el-form-item>
        <el-form-item label="处理说明" prop="resolve_description">
          <el-input
            v-model="resolveForm.resolve_description"
            type="textarea"
            :rows="4"
            placeholder="请输入处理说明"
          />
        </el-form-item>
        <el-form-item label="操作人">
          <el-input v-model="resolveForm.operator" placeholder="请输入操作人姓名" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="resolveDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitResolve">确认</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { riskApi, escalatorApi } from '@/api'

const loading = ref(false)
const riskList = ref([])
const stations = ref([])
const selectedRisks = ref([])

const searchForm = reactive({
  station_name: '',
  escalator_code: '',
  risk_type: '',
  risk_level: '',
  status: '',
  is_reopened: false
})

const pagination = reactive({
  page: 1,
  page_size: 20,
  total: 0
})

const detailDialogVisible = ref(false)
const judgmentDialogVisible = ref(false)
const resolveDialogVisible = ref(false)
const currentRisk = ref(null)
const statusLogs = ref([])

const judgmentFormRef = ref(null)
const judgmentForm = reactive({
  manual_judgment: '',
  manual_remarks: '',
  operator: ''
})

const resolveFormRef = ref(null)
const resolveForm = reactive({
  resolver: '',
  resolve_description: '',
  operator: ''
})

const judgmentRules = {
  manual_judgment: [{ required: true, message: '请选择判改结果', trigger: 'change' }]
}

const resolveRules = {
  resolver: [{ required: true, message: '请输入处理人姓名', trigger: 'blur' }],
  resolve_description: [{ required: true, message: '请输入处理说明', trigger: 'blur' }]
}

const riskTypeNames = {
  frequent_stop: '频繁停梯',
  overload_false_alarm: '超载误报',
  long_unreset: '长期未复位',
  maintenance_timeout: '维保超时'
}

const riskLevelNames = {
  critical: '严重',
  high: '高',
  medium: '中',
  low: '低'
}

const statusNames = {
  pending: '待处理',
  processing: '处理中',
  resolved: '已解决'
}

const judgmentNames = {
  confirmed: '确认风险',
  false_alarm: '误报',
  observe: '待观察',
  resolved: '已处理'
}

const loadRisks = async () => {
  loading.value = true
  try {
    const params = {
      page: pagination.page,
      page_size: pagination.page_size,
      ...searchForm
    }
    
    if (!params.station_name) delete params.station_name
    if (!params.escalator_code) delete params.escalator_code
    if (!params.risk_type) delete params.risk_type
    if (!params.risk_level) delete params.risk_level
    if (!params.status) delete params.status
    if (!params.is_reopened) delete params.is_reopened

    const res = await riskApi.getList(params)
    if (res.data.success) {
      riskList.value = res.data.data.risks
      pagination.total = res.data.data.pagination.total
    }
  } catch (error) {
    console.error('加载风险列表失败:', error)
    ElMessage.error('加载风险列表失败: ' + (error.message || error))
  } finally {
    loading.value = false
  }
}

const loadStations = async () => {
  try {
    const res = await escalatorApi.getStations()
    if (res.data.success) {
      stations.value = res.data.data
    }
  } catch (error) {
    console.error('加载站点列表失败:', error)
  }
}

const handleSearch = () => {
  pagination.page = 1
  loadRisks()
}

const handleReset = () => {
  searchForm.station_name = ''
  searchForm.escalator_code = ''
  searchForm.risk_type = ''
  searchForm.risk_level = ''
  searchForm.status = ''
  searchForm.is_reopened = false
  pagination.page = 1
  loadRisks()
}

const handleSizeChange = (val) => {
  pagination.page_size = val
  pagination.page = 1
  loadRisks()
}

const handleCurrentChange = (val) => {
  pagination.page = val
  loadRisks()
}

const handleSelectionChange = (val) => {
  selectedRisks.value = val
}

const handleDetect = async () => {
  try {
    await ElMessageBox.confirm(
      '确定要执行风险检测吗？系统将分析所有扶梯数据并标记风险。',
      '风险检测确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    loading.value = true
    const res = await riskApi.detect({})
    
    if (res.data.success) {
      ElMessage.success(`检测完成，发现 ${res.data.data.count} 个风险`)
      loadRisks()
    }
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('风险检测失败: ' + (error.message || error))
    }
  } finally {
    loading.value = false
  }
}

const handleViewDetail = async (row) => {
  currentRisk.value = row
  statusLogs.value = []
  detailDialogVisible.value = true

  try {
    const res = await riskApi.getById(row.id)
    if (res.data.success) {
      statusLogs.value = res.data.data.statusLogs || []
    }
  } catch (error) {
    console.error('加载状态日志失败:', error)
  }
}

const handleJudgment = (row) => {
  currentRisk.value = row
  judgmentForm.manual_judgment = row.manual_judgment || ''
  judgmentForm.manual_remarks = row.manual_remarks || ''
  judgmentForm.operator = ''
  judgmentDialogVisible.value = true
}

const submitJudgment = async () => {
  if (!judgmentFormRef.value) return
  
  await judgmentFormRef.value.validate(async (valid) => {
    if (valid) {
      try {
        const res = await riskApi.updateJudgment(currentRisk.value.id, {
          manual_judgment: judgmentForm.manual_judgment,
          manual_remarks: judgmentForm.manual_remarks,
          operator: judgmentForm.operator
        })

        if (res.data.success) {
          ElMessage.success('判改成功')
          judgmentDialogVisible.value = false
          loadRisks()
        }
      } catch (error) {
        ElMessage.error('判改失败: ' + (error.message || error))
      }
    }
  })
}

const handleResolve = (row) => {
  currentRisk.value = row
  resolveForm.resolver = ''
  resolveForm.resolve_description = ''
  resolveForm.operator = ''
  resolveDialogVisible.value = true
}

const submitResolve = async () => {
  if (!resolveFormRef.value) return
  
  await resolveFormRef.value.validate(async (valid) => {
    if (valid) {
      try {
        const res = await riskApi.updateStatus(currentRisk.value.id, {
          status: 'resolved',
          resolver: resolveForm.resolver,
          resolve_description: resolveForm.resolve_description,
          operator: resolveForm.operator
        })

        if (res.data.success) {
          ElMessage.success('已标记为已解决')
          resolveDialogVisible.value = false
          loadRisks()
        }
      } catch (error) {
        ElMessage.error('操作失败: ' + (error.message || error))
      }
    }
  })
}

const getRiskTypeName = (type) => riskTypeNames[type] || type
const getRiskLevelName = (level) => riskLevelNames[level] || level
const getStatusName = (status) => statusNames[status] || status
const getJudgmentName = (judgment) => judgmentNames[judgment] || judgment

const getRiskTypeTagType = (type) => {
  const map = {
    frequent_stop: 'danger',
    overload_false_alarm: 'warning',
    long_unreset: 'danger',
    maintenance_timeout: 'warning'
  }
  return map[type] || ''
}

const getRiskLevelTagType = (level) => {
  const map = {
    critical: 'danger',
    high: 'warning',
    medium: '',
    low: 'success'
  }
  return map[level] || ''
}

const getStatusTagType = (status) => {
  const map = {
    pending: 'warning',
    processing: 'primary',
    resolved: 'success'
  }
  return map[status] || ''
}

const getJudgmentTagType = (judgment) => {
  const map = {
    confirmed: 'danger',
    false_alarm: 'success',
    observe: 'warning',
    resolved: 'success'
  }
  return map[judgment] || ''
}

const formatRelatedRecords = (records) => {
  if (!records) return '-'
  try {
    const parsed = typeof records === 'string' ? JSON.parse(records) : records
    return JSON.stringify(parsed, null, 2)
  } catch (e) {
    return records
  }
}

onMounted(() => {
  loadStations()
  loadRisks()
})
</script>

<style lang="scss" scoped>
.risk-container {
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;

    .card-title {
      font-size: 16px;
      font-weight: 500;
    }
  }

  .search-form {
    margin-bottom: 10px;
  }

  .pagination-container {
    margin-top: 20px;
    display: flex;
    justify-content: flex-end;
  }

  .text-gray {
    color: #909399;
  }
}
</style>
