<template>
  <div class="dashboard-container">
    <el-row :gutter="20" class="stats-row">
      <el-col :span="6">
        <el-card class="stat-card critical">
          <div class="stat-content">
            <div class="stat-icon">
              <el-icon size="40"><Warning /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ statistics.totalRisks || 0 }}</div>
              <div class="stat-label">风险总数</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card warning">
          <div class="stat-content">
            <div class="stat-icon">
              <el-icon size="40"><Clock /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ statistics.pendingRisks || 0 }}</div>
              <div class="stat-label">待处理风险</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card danger">
          <div class="stat-content">
            <div class="stat-icon">
              <el-icon size="40"><RefreshRight /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ statistics.reopenedRisks || 0 }}</div>
              <div class="stat-label">重启后仍存在</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card info">
          <div class="stat-content">
            <div class="stat-icon">
              <el-icon size="40"><SetUp /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ statistics.escalatorsWithRisks || 0 }}</div>
              <div class="stat-label">涉及扶梯数</div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" class="charts-row">
      <el-col :span="12">
        <el-card>
          <template #header>
            <span class="card-title">风险类型分布</span>
          </template>
          <el-table :data="riskByTypeList" style="width: 100%">
            <el-table-column prop="name" label="风险类型" width="150" />
            <el-table-column prop="count" label="数量" width="100" />
            <el-table-column label="占比">
              <template #default="{ row }">
                <el-progress 
                  :percentage="getPercentage(row.count, statistics.totalRisks)" 
                  :status="getStatusByType(row.risk_type)"
                  :stroke-width="10"
                />
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card>
          <template #header>
            <span class="card-title">风险等级分布</span>
          </template>
          <el-table :data="riskByLevelList" style="width: 100%">
            <el-table-column prop="name" label="风险等级" width="150" />
            <el-table-column prop="count" label="数量" width="100" />
            <el-table-column label="占比">
              <template #default="{ row }">
                <el-progress 
                  :percentage="getPercentage(row.count, statistics.totalRisks)" 
                  :status="getStatusByLevel(row.risk_level)"
                  :stroke-width="10"
                />
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" class="quick-actions-row">
      <el-col :span="24">
        <el-card>
          <template #header>
            <span class="card-title">快捷操作</span>
          </template>
          <el-row :gutter="20">
            <el-col :span="6">
              <el-button type="primary" size="large" style="width: 100%" @click="goToImport">
                <el-icon><Upload /></el-icon>
                数据导入
              </el-button>
            </el-col>
            <el-col :span="6">
              <el-button type="warning" size="large" style="width: 100%" @click="goToRisk">
                <el-icon><Warning /></el-icon>
                查看风险
              </el-button>
            </el-col>
            <el-col :span="6">
              <el-button type="success" size="large" style="width: 100%" @click="goToExport">
                <el-icon><Download /></el-icon>
                导出报告
              </el-button>
            </el-col>
            <el-col :span="6">
              <el-button type="danger" size="large" style="width: 100%" @click="handleDetect">
                <el-icon><Search /></el-icon>
                风险检测
              </el-button>
            </el-col>
          </el-row>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { riskApi } from '@/api'

const router = useRouter()
const statistics = ref({
  totalRisks: 0,
  pendingRisks: 0,
  reopenedRisks: 0,
  escalatorsWithRisks: 0
})

const riskByTypeList = ref([])
const riskByLevelList = ref([])
const detecting = ref(false)

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

const loadStatistics = async () => {
  try {
    const res = await riskApi.getStatistics()
    if (res.data.success) {
      const data = res.data.data
      statistics.value = {
        totalRisks: data.totalRisks || 0,
        pendingRisks: data.pendingRisks || 0,
        reopenedRisks: data.reopenedRisks || 0,
        escalatorsWithRisks: data.escalatorsWithRisks || 0
      }

      riskByTypeList.value = (data.riskByType || []).map(item => ({
        ...item,
        name: riskTypeNames[item.risk_type] || item.risk_type
      }))

      riskByLevelList.value = (data.riskByLevel || []).map(item => ({
        ...item,
        name: riskLevelNames[item.risk_level] || item.risk_level
      }))
    }
  } catch (error) {
    console.error('加载统计数据失败:', error)
  }
}

const getPercentage = (count, total) => {
  if (total === 0) return 0
  return Math.round((count / total) * 100)
}

const getStatusByType = (type) => {
  const statusMap = {
    frequent_stop: 'exception',
    overload_false_alarm: 'warning',
    long_unreset: 'exception',
    maintenance_timeout: 'warning'
  }
  return statusMap[type] || ''
}

const getStatusByLevel = (level) => {
  const statusMap = {
    critical: 'exception',
    high: 'exception',
    medium: 'warning',
    low: ''
  }
  return statusMap[level] || ''
}

const goToImport = () => {
  router.push('/import')
}

const goToRisk = () => {
  router.push('/risk')
}

const goToExport = () => {
  router.push('/export')
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

    detecting.value = true
    const res = await riskApi.detect({})
    
    if (res.data.success) {
      ElMessage.success(`检测完成，发现 ${res.data.data.count} 个风险`)
      loadStatistics()
    }
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('风险检测失败: ' + (error.message || error))
    }
  } finally {
    detecting.value = false
  }
}

onMounted(() => {
  loadStatistics()
})
</script>

<style lang="scss" scoped>
.dashboard-container {
  .stats-row {
    margin-bottom: 20px;

    .stat-card {
      border-radius: 8px;
      transition: transform 0.3s;

      &:hover {
        transform: translateY(-5px);
      }

      &.critical {
        .stat-icon {
          background: linear-gradient(135deg, #f56c6c, #c45656);
        }
      }

      &.warning {
        .stat-icon {
          background: linear-gradient(135deg, #e6a23c, #c9942e);
        }
      }

      &.danger {
        .stat-icon {
          background: linear-gradient(135deg, #f56c6c, #909399);
        }
      }

      &.info {
        .stat-icon {
          background: linear-gradient(135deg, #409eff, #3078c5);
        }
      }

      .stat-content {
        display: flex;
        align-items: center;

        .stat-icon {
          width: 60px;
          height: 60px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
        }

        .stat-info {
          margin-left: 20px;

          .stat-value {
            font-size: 28px;
            font-weight: bold;
            color: #303133;
          }

          .stat-label {
            font-size: 14px;
            color: #909399;
            margin-top: 5px;
          }
        }
      }
    }
  }

  .charts-row {
    margin-bottom: 20px;

    .card-title {
      font-size: 16px;
      font-weight: 500;
    }
  }

  .quick-actions-row {
    .card-title {
      font-size: 16px;
      font-weight: 500;
    }
  }
}
</style>
