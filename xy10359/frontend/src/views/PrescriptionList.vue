<template>
  <div class="prescription-list">
    <el-card class="stats-card" shadow="never">
      <div class="stats-container">
        <div class="stat-item" v-for="(item, index) in statsList" :key="index">
          <div class="stat-icon" :style="{ background: item.color }">
            <el-icon :size="24" color="#fff"><component :is="item.icon" /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-label">{{ item.label }}</div>
            <div class="stat-value">{{ item.value }}</div>
          </div>
        </div>
      </div>
    </el-card>

    <el-card class="filter-card" shadow="never">
      <el-form :inline="true" :model="filterForm" class="filter-form">
        <el-form-item label="处方状态">
          <el-select v-model="filterForm.status" placeholder="全部状态" clearable style="width: 150px">
            <el-option label="待复核" value="待复核" />
            <el-option label="已通过" value="已通过" />
            <el-option label="已退回" value="已退回" />
            <el-option label="需补充" value="需补充" />
            <el-option label="已发药" value="已发药" />
          </el-select>
        </el-form-item>
        <el-form-item label="患者姓名">
          <el-input v-model="filterForm.patientName" placeholder="输入患者姓名" clearable style="width: 150px" />
        </el-form-item>
        <el-form-item label="日期范围">
          <el-date-picker
            v-model="filterForm.dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="YYYY-MM-DD"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadPrescriptions">
            <el-icon><Search /></el-icon>
            查询
          </el-button>
          <el-button @click="resetFilter">
            <el-icon><Refresh /></el-icon>
            重置
          </el-button>
          <el-button type="success" @click="handleExport">
            <el-icon><Download /></el-icon>
            导出报表
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card class="table-card" shadow="never">
      <el-table
        :data="prescriptions"
        style="width: 100%"
        v-loading="loading"
        row-key="_id"
      >
        <el-table-column prop="prescriptionNo" label="处方编号" width="200">
          <template #default="{ row }">
            <span class="prescription-no">{{ row.prescriptionNo }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="patientName" label="患者" width="100" />
        <el-table-column prop="doctorName" label="医生" width="100" />
        <el-table-column prop="diagnosis" label="诊断" min-width="180" show-overflow-tooltip />
        <el-table-column label="药品" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">
            <div v-for="(item, idx) in row.items" :key="idx" class="drug-item">
              {{ item.drugName }} {{ item.dosage }} {{ item.frequency }}
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)" size="small">
              {{ row.status }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="风险" width="100">
          <template #default="{ row }">
            <div v-if="row.risks && row.risks.length > 0">
              <el-tag
                v-if="row.risks.some(r => r.severity === '高')"
                type="danger"
                size="small"
                effect="dark"
              >
                高风险
              </el-tag>
              <el-tag
                v-else-if="row.risks.some(r => r.severity === '中')"
                type="warning"
                size="small"
              >
                中风险
              </el-tag>
              <el-tag v-else type="info" size="small">
                低风险
              </el-tag>
            </div>
            <el-tag v-else type="success" size="small">
              无风险
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="160">
          <template #default="{ row }">
            {{ formatDate(row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link @click="viewDetail(row)">
              <el-icon><View /></el-icon>
              详情
            </el-button>
            <el-button
              v-if="row.status === '已通过' && row.canDispense"
              type="success"
              link
              @click="handleDispense(row)"
            >
              <el-icon><Check /></el-icon>
              发药
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-container">
        <el-pagination
          v-model:current-page="pagination.current"
          v-model:page-size="pagination.pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="pagination.total"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
        />
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  getPrescriptions,
  getPrescriptionStats,
  reviewPrescription,
  exportReport
} from '../api'
import {
  Clock,
  CircleCheck,
  CircleClose,
  Warning,
  MedicineBox,
  Document,
  WarningFilled,
  DataLine
} from '@element-plus/icons-vue'

const router = useRouter()

const loading = ref(false)
const prescriptions = ref([])
const stats = ref({})

const filterForm = reactive({
  status: '',
  patientName: '',
  dateRange: []
})

const pagination = reactive({
  current: 1,
  pageSize: 10,
  total: 0
})

const statsList = computed(() => [
  {
    label: '待复核',
    value: stats.value.byStatus?.待复核 || 0,
    icon: Clock,
    color: '#e6a23c'
  },
  {
    label: '已通过',
    value: stats.value.byStatus?.已通过 || 0,
    icon: CircleCheck,
    color: '#67c23a'
  },
  {
    label: '已退回',
    value: stats.value.byStatus?.已退回 || 0,
    icon: CircleClose,
    color: '#f56c6c'
  },
  {
    label: '高风险',
    value: stats.value.highRisk || 0,
    icon: WarningFilled,
    color: '#c00'
  },
  {
    label: '今日新增',
    value: stats.value.todayNew || 0,
    icon: DataLine,
    color: '#409eff'
  }
])

const getStatusType = (status) => {
  const map = {
    '待复核': 'warning',
    '已通过': 'success',
    '已退回': 'danger',
    '需补充': 'info',
    '已发药': 'primary'
  }
  return map[status] || 'info'
}

const formatDate = (date) => {
  if (!date) return ''
  const d = new Date(date)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const loadStats = async () => {
  try {
    const res = await getPrescriptionStats()
    stats.value = res.data
  } catch (error) {
    console.error('加载统计数据失败:', error)
  }
}

const loadPrescriptions = async () => {
  loading.value = true
  try {
    const params = {
      page: pagination.current,
      limit: pagination.pageSize
    }
    if (filterForm.status) params.status = filterForm.status
    if (filterForm.patientName) params.patientName = filterForm.patientName
    if (filterForm.dateRange && filterForm.dateRange.length === 2) {
      params.startDate = filterForm.dateRange[0]
      params.endDate = filterForm.dateRange[1]
    }

    const res = await getPrescriptions(params)
    prescriptions.value = res.data.prescriptions
    pagination.total = res.data.pagination.total
  } catch (error) {
    ElMessage.error('加载处方列表失败')
  } finally {
    loading.value = false
  }
}

const resetFilter = () => {
  filterForm.status = ''
  filterForm.patientName = ''
  filterForm.dateRange = []
  pagination.current = 1
  loadPrescriptions()
}

const handleSizeChange = (val) => {
  pagination.pageSize = val
  loadPrescriptions()
}

const handleCurrentChange = (val) => {
  pagination.current = val
  loadPrescriptions()
}

const viewDetail = (row) => {
  router.push(`/prescriptions/${row._id}`)
}

const handleDispense = async (row) => {
  try {
    await ElMessageBox.confirm(
      `确认对处方 ${row.prescriptionNo} 执行发药操作？`,
      '发药确认',
      {
        confirmButtonText: '确认发药',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    await reviewPrescription(row._id, {
      action: '发药',
      reviewer: '当前药师',
      reason: '处方已通过复核，执行发药'
    })
    ElMessage.success('发药成功')
    loadPrescriptions()
    loadStats()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(error?.response?.data?.error || '发药失败')
    }
  }
}

const handleExport = async () => {
  try {
    const params = {}
    if (filterForm.status) params.status = filterForm.status
    if (filterForm.dateRange && filterForm.dateRange.length === 2) {
      params.startDate = filterForm.dateRange[0]
      params.endDate = filterForm.dateRange[1]
    }

    const res = await exportReport(params)
    const blob = new Blob([res.data], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `处方复核报表_${new Date().toISOString().slice(0, 10)}.xlsx`
    link.click()
    window.URL.revokeObjectURL(url)
    ElMessage.success('报表导出成功')
  } catch (error) {
    ElMessage.error('导出报表失败')
  }
}

onMounted(() => {
  loadStats()
  loadPrescriptions()
})
</script>

<style scoped>
.prescription-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.stats-card {
  border-radius: 8px;
}

.stats-container {
  display: flex;
  gap: 24px;
  flex-wrap: wrap;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 16px;
  flex: 1;
  min-width: 180px;
}

.stat-icon {
  width: 56px;
  height: 56px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.stat-content {
  display: flex;
  flex-direction: column;
}

.stat-label {
  font-size: 14px;
  color: #909399;
  margin-bottom: 4px;
}

.stat-value {
  font-size: 24px;
  font-weight: 600;
  color: #303133;
}

.filter-card {
  border-radius: 8px;
}

.filter-form {
  margin-bottom: 0;
}

.table-card {
  border-radius: 8px;
}

.prescription-no {
  font-family: 'Courier New', monospace;
  font-weight: 500;
}

.drug-item {
  font-size: 13px;
  line-height: 1.6;
}

.pagination-container {
  display: flex;
  justify-content: flex-end;
  margin-top: 20px;
}
</style>
