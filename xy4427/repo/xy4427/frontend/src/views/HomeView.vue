<template>
  <div class="home-view">
    <el-row :gutter="20">
      <el-col :span="24">
        <el-card class="welcome-card">
          <template #header>
            <span class="card-title">欢迎使用盲文教材转印放行工具</span>
          </template>
          <div class="welcome-content">
            <p>本系统用于盲文教材制作过程中的质量控制和放行管理，主要功能包括：</p>
            <el-row :gutter="20" class="feature-row">
              <el-col :span="6">
                <div class="feature-item">
                  <el-icon size="48" color="#409EFF"><UploadFilled /></el-icon>
                  <h4>数据导入</h4>
                  <p>导入原文段落表、盲文点位校对记录、热压机温度曲线和学生试读反馈</p>
                </div>
              </el-col>
              <el-col :span="6">
                <div class="feature-item">
                  <el-icon size="48" color="#F56C6C"><WarningFilled /></el-icon>
                  <h4>风险检测</h4>
                  <p>自动检测漏译、点位冲突、热压温度漂移和同一页重复返工等风险</p>
                </div>
              </el-col>
              <el-col :span="6">
                <div class="feature-item">
                  <el-icon size="48" color="#E6A23C"><EditPen /></el-icon>
                  <h4>复核处理</h4>
                  <p>老师可以对检测出的风险进行改判并添加备注</p>
                </div>
              </el-col>
              <el-col :span="6">
                <div class="feature-item">
                  <el-icon size="48" color="#67C23A"><Download /></el-icon>
                  <h4>导出放行</h4>
                  <p>导出Markdown格式放行单和JSON审计包</p>
                </div>
              </el-col>
            </el-row>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" style="margin-top: 20px;">
      <el-col :span="6">
        <el-card class="stat-card" :body-style="{ padding: '20px' }">
          <div class="stat-content">
            <div class="stat-icon" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
              <el-icon size="32" color="white"><WarningFilled /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ riskStats.total }}</div>
              <div class="stat-label">总风险数</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card" :body-style="{ padding: '20px' }">
          <div class="stat-content">
            <div class="stat-icon" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);">
              <el-icon size="32" color="white"><Clock /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ riskStats.byStatus.pending }}</div>
              <div class="stat-label">待处理</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card" :body-style="{ padding: '20px' }">
          <div class="stat-content">
            <div class="stat-icon" style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);">
              <el-icon size="32" color="white"><CircleCheck /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ riskStats.byStatus.reviewed + riskStats.byStatus.overruled + riskStats.byStatus.resolved }}</div>
              <div class="stat-label">已处理</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card" :body-style="{ padding: '20px' }">
          <div class="stat-content">
            <div class="stat-icon" :style="canRelease ? 'background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);' : 'background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);'">
              <el-icon size="32" color="white"><Promotion /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ canRelease ? '是' : '否' }}</div>
              <div class="stat-label">可放行状态</div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" style="margin-top: 20px;">
      <el-col :span="12">
        <el-card>
          <template #header>
            <span class="card-title">风险类型分布</span>
          </template>
          <div class="chart-container">
            <div v-if="Object.keys(riskStats.byType).length > 0" class="type-list">
              <div v-for="(count, type) in riskStats.byType" :key="type" class="type-item">
                <div class="type-info">
                  <span class="type-name">{{ riskTypeNames[type] || type }}</span>
                  <span class="type-count">{{ count }} 项</span>
                </div>
                <el-progress :percentage="calculatePercentage(count)" :color="getTypeColor(type)" />
              </div>
            </div>
            <el-empty v-else description="暂无风险数据" />
          </div>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card>
          <template #header>
            <span class="card-title">快速操作</span>
          </template>
          <div class="quick-actions">
            <el-button type="primary" size="large" @click="goToImport" style="width: 100%; margin-bottom: 15px;">
              <el-icon class="mr-1"><UploadFilled /></el-icon>
              导入数据
            </el-button>
            <el-button type="warning" size="large" @click="goToRisks" style="width: 100%; margin-bottom: 15px;">
              <el-icon class="mr-1"><WarningFilled /></el-icon>
              检测风险
            </el-button>
            <el-button type="success" size="large" @click="goToExport" style="width: 100%;">
              <el-icon class="mr-1"><Download /></el-icon>
              导出放行单
            </el-button>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue'
import { useStore } from 'vuex'
import { useRouter } from 'vue-router'
import { riskApi } from '../api'

const riskTypeNames = {
  missing_translation: '漏译风险',
  point_conflict: '点位冲突风险',
  temperature_drift: '热压温度漂移风险',
  duplicate_rework: '同一页重复返工风险',
  other: '其他风险',
}

const typeColors = {
  missing_translation: '#F56C6C',
  point_conflict: '#E6A23C',
  temperature_drift: '#409EFF',
  duplicate_rework: '#909399',
  other: '#67C23A',
}

export default {
  name: 'HomeView',
  setup() {
    const store = useStore()
    const router = useRouter()
    
    const riskStats = ref({
      total: 0,
      byStatus: {
        pending: 0,
        reviewed: 0,
        overruled: 0,
        resolved: 0,
        ignored: 0,
      },
      byType: {},
    })

    const canRelease = computed(() => {
      return riskStats.value.byStatus.pending === 0
    })

    const calculatePercentage = (count) => {
      if (riskStats.value.total === 0) return 0
      return Math.round((count / riskStats.value.total) * 100)
    }

    const getTypeColor = (type) => {
      return typeColors[type] || '#409EFF'
    }

    const loadRiskStats = async () => {
      try {
        const response = await riskApi.getRiskStats()
        if (response.success) {
          riskStats.value = response.data
          store.dispatch('updateRiskStats', response.data)
        }
      } catch (error) {
        console.error('加载风险统计失败:', error)
      }
    }

    const goToImport = () => {
      router.push('/import')
    }

    const goToRisks = () => {
      router.push('/risks')
    }

    const goToExport = () => {
      router.push('/export')
    }

    onMounted(() => {
      loadRiskStats()
    })

    return {
      riskStats,
      canRelease,
      riskTypeNames,
      calculatePercentage,
      getTypeColor,
      goToImport,
      goToRisks,
      goToExport,
    }
  }
}
</script>

<style lang="scss" scoped>
.home-view {
  min-height: 100%;
}

.welcome-card {
  margin-bottom: 20px;
}

.card-title {
  font-size: 18px;
  font-weight: 600;
  color: #303133;
}

.welcome-content {
  color: #606266;
  line-height: 1.8;
}

.feature-row {
  margin-top: 20px;
}

.feature-item {
  text-align: center;
  padding: 20px;
  border-radius: 8px;
  background-color: #f5f7fa;
  transition: all 0.3s ease;

  &:hover {
    transform: translateY(-5px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  h4 {
    margin: 15px 0 10px;
    color: #303133;
    font-weight: 600;
  }

  p {
    font-size: 14px;
    color: #909399;
    margin: 0;
  }
}

.stat-card {
  border-radius: 8px;
  border: none;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.05);
}

.stat-content {
  display: flex;
  align-items: center;
}

.stat-icon {
  width: 60px;
  height: 60px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 16px;
}

.stat-info {
  flex: 1;
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
  color: #303133;
  line-height: 1;
}

.stat-label {
  font-size: 14px;
  color: #909399;
  margin-top: 8px;
}

.chart-container {
  min-height: 200px;
}

.type-list {
  .type-item {
    margin-bottom: 20px;

    &:last-child {
      margin-bottom: 0;
    }
  }

  .type-info {
    display: flex;
    justify-content: space-between;
    margin-bottom: 8px;
  }

  .type-name {
    font-size: 14px;
    color: #303133;
    font-weight: 500;
  }

  .type-count {
    font-size: 14px;
    color: #909399;
  }
}

.quick-actions {
  padding: 10px 0;
}

.mr-1 {
  margin-right: 4px;
}
</style>
