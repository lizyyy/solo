<template>
  <div class="overview-tab">
    <div class="overview-section" v-if="drill">
      <el-row :gutter="20">
        <el-col :span="6">
          <el-card class="stat-card">
            <div class="stat-content">
              <el-icon class="stat-icon" :size="32" :color="scoreColor"><DataAnalysis /></el-icon>
              <div class="stat-info">
                <div class="stat-value" :style="{ color: scoreColor }">
                  {{ overallScore }}
                </div>
                <div class="stat-label">综合评分</div>
              </div>
            </div>
          </el-card>
        </el-col>
        
        <el-col :span="6">
          <el-card class="stat-card">
            <div class="stat-content">
              <el-icon class="stat-icon warning" :size="32"><Warning /></el-icon>
              <div class="stat-info">
                <div class="stat-value">{{ bottleneckCount }}</div>
                <div class="stat-label">瓶颈问题</div>
              </div>
            </div>
          </el-card>
        </el-col>
        
        <el-col :span="6">
          <el-card class="stat-card">
            <div class="stat-content">
              <el-icon class="stat-icon success" :size="32"><Document /></el-icon>
              <div class="stat-info">
                <div class="stat-value">{{ drill.files?.length || 0 }}</div>
                <div class="stat-label">导入文件</div>
              </div>
            </div>
          </el-card>
        </el-col>
        
        <el-col :span="6">
          <el-card class="stat-card">
            <div class="stat-content">
              <el-icon class="stat-icon info" :size="32"><Timer /></el-icon>
              <div class="stat-info">
                <div class="stat-value">{{ formatDate(drill.created_at) }}</div>
                <div class="stat-label">创建时间</div>
              </div>
            </div>
          </el-card>
        </el-col>
      </el-row>
    </div>

    <el-card class="action-card" v-if="drill">
      <template #header>
        <div class="card-header">
          <span>操作</span>
        </div>
      </template>
      
      <div class="action-buttons">
        <el-button 
          type="primary" 
          size="large"
          @click="runAnalysis"
          :loading="analyzing"
          :disabled="drill.status === 'analyzed'"
        >
          <el-icon><Play /></el-icon>
          {{ drill.status === 'analyzed' ? '已完成分析' : '运行性能分析' }}
        </el-button>
        
        <el-button 
          size="large"
          @click="uploadMoreFiles"
        >
          <el-icon><Upload /></el-icon>
          上传更多文件
        </el-button>
      </div>
    </el-card>

    <el-card class="files-card" v-if="drill && drill.files">
      <template #header>
        <div class="card-header">
          <span>已导入文件</span>
          <el-tag type="info">{{ drill.files.length }} 个文件</el-tag>
        </div>
      </template>
      
      <el-table :data="drill.files" v-if="drill.files.length > 0">
        <el-table-column prop="file_name" label="文件名" min-width="250">
          <template #default="{ row }">
            <div class="file-name">
              <el-icon><Document /></el-icon>
              <span>{{ row.file_name }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="file_type" label="类型" width="120">
          <template #default="{ row }">
            <el-tag :type="getFileTypeColor(row.file_type)" size="small">
              {{ getFileTypeText(row.file_type) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="file_size" label="大小" width="100">
          <template #default="{ row }">
            {{ formatFileSize(row.file_size) }}
          </template>
        </el-table-column>
        <el-table-column prop="uploaded_at" label="上传时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.uploaded_at) }}
          </template>
        </el-table-column>
      </el-table>
      
      <el-empty v-else description="暂无导入文件" />
    </el-card>

    <el-card class="score-card" v-if="analysis">
      <template #header>
        <div class="card-header">
          <span>评分详情</span>
        </div>
      </template>
      
      <el-row :gutter="20">
        <el-col :span="8">
          <div class="score-item">
            <div class="score-label">慢查询问题</div>
            <el-progress 
              :percentage="getCategoryScore('慢查询')" 
              :color="getProgressColor(getCategoryScore('慢查询'))"
            />
          </div>
        </el-col>
        <el-col :span="8">
          <div class="score-item">
            <div class="score-label">索引问题</div>
            <el-progress 
              :percentage="getCategoryScore('索引')" 
              :color="getProgressColor(getCategoryScore('索引'))"
            />
          </div>
        </el-col>
        <el-col :span="8">
          <div class="score-item">
            <div class="score-label">连接池配置</div>
            <el-progress 
              :percentage="getCategoryScore('连接池')" 
              :color="getProgressColor(getCategoryScore('连接池'))"
            />
          </div>
        </el-col>
      </el-row>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, inject } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { drillApi, analysisApi } from '@/api'
import { ElMessage, ElMessageBox } from 'element-plus'
import dayjs from 'dayjs'

const route = useRoute()
const router = useRouter()

const drill = ref(null)
const analysis = ref(null)
const analyzing = ref(false)
const showUploadDialog = ref(false)

const overallScore = computed(() => {
  return analysis.value?.overall_score || analysis.value?.overallScore || 0
})

const scoreColor = computed(() => {
  const score = overallScore.value
  if (score >= 80) return '#67c23a'
  if (score >= 60) return '#e6a23c'
  return '#f56c6c'
})

const bottleneckCount = computed(() => {
  return analysis.value?.bottlenecks?.length || 0
})

const fetchDrill = async () => {
  try {
    const drillId = route.params.id
    const response = await drillApi.get(drillId)
    drill.value = response.data
    
    if (drill.value.status === 'analyzed') {
      try {
        const analysisResponse = await analysisApi.get(drillId)
        analysis.value = analysisResponse.data
      } catch (e) {
        console.log('暂无分析结果')
      }
    }
  } catch (error) {
    console.error('获取演练详情失败:', error)
  }
}

const runAnalysis = async () => {
  analyzing.value = true
  try {
    const drillId = route.params.id
    await analysisApi.run(drillId)
    ElMessage.success('分析完成')
    await fetchDrill()
    
    router.push({
      name: 'DrillAnalysis',
      params: { id: drillId }
    })
  } catch (error) {
    console.error('运行分析失败:', error)
    ElMessage.error('分析失败，请重试')
  } finally {
    analyzing.value = false
  }
}

const uploadMoreFiles = () => {
  showUploadDialog.value = true
}

const getFileTypeText = (type) => {
  const map = {
    'schema': 'Schema',
    'slow-log': '慢查询日志',
    'db-profile': '数据库配置',
    'write-sample': '写入样例',
    'json-data': 'JSON数据',
    'unknown': '未知'
  }
  return map[type] || type
}

const getFileTypeColor = (type) => {
  const map = {
    'schema': 'primary',
    'slow-log': 'danger',
    'db-profile': 'warning',
    'write-sample': 'success',
    'json-data': 'info',
    'unknown': ''
  }
  return map[type] || ''
}

const formatFileSize = (bytes) => {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let size = bytes
  let unitIndex = 0
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }
  return `${size.toFixed(2)} ${units[unitIndex]}`
}

const formatDate = (date) => {
  if (!date) return '-'
  return dayjs(date).format('YYYY-MM-DD HH:mm')
}

const getCategoryScore = (category) => {
  if (!analysis.value) return 100
  
  const bottlenecks = analysis.value.bottlenecks || []
  const categoryBottlenecks = bottlenecks.filter(b => 
    b.category?.includes(category) || b.description?.includes(category)
  )
  
  const severityMap = {
    critical: 20,
    high: 10,
    medium: 5,
    low: 2
  }
  
  let deduction = 0
  for (const b of categoryBottlenecks) {
    deduction += severityMap[b.severity] || 5
  }
  
  return Math.max(0, 100 - deduction)
}

const getProgressColor = (score) => {
  if (score >= 80) return '#67c23a'
  if (score >= 60) return '#e6a23c'
  return '#f56c6c'
}

onMounted(() => {
  fetchDrill()
})
</script>

<style scoped>
.overview-tab {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.stat-card {
  border-radius: 8px;
}

.stat-content {
  display: flex;
  align-items: center;
  gap: 16px;
}

.stat-icon {
  color: #409eff;
}

.stat-icon.success {
  color: #67c23a;
}

.stat-icon.warning {
  color: #e6a23c;
}

.stat-icon.info {
  color: #909399;
}

.stat-info {
  display: flex;
  flex-direction: column;
}

.stat-value {
  font-size: 28px;
  font-weight: 600;
  line-height: 1.2;
}

.stat-label {
  font-size: 14px;
  color: #909399;
  margin-top: 4px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.action-buttons {
  display: flex;
  gap: 16px;
}

.file-name {
  display: flex;
  align-items: center;
  gap: 8px;
}

.score-item {
  padding: 10px 0;
}

.score-label {
  font-size: 14px;
  color: #606266;
  margin-bottom: 8px;
}
</style>
