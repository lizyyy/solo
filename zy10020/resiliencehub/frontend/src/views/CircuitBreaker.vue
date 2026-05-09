<template>
  <div class="circuit-breaker">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>创建熔断器</span>
        </div>
      </template>
      <el-form :model="cbForm" label-width="180px" inline>
        <el-form-item label="服务名称">
          <el-input v-model="cbForm.name" placeholder="例如: orderService" />
        </el-form-item>
        <el-form-item label="滑动窗口大小">
          <el-input-number v-model="cbForm.slidingWindowSize" :min="10" :max="1000" />
        </el-form-item>
        <el-form-item label="最小调用数">
          <el-input-number v-model="cbForm.minimumNumberOfCalls" :min="1" :max="100" />
        </el-form-item>
        <el-form-item label="失败率阈值(%)">
          <el-input-number v-model="cbForm.failureRateThreshold" :min="1" :max="100" />
        </el-form-item>
        <el-form-item label="慢调用阈值(ms)">
          <el-input-number v-model="cbForm.slowCallDurationThreshold" :min="100" :max="30000" />
        </el-form-item>
        <el-form-item label="熔断等待时间(ms)">
          <el-input-number v-model="cbForm.waitDurationInOpenState" :min="1000" :max="600000" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="createCircuitBreaker">
            <el-icon><Plus /></el-icon> 创建
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>
    
    <el-card style="margin-top: 20px;">
      <template #header>
        <div class="card-header">
          <span>熔断器列表</span>
          <el-button type="primary" size="small" @click="loadCircuitBreakers">
            <el-icon><Refresh /></el-icon> 刷新
          </el-button>
        </div>
      </template>
      <el-table :data="circuitBreakers" v-if="circuitBreakers.length > 0">
        <el-table-column prop="name" label="服务名称" width="200" />
        <el-table-column label="状态" width="120">
          <template #default="{ row }">
            <el-tag :type="getStateType(row.state)">
              {{ row.state }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="totalCalls" label="总请求" width="80" />
        <el-table-column prop="successCount" label="成功" width="80" />
        <el-table-column prop="failureCount" label="失败" width="80" />
        <el-table-column prop="slowCallCount" label="慢调用" width="80" />
        <el-table-column label="失败率" width="150">
          <template #default="{ row }">
            <el-progress 
              :percentage="row.failureRate" 
              :stroke-width="8"
              :color="row.failureRate > 50 ? '#f56c6c' : row.failureRate > 30 ? '#e6a23c' : '#67c23a'"
            />
          </template>
        </el-table-column>
        <el-table-column label="慢调用率" width="150">
          <template #default="{ row }">
            <el-progress 
              :percentage="row.slowCallRate" 
              :stroke-width="8"
              :color="row.slowCallRate > 50 ? '#f56c6c' : row.slowCallRate > 30 ? '#e6a23c' : '#67c23a'"
            />
          </template>
        </el-table-column>
        <el-table-column label="平均响应时间" width="120">
          <template #default="{ row }">
            {{ row.averageResponseTime?.toFixed(2) || 0 }} ms
          </template>
        </el-table-column>
        <el-table-column label="操作" width="180">
          <template #default="{ row }">
            <el-button size="small" type="success" @click="resetCircuitBreaker(row.name)">
              重置
            </el-button>
            <el-button size="small" type="warning" @click="closeCircuitBreaker(row.name)">
              关闭
            </el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-else description="暂无熔断器配置" />
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import axios from 'axios'

const circuitBreakers = ref([])

const cbForm = reactive({
  name: '',
  slidingWindowSize: 100,
  minimumNumberOfCalls: 10,
  failureRateThreshold: 50,
  slowCallDurationThreshold: 2000,
  waitDurationInOpenState: 10000
})

const loadCircuitBreakers = async () => {
  try {
    const res = await axios.get('/api/v1/config/circuit-breakers')
    circuitBreakers.value = Object.values(res.data.data || {})
  } catch (error) {
    console.error('Failed to load circuit breakers:', error)
  }
}

const createCircuitBreaker = async () => {
  if (!cbForm.name) {
    ElMessage.warning('请输入服务名称')
    return
  }
  
  try {
    await axios.post(`/api/v1/config/circuit-breaker/${cbForm.name}`, cbForm)
    ElMessage.success('熔断器创建成功')
    cbForm.name = ''
    loadCircuitBreakers()
  } catch (error) {
    ElMessage.error('创建失败: ' + error.message)
  }
}

const resetCircuitBreaker = async (name) => {
  try {
    await axios.post(`/api/v1/config/circuit-breaker/${name}/reset`)
    ElMessage.success('熔断器已重置')
    loadCircuitBreakers()
  } catch (error) {
    ElMessage.error('操作失败')
  }
}

const closeCircuitBreaker = async (name) => {
  try {
    await axios.post(`/api/v1/config/circuit-breaker/${name}/close`)
    ElMessage.success('熔断器已关闭')
    loadCircuitBreakers()
  } catch (error) {
    ElMessage.error('操作失败')
  }
}

const getStateType = (state) => {
  const types = {
    CLOSED: 'success',
    OPEN: 'danger',
    HALF_OPEN: 'warning',
    DISABLED: 'info',
    FORCED_OPEN: 'danger'
  }
  return types[state] || 'info'
}

onMounted(() => {
  loadCircuitBreakers()
})
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
