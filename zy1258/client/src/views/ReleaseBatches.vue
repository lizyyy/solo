<template>
  <div>
    <div class="page-header">
      <h2 class="page-title">发布批次</h2>
      <el-button type="primary" @click="refresh">
        <el-icon><Refresh /></el-icon>
        刷新
      </el-button>
    </div>

    <el-card>
      <el-table :data="batches" v-loading="loading" stripe>
        <el-table-column prop="version" label="版本" width="150">
          <template #default="{ row }">
            <el-tag type="primary">{{ row.version }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="commitHash" label="提交哈希" width="180">
          <template #default="{ row }">
            <span class="mono">{{ row.commitHash?.slice(0, 12) || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 'active' ? 'success' : 'info'">
              {{ row.status }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="资源统计" min-width="300">
          <template #default="{ row }">
            <div class="stats-inline">
              <span class="stat-item">
                <el-icon><Document /></el-icon>
                {{ row.resourceCount }}
              </span>
              <span class="stat-item">
                <el-icon><Connection /></el-icon>
                {{ row.hitChainCount }}
              </span>
              <span class="stat-item">
                <el-icon><User /></el-icon>
                {{ row.anomalyUserCount }}
              </span>
              <span class="stat-item">
                <el-icon><Delete /></el-icon>
                {{ row.purgeEventCount }}
              </span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="180">
          <template #default="{ row }">
            {{ formatTime(row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" size="small" @click="goToDetail(row.id)">
              详情
            </el-button>
            <el-button type="warning" size="small" @click="detectRisks(row.id)">
              检测风险
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { queryApi } from '../api'
import dayjs from 'dayjs'

const router = useRouter()
const loading = ref(false)
const batches = ref<any[]>([])

const loadBatches = async () => {
  loading.value = true
  try {
    const res = await queryApi.getReleaseBatches()
    if (res.data.success) {
      batches.value = res.data.data
    }
  } catch (error: any) {
    ElMessage.error('加载失败: ' + (error.message || '未知错误'))
  } finally {
    loading.value = false
  }
}

const goToDetail = (id: string) => {
  router.push(`/batches/${id}`)
}

const detectRisks = async (id: string) => {
  try {
    await ElMessageBox.confirm(
      '确定要对该版本执行风险检测吗？这将分析所有相关日志和资源。',
      '风险检测确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    const res = await queryApi.detectRisks(id)
    if (res.data.success) {
      ElMessage.success(`风险检测完成，共检测到 ${res.data.data.riskCount} 个风险`)
      router.push(`/tasks/${res.data.data.taskId}`)
    }
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error('风险检测失败: ' + (error.message || '未知错误'))
    }
  }
}

const refresh = () => {
  loadBatches()
}

const formatTime = (time: string) => {
  return dayjs(time).format('YYYY-MM-DD HH:mm:ss')
}

onMounted(() => {
  loadBatches()
})
</script>

<style scoped>
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.page-title {
  font-size: 24px;
  font-weight: bold;
  color: #303133;
  margin: 0;
}

.mono {
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 13px;
}

.stats-inline {
  display: flex;
  gap: 20px;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 5px;
  color: #606266;
  font-size: 14px;
}
</style>
