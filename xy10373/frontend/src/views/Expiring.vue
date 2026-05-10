<template>
  <div class="expiring-page">
    <el-alert type="warning" show-icon style="margin-bottom: 20px">
      <template #title>
        <span style="font-weight: bold">过期提醒</span>
      </template>
      以下证件即将过期或已过期，请及时处理。
    </el-alert>

    <el-row :gutter="20" style="margin-bottom: 20px">
      <el-col :span="8">
        <el-statistic title="即将过期（3天内）" :value="expiringCount" value-style="color: #e6a23c">
          <template #prefix>
            <el-icon><Clock /></el-icon>
          </template>
        </el-statistic>
      </el-col>
      <el-col :span="8">
        <el-statistic title="已过期" :value="expiredCount" value-style="color: #f56c6c">
          <template #prefix>
            <el-icon><Warning /></el-icon>
          </template>
        </el-statistic>
      </el-col>
      <el-col :span="8">
        <el-statistic title="需关注总数" :value="totalAlert" value-style="color: #409eff">
          <template #prefix>
            <el-icon><Bell /></el-icon>
          </template>
        </el-statistic>
      </el-col>
    </el-row>

    <el-card>
      <template #header>
        <div class="card-header">
          <span>过期证件列表</span>
          <el-button type="primary" @click="loadData">
            <el-icon><Refresh /></el-icon>
            刷新
          </el-button>
        </div>
      </template>

      <el-table :data="alertCertificates" v-loading="loading" border stripe>
        <el-table-column prop="certificate_no" label="证件号" width="200" />
        <el-table-column label="患者信息" width="180">
          <template #default="{ row }">
            <div>
              <div>{{ getPatientName(row.patient_id) }}</div>
              <div style="color: #909399; font-size: 12px">{{ getPatientWard(row.patient_id) }}</div>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="caregiver_name" label="陪护人" width="100" />
        <el-table-column prop="issue_date" label="发证日期" width="120" />
        <el-table-column prop="expiry_date" label="过期日期" width="120" />
        <el-table-column label="剩余天数" width="100">
          <template #default="{ row }">
            <span :class="row.days_remaining < 0 ? 'text-danger' : 'text-warning'">
              {{ row.days_remaining >= 0 ? row.days_remaining + '天' : `过期${Math.abs(row.days_remaining)}天` }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="120">
          <template #default="{ row }">
            <el-tag :type="row.days_remaining < 0 ? 'danger' : 'warning'" size="small">
              {{ row.days_remaining < 0 ? '已过期' : '即将过期' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="source_file" label="来源文件" width="150" show-overflow-tooltip />
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button size="small" type="primary" link @click="viewDetail(row)">详情</el-button>
            <el-button v-if="row.days_remaining >= 0" size="small" type="success" link @click="quickRenew(row)">续期</el-button>
            <el-button size="small" type="danger" link @click="cancelCert(row)">注销</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="detailDialogVisible" title="证件详情" width="600px">
      <el-descriptions v-if="currentCert" :column="2" border>
        <el-descriptions-item label="证件号" :span="2">{{ currentCert.certificate_no }}</el-descriptions-item>
        <el-descriptions-item label="患者">{{ getPatientName(currentCert.patient_id) }}</el-descriptions-item>
        <el-descriptions-item label="患者ID">{{ currentCert.patient_id }}</el-descriptions-item>
        <el-descriptions-item label="陪护人">{{ currentCert.caregiver_name }}</el-descriptions-item>
        <el-descriptions-item label="陪护人ID">{{ currentCert.caregiver_id }}</el-descriptions-item>
        <el-descriptions-item label="发证日期">{{ currentCert.issue_date }}</el-descriptions-item>
        <el-descriptions-item label="过期日期">{{ currentCert.expiry_date }}</el-descriptions-item>
        <el-descriptions-item label="剩余天数">
          <span :class="currentCert.days_remaining < 0 ? 'text-danger' : 'text-warning'">
            {{ currentCert.days_remaining >= 0 ? currentCert.days_remaining + '天' : `过期${Math.abs(currentCert.days_remaining)}天` }}
          </span>
        </el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="currentCert.days_remaining < 0 ? 'danger' : 'warning'">
            {{ currentCert.days_remaining < 0 ? '已过期' : '即将过期' }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="来源文件" :span="2">{{ currentCert.source_file || '-' }}</el-descriptions-item>
        <el-descriptions-item label="备注" :span="2">{{ currentCert.notes || '-' }}</el-descriptions-item>
      </el-descriptions>
      
      <el-divider>操作历史</el-divider>
      <el-table :data="certLogs" v-loading="logsLoading" size="small">
        <el-table-column prop="created_at" label="时间" width="160">
          <template #default="{ row }">{{ formatDate(row.created_at) }}</template>
        </el-table-column>
        <el-table-column prop="operation_type" label="类型" width="100">
          <template #default="{ row }">
            <el-tag :type="getOperationType(row.operation_type)?.type" size="small">
              {{ getOperationType(row.operation_type)?.label }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="operator" label="操作员" width="80" />
        <el-table-column prop="action" label="操作" show-overflow-tooltip />
        <el-table-column prop="result" label="结果" width="60">
          <template #default="{ row }">
            <el-tag :type="row.result === 'success' ? 'success' : 'danger'" size="small">
              {{ row.result === 'success' ? '成功' : '失败' }}
            </el-tag>
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>

    <el-dialog v-model="renewDialogVisible" title="快速续期" width="400px">
      <el-descriptions v-if="currentCert" :column="1" border size="small">
        <el-descriptions-item label="证件号">{{ currentCert.certificate_no }}</el-descriptions-item>
        <el-descriptions-item label="患者">{{ getPatientName(currentCert.patient_id) }}</el-descriptions-item>
        <el-descriptions-item label="陪护人">{{ currentCert.caregiver_name }}</el-descriptions-item>
        <el-descriptions-item label="原过期日期">{{ currentCert.expiry_date }}</el-descriptions-item>
      </el-descriptions>
      <el-form label-width="100px" style="margin-top: 20px">
        <el-form-item label="续期天数">
          <el-input-number v-model="renewDays" :min="1" :max="30" style="width: 100%" />
        </el-form-item>
        <el-form-item label="操作员">
          <el-input v-model="renewOperator" placeholder="请输入操作员姓名" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="renewDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmRenew">确认续期</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import api from '@/api'
import { operationTypeMap } from '@/utils/status'
import dayjs from 'dayjs'
import { Clock, Warning, Bell, Refresh } from '@element-plus/icons-vue'

const loading = ref(false)
const logsLoading = ref(false)
const alertCertificates = ref([])
const allPatients = ref([])
const certLogs = ref([])
const currentCert = ref(null)

const detailDialogVisible = ref(false)
const renewDialogVisible = ref(false)
const renewDays = ref(7)
const renewOperator = ref('管理员')

const expiringCount = computed(() => {
  return alertCertificates.value.filter(c => c.days_remaining >= 0).length
})

const expiredCount = computed(() => {
  return alertCertificates.value.filter(c => c.days_remaining < 0).length
})

const totalAlert = computed(() => alertCertificates.value.length)

const formatDate = (date) => dayjs(date).format('YYYY-MM-DD HH:mm:ss')

const getOperationType = (type) => operationTypeMap[type] || { label: type, type: 'info' }

const getPatientName = (patientId) => {
  const p = allPatients.value.find(p => p.patient_id === patientId)
  return p?.name || patientId
}

const getPatientWard = (patientId) => {
  const p = allPatients.value.find(p => p.patient_id === patientId)
  return p?.ward || ''
}

const loadData = async () => {
  loading.value = true
  try {
    const [certRes, patientRes] = await Promise.all([
      api.certificates.list({ expiring_soon: true }),
      api.patients.list()
    ])
    
    allPatients.value = patientRes.data
    
    let allCerts = certRes.data
    const expiringCerts = allCerts.filter(c => c.days_remaining <= 3 && c.status !== 'cancelled')
    
    const activeRes = await api.certificates.list({ status: 'active' })
    const expiredCerts = activeRes.data.filter(c => c.days_remaining < 0)
    
    alertCertificates.value = [...expiringCerts, ...expiredCerts].sort((a, b) => a.days_remaining - b.days_remaining)
  } catch (error) {
    ElMessage.error('加载数据失败')
  } finally {
    loading.value = false
  }
}

const viewDetail = async (row) => {
  currentCert.value = row
  logsLoading.value = true
  try {
    const res = await api.certificates.logs(row.id)
    certLogs.value = res.data
  } catch (error) {
    console.error('加载日志失败')
  } finally {
    logsLoading.value = false
  }
  detailDialogVisible.value = true
}

const quickRenew = (row) => {
  currentCert.value = row
  renewDays.value = 7
  renewOperator.value = '管理员'
  renewDialogVisible.value = true
}

const confirmRenew = async () => {
  if (!renewOperator.value) {
    ElMessage.warning('请输入操作员姓名')
    return
  }
  
  try {
    const newExpiryDate = dayjs(currentCert.value.expiry_date).add(renewDays.value, 'day').format('YYYY-MM-DD')
    
    await api.certificates.renew(currentCert.value.id, {
      new_expiry_date: newExpiryDate,
      operator: renewOperator.value
    })
    ElMessage.success('续期成功')
    renewDialogVisible.value = false
    loadData()
  } catch (error) {
    ElMessage.error('续期失败')
  }
}

const cancelCert = async (row) => {
  try {
    await ElMessageBox.confirm('确定要注销此陪护证吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    
    await api.certificates.cancel(row.id, {
      operator: '管理员',
      reason: '证件过期注销'
    })
    ElMessage.success('注销成功')
    loadData()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('注销失败')
    }
  }
}

onMounted(() => {
  loadData()
})
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.text-danger {
  color: #f56c6c;
  font-weight: bold;
}

.text-warning {
  color: #e6a23c;
  font-weight: bold;
}
</style>
