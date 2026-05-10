<template>
  <div class="audit-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>审计导出</span>
          <el-button type="primary" @click="exportReport">
            <el-icon><Download /></el-icon>
            导出审计报告
          </el-button>
        </div>
      </template>

      <el-form :inline="true" :model="searchForm" class="search-form">
        <el-form-item label="病区">
          <el-select v-model="searchForm.ward" placeholder="全部病区" clearable style="width: 150px">
            <el-option v-for="ward in wards" :key="ward.ward_name" :label="ward.ward_name" :value="ward.ward_name" />
          </el-select>
        </el-form-item>
        <el-form-item label="开始日期">
          <el-date-picker v-model="searchForm.start_date" type="date" value-format="YYYY-MM-DD" placeholder="选择日期" />
        </el-form-item>
        <el-form-item label="结束日期">
          <el-date-picker v-model="searchForm.end_date" type="date" value-format="YYYY-MM-DD" placeholder="选择日期" />
        </el-form-item>
        <el-form-item label="操作类型">
          <el-select v-model="searchForm.operation_type" placeholder="全部类型" clearable style="width: 130px">
            <el-option label="患者登记" value="PATIENT_REGISTER" />
            <el-option label="患者更新" value="PATIENT_UPDATE" />
            <el-option label="证件办理" value="CERTIFICATE_ISSUE" />
            <el-option label="证件续期" value="CERTIFICATE_RENEW" />
            <el-option label="证件注销" value="CERTIFICATE_CANCEL" />
            <el-option label="换人申请" value="REPLACEMENT_REQUEST" />
            <el-option label="换人通过" value="REPLACEMENT_APPROVE" />
            <el-option label="换人驳回" value="REPLACEMENT_REJECT" />
          </el-select>
        </el-form-item>
        <el-form-item label="结果">
          <el-select v-model="searchForm.result" placeholder="全部结果" clearable style="width: 100px">
            <el-option label="成功" value="success" />
            <el-option label="失败" value="failed" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadLogs">
            <el-icon><Search /></el-icon>
            查询
          </el-button>
          <el-button @click="resetSearch">重置</el-button>
        </el-form-item>
      </el-form>

      <el-alert type="info" show-icon style="margin-bottom: 20px">
        <template #title>
          <span style="font-weight: bold">审计说明</span>
        </template>
        本页面展示所有操作日志，可按病区、日期、操作类型筛选。导出的Excel报告包含：陪护证汇总、换人申请、操作日志、过期提醒四个工作表，供病区护士长核对使用。
      </el-alert>

      <el-table :data="logs" v-loading="loading" border stripe>
        <el-table-column prop="created_at" label="操作时间" width="170">
          <template #default="{ row }">{{ formatDate(row.created_at) }}</template>
        </el-table-column>
        <el-table-column prop="operation_type" label="操作类型" width="110">
          <template #default="{ row }">
            <el-tag :type="getOperationType(row.operation_type)?.type" size="small">
              {{ getOperationType(row.operation_type)?.label }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="patient_name" label="患者" width="100" />
        <el-table-column prop="patient_id" label="患者ID" width="120" />
        <el-table-column prop="certificate_no" label="证件号" width="180" show-overflow-tooltip />
        <el-table-column prop="operator" label="操作员" width="100" />
        <el-table-column prop="action" label="操作内容" min-width="200" show-overflow-tooltip />
        <el-table-column prop="old_value" label="旧值" min-width="150" show-overflow-tooltip>
          <template #default="{ row }">
            <span v-if="row.old_value" class="old-value">{{ row.old_value }}</span>
            <span v-else style="color: #c0c4cc">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="new_value" label="新值" min-width="150" show-overflow-tooltip>
          <template #default="{ row }">
            <span v-if="row.new_value" class="new-value">{{ row.new_value }}</span>
            <span v-else style="color: #c0c4cc">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="source_file" label="来源文件" width="150" show-overflow-tooltip />
        <el-table-column prop="result" label="结果" width="80">
          <template #default="{ row }">
            <el-tag :type="row.result === 'success' ? 'success' : 'danger'" size="small">
              {{ row.result === 'success' ? '成功' : '失败' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="notes" label="备注" min-width="120" show-overflow-tooltip />
        <el-table-column label="追溯" width="80" fixed="right">
          <template #default="{ row }">
            <el-button size="small" type="primary" link @click="traceLog(row)">追溯</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="traceDialogVisible" title="操作追溯" width="700px">
      <el-descriptions v-if="currentLog" :column="2" border>
        <el-descriptions-item label="操作时间" :span="2">{{ formatDate(currentLog.created_at) }}</el-descriptions-item>
        <el-descriptions-item label="操作类型">
          <el-tag :type="getOperationType(currentLog.operation_type)?.type">
            {{ getOperationType(currentLog.operation_type)?.label }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="结果">
          <el-tag :type="currentLog.result === 'success' ? 'success' : 'danger'">
            {{ currentLog.result === 'success' ? '成功' : '失败' }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="操作员">{{ currentLog.operator }}</el-descriptions-item>
        <el-descriptions-item label="患者">{{ currentLog.patient_name || currentLog.patient_id || '-' }}</el-descriptions-item>
        <el-descriptions-item label="患者ID">{{ currentLog.patient_id || '-' }}</el-descriptions-item>
        <el-descriptions-item label="证件号">{{ currentLog.certificate_no || '-' }}</el-descriptions-item>
        <el-descriptions-item label="证件ID">{{ currentLog.certificate_id || '-' }}</el-descriptions-item>
        <el-descriptions-item label="操作内容" :span="2">{{ currentLog.action }}</el-descriptions-item>
        <el-descriptions-item v-if="currentLog.old_value" label="旧值" :span="2">
          <span class="old-value">{{ currentLog.old_value }}</span>
        </el-descriptions-item>
        <el-descriptions-item v-if="currentLog.new_value" label="新值" :span="2">
          <span class="new-value">{{ currentLog.new_value }}</span>
        </el-descriptions-item>
        <el-descriptions-item v-if="currentLog.source_file" label="来源文件" :span="2">
          <el-icon :size="16"><Document /></el-icon>
          {{ currentLog.source_file }}
        </el-descriptions-item>
        <el-descriptions-item v-if="currentLog.notes" label="备注" :span="2">{{ currentLog.notes }}</el-descriptions-item>
      </el-descriptions>
      
      <el-divider>追溯信息</el-divider>
      <el-alert type="info" show-icon>
        <template #title>完整追溯链</template>
        <div style="margin-top: 10px">
          <div><strong>来源文件:</strong> {{ currentLog?.source_file || '无' }}</div>
          <div><strong>录入动作:</strong> {{ getOperationType(currentLog?.operation_type)?.label }} - {{ currentLog?.action }}</div>
          <div><strong>最终结果:</strong> {{ currentLog?.result === 'success' ? '成功' : '失败' }}</div>
          <div v-if="currentLog?.new_value"><strong>处置结果:</strong> {{ currentLog.new_value }}</div>
        </div>
      </el-alert>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import api from '@/api'
import { operationTypeMap } from '@/utils/status'
import dayjs from 'dayjs'
import { Download, Search, Document } from '@element-plus/icons-vue'

const loading = ref(false)
const logs = ref([])
const wards = ref([])
const currentLog = ref(null)

const traceDialogVisible = ref(false)

const searchForm = reactive({
  ward: '',
  start_date: '',
  end_date: '',
  operation_type: '',
  result: ''
})

const formatDate = (date) => dayjs(date).format('YYYY-MM-DD HH:mm:ss')

const getOperationType = (type) => operationTypeMap[type] || { label: type, type: 'info' }

const loadWards = async () => {
  try {
    const res = await api.wards.list()
    wards.value = res.data
  } catch (error) {
    console.error('加载病区列表失败')
  }
}

const loadLogs = async () => {
  loading.value = true
  try {
    const params = {}
    if (searchForm.operation_type) params.operation_type = searchForm.operation_type
    if (searchForm.start_date) params.start_date = searchForm.start_date
    if (searchForm.end_date) params.end_date = searchForm.end_date
    if (searchForm.result) params.result = searchForm.result
    
    const res = await api.audit.logs(params)
    logs.value = res.data
  } catch (error) {
    ElMessage.error('加载日志失败')
  } finally {
    loading.value = false
  }
}

const resetSearch = () => {
  searchForm.ward = ''
  searchForm.start_date = ''
  searchForm.end_date = ''
  searchForm.operation_type = ''
  searchForm.result = ''
  loadLogs()
}

const traceLog = (row) => {
  currentLog.value = row
  traceDialogVisible.value = true
}

const exportReport = async () => {
  try {
    const params = {}
    if (searchForm.ward) params.ward = searchForm.ward
    if (searchForm.start_date) params.start_date = searchForm.start_date
    if (searchForm.end_date) params.end_date = searchForm.end_date
    
    const res = await api.audit.export(params)
    
    const url = window.URL.createObjectURL(new Blob([res.data]))
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `陪护证审计报告_${dayjs().format('YYYYMMDD')}.xlsx`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    ElMessage.success('导出成功')
  } catch (error) {
    ElMessage.error('导出失败')
  }
}

onMounted(() => {
  loadWards()
  loadLogs()
})
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.search-form {
  margin-bottom: 20px;
}

.old-value {
  color: #f56c6c;
  text-decoration: line-through;
}

.new-value {
  color: #67c23a;
  font-weight: bold;
}
</style>
