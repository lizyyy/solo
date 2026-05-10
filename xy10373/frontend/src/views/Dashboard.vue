<template>
  <div class="dashboard">
    <el-row :gutter="20">
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-content">
            <div class="stat-icon patient">
              <el-icon size="32"><UserFilled /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ statistics?.patients?.active || 0 }}</div>
              <div class="stat-label">在院患者</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-content">
            <div class="stat-icon certificate">
              <el-icon size="32"><DocumentChecked /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ statistics?.certificates?.active || 0 }}</div>
              <div class="stat-label">有效证件</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card warning">
          <div class="stat-content">
            <div class="stat-icon expiring">
              <el-icon size="32"><AlarmClock /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ statistics?.certificates?.expiring_soon || 0 }}</div>
              <div class="stat-label">即将过期</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card danger">
          <div class="stat-content">
            <div class="stat-icon pending">
              <el-icon size="32"><RefreshRight /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ statistics?.replacements?.pending || 0 }}</div>
              <div class="stat-label">待审批换人</div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" style="margin-top: 20px">
      <el-col :span="12">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>快速操作</span>
            </div>
          </template>
          <div class="quick-actions">
            <el-button type="primary" @click="$router.push('/certificates')" size="large">
              <el-icon><Plus /></el-icon>
              办理新证
            </el-button>
            <el-button type="success" @click="$router.push('/replacements')" size="large">
              <el-icon><RefreshRight /></el-icon>
              换人申请
            </el-button>
            <el-button type="warning" @click="$router.push('/expiring')" size="large">
              <el-icon><AlarmClock /></el-icon>
              查看过期
            </el-button>
            <el-button type="info" @click="$router.push('/audit')" size="large">
              <el-icon><Download /></el-icon>
              审计导出
            </el-button>
          </div>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>今日操作统计</span>
            </div>
          </template>
          <el-descriptions :column="2" border>
            <el-descriptions-item label="今日操作数">{{ statistics?.operations?.today || 0 }}</el-descriptions-item>
            <el-descriptions-item label="失败操作">{{ statistics?.operations?.failed || 0 }}</el-descriptions-item>
            <el-descriptions-item label="总证件数">{{ statistics?.certificates?.total || 0 }}</el-descriptions-item>
            <el-descriptions-item label="已过期">{{ statistics?.certificates?.expired || 0 }}</el-descriptions-item>
          </el-descriptions>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" style="margin-top: 20px">
      <el-col :span="24">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>最近操作日志</span>
              <el-button text type="primary" @click="$router.push('/audit')">查看全部</el-button>
            </div>
          </template>
          <el-table :data="recentLogs" v-loading="loading">
            <el-table-column prop="created_at" label="时间" width="180">
              <template #default="{ row }">
                {{ formatDate(row.created_at) }}
              </template>
            </el-table-column>
            <el-table-column prop="operation_type" label="类型" width="120">
              <template #default="{ row }">
                <el-tag :type="getOperationType(row.operation_type)?.type">
                  {{ getOperationType(row.operation_type)?.label }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="patient_name" label="患者" width="100" />
            <el-table-column prop="operator" label="操作员" width="100" />
            <el-table-column prop="action" label="操作内容" show-overflow-tooltip />
            <el-table-column prop="source_file" label="来源文件" width="150" show-overflow-tooltip />
            <el-table-column prop="result" label="结果" width="80">
              <template #default="{ row }">
                <el-tag :type="row.result === 'success' ? 'success' : 'danger'" size="small">
                  {{ row.result === 'success' ? '成功' : '失败' }}
                </el-tag>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '@/api'
import { operationTypeMap } from '@/utils/status'
import dayjs from 'dayjs'
import { UserFilled, DocumentChecked, AlarmClock, RefreshRight, Plus, Download } from '@element-plus/icons-vue'

const statistics = ref(null)
const recentLogs = ref([])
const loading = ref(false)

const formatDate = (date) => {
  return dayjs(date).format('YYYY-MM-DD HH:mm:ss')
}

const getOperationType = (type) => {
  return operationTypeMap[type] || { label: type, type: 'info' }
}

const loadData = async () => {
  loading.value = true
  try {
    const [statsRes, logsRes] = await Promise.all([
      api.audit.statistics(),
      api.audit.logs({ limit: 10 })
    ])
    statistics.value = statsRes.data
    recentLogs.value = logsRes.data
  } catch (error) {
    console.error('加载数据失败:', error)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadData()
})
</script>

<style scoped>
.stat-card {
  border-radius: 8px;
  overflow: hidden;
}

.stat-card :deep(.el-card__body) {
  padding: 20px;
}

.stat-content {
  display: flex;
  align-items: center;
  gap: 15px;
}

.stat-icon {
  width: 60px;
  height: 60px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
}

.stat-icon.patient {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.stat-icon.certificate {
  background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
}

.stat-icon.expiring {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
}

.stat-icon.pending {
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
}

.stat-info .stat-value {
  font-size: 28px;
  font-weight: bold;
  color: #303133;
}

.stat-info .stat-label {
  font-size: 14px;
  color: #909399;
  margin-top: 5px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: bold;
}

.quick-actions {
  display: flex;
  gap: 15px;
  flex-wrap: wrap;
}
</style>
