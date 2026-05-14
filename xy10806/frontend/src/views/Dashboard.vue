<template>
  <div>
    <el-page-header title="仪表盘" content="OAuth 授权撤回中心概览" />
    
    <el-row :gutter="16" style="margin-top: 24px">
      <el-col :span="6">
        <el-card>
          <div class="stat-item">
            <span class="stat-icon" style="color: #409eff"><el-icon><DataLine /></el-icon></span>
            <div>
              <div class="stat-value">{{ stats.applications }}</div>
              <div class="stat-label">应用总数</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card>
          <div class="stat-item">
            <span class="stat-icon" style="color: #67c23a"><el-icon><CircleCheck /></el-icon></span>
            <div>
              <div class="stat-value">{{ stats.active_consents }}</div>
              <div class="stat-label">有效授权</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card>
          <div class="stat-item">
            <span class="stat-icon" style="color: #e6a23c"><el-icon><VideoPause /></el-icon></span>
            <div>
              <div class="stat-value">{{ stats.revoked_consents }}</div>
              <div class="stat-label">已撤回授权</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card>
          <div class="stat-item">
            <span class="stat-icon" style="color: #409eff"><el-icon><Key /></el-icon></span>
            <div>
              <div class="stat-value">{{ stats.valid_tokens }}</div>
              <div class="stat-label">有效令牌</div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="16" style="margin-top: 16px">
      <el-col :span="6">
        <el-card>
          <div class="stat-item">
            <span class="stat-icon" style="color: #f56c6c"><el-icon><Lock /></el-icon></span>
            <div>
              <div class="stat-value">{{ stats.revoked_tokens }}</div>
              <div class="stat-label">已撤回令牌</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card>
          <div class="stat-item">
            <span class="stat-icon" style="color: #909399"><el-icon><Timer /></el-icon></span>
            <div>
              <div class="stat-value">{{ stats.pending_tasks }}</div>
              <div class="stat-label">待执行任务</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card>
          <div class="stat-item">
            <span class="stat-icon" style="color: #f56c6c"><el-icon><VideoPause /></el-icon></span>
            <div>
              <div class="stat-value">{{ stats.intercepted_tasks }}</div>
              <div class="stat-label">已拦截任务</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card>
          <div class="stat-item">
            <span class="stat-icon" style="color: #67c23a"><el-icon><CircleCheck /></el-icon></span>
            <div>
              <div class="stat-value">{{ completionRate }}%</div>
              <div class="stat-label">撤回完成率</div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-card title="快速操作" style="margin-top: 24px">
      <el-space wrap>
        <el-button type="primary" @click="$router.push('/applications')">
          查看应用
        </el-button>
        <el-button @click="$router.push('/tokens')">
          令牌管理
        </el-button>
        <el-button @click="$router.push('/revocations')">
          撤回记录
        </el-button>
        <el-button type="info" @click="exportRevocations">
          导出撤回记录
        </el-button>
      </el-space>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { DataLine, CircleCheck, VideoPause, Key, Lock, Timer } from '@element-plus/icons-vue'

const router = useRouter()
const stats = ref({
  applications: 0,
  active_consents: 0,
  revoked_consents: 0,
  valid_tokens: 0,
  revoked_tokens: 0,
  pending_tasks: 0,
  intercepted_tasks: 0,
  total_revocations: 0,
  completed_revocations: 0
})

const completionRate = computed(() => {
  if (stats.value.total_revocations === 0) return 0
  return Math.round((stats.value.completed_revocations / stats.value.total_revocations) * 100)
})

const fetchStats = async () => {
  try {
    const res = await axios.get('/api/dashboard/stats')
    stats.value = res.data
  } catch (err) {
    console.error('Failed to fetch stats:', err)
  }
}

const exportRevocations = () => {
  window.open('/api/export/revocations', '_blank')
}

onMounted(() => {
  fetchStats()
})
</script>

<style scoped>
.stat-item {
  display: flex;
  align-items: center;
  gap: 16px;
}
.stat-icon {
  font-size: 32px;
}
.stat-value {
  font-size: 28px;
  font-weight: bold;
  color: #303133;
}
.stat-label {
  font-size: 14px;
  color: #909399;
}
</style>
