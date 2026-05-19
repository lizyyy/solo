<template>
  <div class="dashboard">
    <h2 class="page-title">数据概览</h2>
    
    <el-row :gutter="20" class="stats-row">
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-content">
            <div class="stat-icon blue">
              <el-icon><User /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ statistics.students?.total || 0 }}</div>
              <div class="stat-label">学员总数</div>
            </div>
          </div>
          <div class="stat-footer">
            <span class="text-success">完成: {{ statistics.students?.completed || 0 }}</span>
            <span class="text-warning ml-2">进行中: {{ statistics.students?.in_progress || 0 }}</span>
          </div>
        </el-card>
      </el-col>
      
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-content">
            <div class="stat-icon orange">
              <el-icon><Warning /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ statistics.remedial_tasks?.abnormal || 0 }}</div>
              <div class="stat-label">异常补学任务</div>
            </div>
          </div>
          <div class="stat-footer">
            <span class="text-warning">待处理: {{ statistics.remedial_tasks?.pending || 0 }}</span>
          </div>
        </el-card>
      </el-col>
      
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-content">
            <div class="stat-icon green">
              <el-icon><Medal /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ statistics.certificates?.eligible || 0 }}</div>
              <div class="stat-label">符合证书资格</div>
            </div>
          </div>
          <div class="stat-footer">
            <span class="text-info">人工确认: {{ statistics.certificates?.manually_confirmed || 0 }}</span>
          </div>
        </el-card>
      </el-col>
      
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-content">
            <div class="stat-icon red">
              <el-icon><CircleClose /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ statistics.errors || 0 }}</div>
              <div class="stat-label">错误总数</div>
            </div>
          </div>
          <div class="stat-footer">
            <span class="text-info">导出报表: {{ statistics.reports?.total || 0 }}</span>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" class="quick-actions">
      <el-col :span="24">
        <el-card>
          <template #header>
            <span>快捷操作</span>
          </template>
          <div class="action-buttons">
            <el-button type="primary" @click="goTo('/progress')">
              <el-icon><Search /></el-icon>
              查看学员进度
            </el-button>
            <el-button type="warning" @click="goTo('/remedial')">
              <el-icon><Check /></el-icon>
              处理补学任务
            </el-button>
            <el-button type="success" @click="goTo('/certificates')">
              <el-icon><Edit /></el-icon>
              确认证书资格
            </el-button>
            <el-button type="info" @click="goTo('/reports')">
              <el-icon><Download /></el-icon>
              导出报表
            </el-button>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { statisticsApi } from '@/api'
import { ElMessage } from 'element-plus'

const router = useRouter()
const statistics = ref({})

const loadStatistics = async () => {
  try {
    const response = await statisticsApi.get()
    if (response.data.success) {
      statistics.value = response.data.data
    }
  } catch (error) {
    ElMessage.error('加载统计数据失败')
  }
}

const goTo = (path) => {
  router.push(path)
}

onMounted(() => {
  loadStatistics()
})
</script>

<style scoped>
.dashboard {
  padding: 0;
}

.page-title {
  margin: 0 0 20px 0;
  font-size: 24px;
  font-weight: 600;
  color: #303133;
}

.stats-row {
  margin-bottom: 20px;
}

.stat-card {
  border-radius: 8px;
}

.stat-content {
  display: flex;
  align-items: center;
  margin-bottom: 15px;
}

.stat-icon {
  width: 50px;
  height: 50px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 15px;
  font-size: 24px;
  color: white;
}

.stat-icon.blue {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.stat-icon.orange {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
}

.stat-icon.green {
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
}

.stat-icon.red {
  background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
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
  margin-top: 5px;
}

.stat-footer {
  padding-top: 10px;
  border-top: 1px solid #f0f0f0;
  font-size: 13px;
}

.ml-2 {
  margin-left: 10px;
}

.quick-actions {
  margin-bottom: 20px;
}

.action-buttons {
  display: flex;
  gap: 15px;
  flex-wrap: wrap;
}
</style>
