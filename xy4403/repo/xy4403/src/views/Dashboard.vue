<template>
  <div>
    <div class="page-header">
      <h2 class="page-title">仪表盘</h2>
    </div>

    <el-row :gutter="20" style="margin-bottom: 20px;">
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-content">
            <div class="stat-value">{{ stats.totalBatches }}</div>
            <div class="stat-label">总批次</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-content">
            <div class="stat-value">{{ stats.totalAppointments }}</div>
            <div class="stat-label">总预约</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-content">
            <div class="stat-value">{{ stats.activeChemicals }}</div>
            <div class="stat-label">活跃药液</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-content">
            <div class="stat-value">{{ stats.availableBags }}</div>
            <div class="stat-label">可用暗袋</div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20">
      <el-col :span="16">
        <el-card class="card-container">
          <template #header>
            <span>最近批次</span>
          </template>
          <el-table :data="recentBatches" style="width: 100%">
            <el-table-column prop="batch_number" label="批次编号" width="150" />
            <el-table-column prop="created_at" label="创建时间" width="180">
              <template #default="scope">
                {{ formatDate(scope.row.created_at) }}
              </template>
            </el-table-column>
            <el-table-column prop="status" label="状态" width="100">
              <template #default="scope">
                <el-tag :type="getStatusType(scope.row.status)">
                  {{ getStatusText(scope.row.status) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="120">
              <template #default="scope">
                <el-button type="primary" link @click="viewBatch(scope.row)">
                  查看详情
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card class="card-container">
          <template #header>
            <span>待取片预约</span>
          </template>
          <el-table :data="pendingPickup" style="width: 100%">
            <el-table-column prop="student_name" label="学生姓名" width="100" />
            <el-table-column prop="film_type" label="胶片类型" width="80" />
            <el-table-column prop="film_count" label="数量" width="60" />
          </el-table>
        </el-card>
      </el-col>
    </el-row>

    <div v-if="violations.length > 0" class="violation-warning">
      <div class="warning-title">
        <el-icon><Warning /></el-icon>
        规则违规警告
      </div>
      <div v-for="(v, idx) in violations" :key="idx" class="warning-item">
        {{ idx + 1 }}. {{ v.message }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Warning } from '@element-plus/icons-vue'

const router = useRouter()

const stats = ref({
  totalBatches: 0,
  totalAppointments: 0,
  activeChemicals: 0,
  availableBags: 0
})

const recentBatches = ref([])
const pendingPickup = ref([])
const violations = ref([])

const formatDate = (dateStr) => {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleString('zh-CN')
}

const getStatusType = (status) => {
  const types = {
    'processing': 'primary',
    'ready': 'success',
    'completed': 'info',
    'pending': 'warning'
  }
  return types[status] || 'info'
}

const getStatusText = (status) => {
  const texts = {
    'processing': '处理中',
    'ready': '可放行',
    'completed': '已完成',
    'pending': '待处理'
  }
  return texts[status] || status
}

const viewBatch = (batch) => {
  router.push(`/batches`)
}

const loadDashboard = async () => {
  try {
    const batches = await window.electronAPI.getBatches()
    const appointments = await window.electronAPI.getAllAppointments()
    const chemicals = await window.electronAPI.getActiveChemicals()
    const darkBags = await window.electronAPI.getAllDarkBags()

    stats.value.totalBatches = batches.length
    stats.value.totalAppointments = appointments.length
    stats.value.activeChemicals = chemicals.length
    stats.value.availableBags = darkBags.filter(b => b.status === 'available').length

    recentBatches.value = batches.slice(0, 5)
    pendingPickup.value = appointments.filter(a => a.status === 'ready' || a.status === 'processing').slice(0, 5)

    const allViolations = []
    for (const batch of batches.slice(0, 3)) {
      const batchViolations = await window.electronAPI.checkRulesForBatch(batch.id)
      allViolations.push(...batchViolations)
    }
    violations.value = [...new Set(allViolations.map(v => JSON.stringify(v)))].map(v => JSON.parse(v)).slice(0, 5)

  } catch (error) {
    ElMessage.error('加载仪表盘数据失败: ' + error.message)
  }
}

onMounted(() => {
  loadDashboard()
})
</script>

<style scoped>
.stat-card {
  text-align: center;
}

.stat-content {
  padding: 10px 0;
}

.stat-value {
  font-size: 36px;
  font-weight: 600;
  color: #409EFF;
}

.stat-label {
  font-size: 14px;
  color: #909399;
  margin-top: 8px;
}

.warning-title {
  display: flex;
  align-items: center;
  gap: 5px;
}
</style>
