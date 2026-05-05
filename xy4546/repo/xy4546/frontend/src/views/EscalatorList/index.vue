<template>
  <div class="escalator-container">
    <el-card>
      <template #header>
        <span class="card-title">扶梯列表</span>
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
        <el-form-item label="状态">
          <el-select v-model="searchForm.status" placeholder="全部状态" clearable style="width: 120px">
            <el-option label="正常" value="normal" />
            <el-option label="异常" value="abnormal" />
            <el-option label="停用" value="stopped" />
          </el-select>
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
        :data="escalatorList"
        v-loading="loading"
        style="width: 100%"
      >
        <el-table-column prop="station_name" label="站点" width="130" />
        <el-table-column prop="escalator_code" label="扶梯编号" width="120" />
        <el-table-column prop="location" label="位置" width="150" />
        <el-table-column prop="manufacturer" label="制造商" width="120" />
        <el-table-column prop="install_date" label="安装日期" width="120" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusTagType(row.status)">
              {{ getStatusName(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="待处理风险" width="120">
          <template #default="{ row }">
            <el-tag v-if="row.pendingRiskCount > 0" type="danger">
              {{ row.pendingRiskCount }} 项
            </el-tag>
            <span v-else class="text-gray">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="updated_at" label="更新时间" width="170" />
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="handleViewDetail(row)">
              详情
            </el-button>
            <el-button type="warning" link size="small" @click="viewRisks(row)">
              风险
            </el-button>
            <el-button type="success" link size="small" @click="exportDetail(row)">
              导出JSON
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
      title="扶梯详情"
      width="900px"
      :close-on-click-modal="false"
    >
      <el-descriptions :column="3" border v-if="currentEscalator">
        <el-descriptions-item label="站点">{{ currentEscalator.station_name || '-' }}</el-descriptions-item>
        <el-descriptions-item label="扶梯编号">{{ currentEscalator.escalator_code }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="getStatusTagType(currentEscalator.status)">
            {{ getStatusName(currentEscalator.status) }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="位置">{{ currentEscalator.location || '-' }}</el-descriptions-item>
        <el-descriptions-item label="制造商">{{ currentEscalator.manufacturer || '-' }}</el-descriptions-item>
        <el-descriptions-item label="安装日期">{{ currentEscalator.install_date || '-' }}</el-descriptions-item>
      </el-descriptions>

      <el-divider>最新巡检记录</el-divider>
      <el-table :data="[currentEscalator.latestInspection].filter(Boolean)" style="width: 100%" v-if="currentEscalator.latestInspection">
        <el-table-column prop="inspection_date" label="巡检日期" width="120" />
        <el-table-column prop="inspector" label="巡检员" width="100" />
        <el-table-column prop="overall_status" label="整体状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.overall_status === 'normal' ? 'success' : 'warning'" size="small">
              {{ row.overall_status === 'normal' ? '正常' : '异常' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="issues" label="问题" min-width="200" />
        <el-table-column prop="remarks" label="备注" min-width="200" />
      </el-table>
      <el-empty v-else description="暂无巡检记录" />

      <el-divider>最新电流数据</el-divider>
      <el-descriptions :column="3" v-if="currentEscalator.latestCurrentLog">
        <el-descriptions-item label="记录时间">{{ currentEscalator.latestCurrentLog.log_time }}</el-descriptions-item>
        <el-descriptions-item label="A相电流">{{ currentEscalator.latestCurrentLog.phase_a_current || 0 }} A</el-descriptions-item>
        <el-descriptions-item label="B相电流">{{ currentEscalator.latestCurrentLog.phase_b_current || 0 }} A</el-descriptions-item>
        <el-descriptions-item label="C相电流">{{ currentEscalator.latestCurrentLog.phase_c_current || 0 }} A</el-descriptions-item>
        <el-descriptions-item label="平均电流">{{ currentEscalator.latestCurrentLog.average_current || 0 }} A</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="currentEscalator.latestCurrentLog.is_overload ? 'danger' : 'success'" size="small">
            {{ currentEscalator.latestCurrentLog.is_overload ? '超载' : '正常' }}
          </el-tag>
        </el-descriptions-item>
      </el-descriptions>
      <el-empty v-else description="暂无电流数据" />

      <el-divider>待处理报修</el-divider>
      <el-table :data="currentEscalator.pendingRepairs || []" style="width: 100%" v-if="currentEscalator.pendingRepairs && currentEscalator.pendingRepairs.length > 0">
        <el-table-column prop="report_time" label="报修时间" width="170" />
        <el-table-column prop="reporter_name" label="报修人" width="100" />
        <el-table-column prop="fault_description" label="故障描述" min-width="250" />
        <el-table-column prop="severity" label="严重程度" width="100">
          <template #default="{ row }">
            <el-tag :type="getSeverityTagType(row.severity)" size="small">
              {{ row.severity || '-' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="handle_status" label="处理状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getHandleStatusTagType(row.handle_status)" size="small">
              {{ getHandleStatusName(row.handle_status) }}
            </el-tag>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-else description="暂无待处理报修" />

      <el-divider>未解决维保</el-divider>
      <el-table :data="currentEscalator.unresolvedMaintenance || []" style="width: 100%" v-if="currentEscalator.unresolvedMaintenance && currentEscalator.unresolvedMaintenance.length > 0">
        <el-table-column prop="call_time" label="召修时间" width="170" />
        <el-table-column prop="technician_name" label="技术人员" width="100" />
        <el-table-column prop="fault_description" label="故障描述" min-width="250" />
        <el-table-column prop="maintenance_type" label="维保类型" width="120" />
        <el-table-column prop="arrival_time" label="到达时间" width="170" />
      </el-table>
      <el-empty v-else description="暂无未解决维保" />

      <el-divider>待处理风险</el-divider>
      <el-table :data="currentEscalator.risks || []" style="width: 100%" v-if="currentEscalator.risks && currentEscalator.risks.length > 0">
        <el-table-column prop="risk_type" label="风险类型" width="130">
          <template #default="{ row }">
            <el-tag :type="getRiskTypeTagType(row.risk_type)" size="small">
              {{ getRiskTypeName(row.risk_type) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="risk_level" label="风险等级" width="100">
          <template #default="{ row }">
            <el-tag :type="getRiskLevelTagType(row.risk_level)" size="small">
              {{ getRiskLevelName(row.risk_level) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="description" label="描述" min-width="250" />
        <el-table-column prop="detected_time" label="检测时间" width="170" />
        <el-table-column prop="is_reopened" label="状态" width="120">
          <template #default="{ row }">
            <el-tag v-if="row.is_reopened" type="danger" effect="dark" size="small">
              重启后仍在
            </el-tag>
            <span v-else class="text-gray">-</span>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-else description="暂无待处理风险" />
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { escalatorApi, exportApi } from '@/api'

const router = useRouter()
const loading = ref(false)
const escalatorList = ref([])
const stations = ref([])

const searchForm = reactive({
  station_name: '',
  status: ''
})

const pagination = reactive({
  page: 1,
  page_size: 20,
  total: 0
})

const detailDialogVisible = ref(false)
const currentEscalator = ref(null)

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
  normal: '正常',
  abnormal: '异常',
  stopped: '停用'
}

const handleStatusNames = {
  pending: '待处理',
  processing: '处理中',
  resolved: '已解决'
}

const loadEscalators = async () => {
  loading.value = true
  try {
    const params = {
      page: pagination.page,
      page_size: pagination.page_size,
      ...searchForm
    }
    
    if (!params.station_name) delete params.station_name
    if (!params.status) delete params.status

    const res = await escalatorApi.getList(params)
    if (res.data.success) {
      escalatorList.value = res.data.data.escalators.map(item => ({
        ...item,
        pendingRiskCount: 0
      }))
      pagination.total = res.data.data.pagination.total
    }
  } catch (error) {
    console.error('加载扶梯列表失败:', error)
    ElMessage.error('加载扶梯列表失败: ' + (error.message || error))
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
  loadEscalators()
}

const handleReset = () => {
  searchForm.station_name = ''
  searchForm.status = ''
  pagination.page = 1
  loadEscalators()
}

const handleSizeChange = (val) => {
  pagination.page_size = val
  pagination.page = 1
  loadEscalators()
}

const handleCurrentChange = (val) => {
  pagination.page = val
  loadEscalators()
}

const handleViewDetail = async (row) => {
  currentEscalator.value = null
  detailDialogVisible.value = true

  try {
    const res = await escalatorApi.getByCode(row.escalator_code)
    if (res.data.success) {
      currentEscalator.value = res.data.data
    }
  } catch (error) {
    console.error('加载扶梯详情失败:', error)
    ElMessage.error('加载扶梯详情失败: ' + (error.message || error))
  }
}

const viewRisks = (row) => {
  router.push({
    path: '/risk',
    query: {
      escalator_code: row.escalator_code
    }
  })
}

const exportDetail = async (row) => {
  try {
    const res = await exportApi.getEscalatorDetailJson(row.escalator_code)
    if (res.data.success) {
      const blob = new Blob([JSON.stringify(res.data.data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `escalator-${row.escalator_code}-detail-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      ElMessage.success('导出成功')
    }
  } catch (error) {
    console.error('导出失败:', error)
    ElMessage.error('导出失败: ' + (error.message || error))
  }
}

const getStatusName = (status) => statusNames[status] || status
const getHandleStatusName = (status) => handleStatusNames[status] || status
const getRiskTypeName = (type) => riskTypeNames[type] || type
const getRiskLevelName = (level) => riskLevelNames[level] || level

const getStatusTagType = (status) => {
  const map = {
    normal: 'success',
    abnormal: 'warning',
    stopped: 'danger'
  }
  return map[status] || ''
}

const getSeverityTagType = (severity) => {
  const map = {
    严重: 'danger',
    high: 'danger',
    中等: 'warning',
    medium: 'warning',
    轻微: 'info',
    low: 'info'
  }
  return map[severity] || ''
}

const getHandleStatusTagType = (status) => {
  const map = {
    pending: 'warning',
    processing: 'primary',
    resolved: 'success'
  }
  return map[status] || ''
}

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

onMounted(() => {
  loadStations()
  loadEscalators()
})
</script>

<style lang="scss" scoped>
.escalator-container {
  .card-title {
    font-size: 16px;
    font-weight: 500;
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
