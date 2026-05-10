<template>
  <div class="fault-injection">
    <el-row :gutter="20">
      <el-col :span="12">
        <el-card>
          <template #header>
            <span>添加故障配置</span>
          </template>
          <el-form :model="faultForm" label-width="140px">
            <el-form-item label="目标端点">
              <el-select v-model="faultForm.endpoint" placeholder="选择端点或自定义">
                <el-option 
                  v-for="ep in defaultEndpoints" 
                  :key="ep.value" 
                  :label="ep.label" 
                  :value="ep.value" 
                />
              </el-select>
              <el-input 
                v-if="faultForm.endpoint === 'custom'" 
                v-model="customEndpoint" 
                placeholder="输入自定义端点路径" 
                style="margin-top: 10px;"
              />
            </el-form-item>
            
            <el-form-item label="强制失败">
              <el-switch v-model="faultForm.forceFail" />
              <span class="form-hint">启用后所有请求将直接失败</span>
            </el-form-item>
            
            <el-form-item label="延迟注入">
              <el-input-number v-model="faultForm.delayMs" :min="0" :max="10000" />
              <span style="margin-left: 10px;">毫秒</span>
            </el-form-item>
            
            <el-form-item label="随机延迟">
              <el-switch v-model="faultForm.randomDelay" />
              <span class="form-hint">启用后延迟时间将随机变化</span>
            </el-form-item>
            
            <el-form-item label="超时概率">
              <el-slider 
                v-model="faultForm.timeoutProbability" 
                :min="0" 
                :max="1" 
                :step="0.1" 
                :format-tooltip="formatPercent"
              />
              <span class="slider-value">{{ (faultForm.timeoutProbability * 100).toFixed(0) }}%</span>
            </el-form-item>
            
            <el-form-item label="错误概率">
              <el-slider 
                v-model="faultForm.errorProbability" 
                :min="0" 
                :max="1" 
                :step="0.1" 
                :format-tooltip="formatPercent"
              />
              <span class="slider-value">{{ (faultForm.errorProbability * 100).toFixed(0) }}%</span>
            </el-form-item>
            
            <el-form-item label="断网概率">
              <el-slider 
                v-model="faultForm.networkErrorProbability" 
                :min="0" 
                :max="1" 
                :step="0.1" 
                :format-tooltip="formatPercent"
              />
              <span class="slider-value">{{ (faultForm.networkErrorProbability * 100).toFixed(0) }}%</span>
            </el-form-item>
            
            <el-form-item label="重复请求概率">
              <el-slider 
                v-model="faultForm.duplicateProbability" 
                :min="0" 
                :max="1" 
                :step="0.1" 
                :format-tooltip="formatPercent"
              />
              <span class="slider-value">{{ (faultForm.duplicateProbability * 100).toFixed(0) }}%</span>
            </el-form-item>
            
            <el-form-item label="高并发阈值">
              <el-input-number v-model="faultForm.highConcurrencyThreshold" :min="0" :max="1000" />
              <span style="margin-left: 10px;">并发数限制</span>
            </el-form-item>
            
            <el-form-item>
              <el-button type="primary" @click="applyFaultConfig">
                <el-icon><Check /></el-icon> 应用配置
              </el-button>
              <el-button @click="resetForm">
                <el-icon><Refresh /></el-icon> 重置
              </el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </el-col>
      
      <el-col :span="12">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>已启用的故障配置</span>
              <el-button type="danger" size="small" @click="resetAllFaults">
                <el-icon><Delete /></el-icon> 清除全部
              </el-button>
            </div>
          </template>
          <el-table :data="activeFaults" v-if="activeFaults.length > 0">
            <el-table-column prop="endpoint" label="端点" />
            <el-table-column label="配置详情">
              <template #default="{ row }">
                <el-tag v-if="row.forceFail" type="danger" size="small" style="margin-right: 5px;">
                  强制失败
                </el-tag>
                <el-tag v-if="row.delayMs > 0" type="warning" size="small" style="margin-right: 5px;">
                  延迟{{ row.delayMs }}ms
                </el-tag>
                <el-tag v-if="row.timeoutProbability > 0" type="info" size="small" style="margin-right: 5px;">
                  超时{{ (row.timeoutProbability * 100).toFixed(0) }}%
                </el-tag>
                <el-tag v-if="row.errorProbability > 0" type="danger" size="small" style="margin-right: 5px;">
                  错误{{ (row.errorProbability * 100).toFixed(0) }}%
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="100">
              <template #default="{ row }">
                <el-button size="small" type="danger" @click="removeFaultConfig(row.endpoint)">
                  <el-icon><Delete /></el-icon>
                </el-button>
              </template>
            </el-table-column>
          </el-table>
          <el-empty v-else description="暂无故障配置" />
        </el-card>
        
        <el-card style="margin-top: 20px;">
          <template #header>
            <span>快速测试</span>
          </template>
          <el-alert 
            type="info" 
            :closable="false"
            title="选择一个端点进行测试，查看故障注入效果"
            style="margin-bottom: 15px;"
          />
          <el-select v-model="selectedTestEndpoint" placeholder="选择测试端点" style="width: 100%;">
            <el-option 
              v-for="ep in defaultEndpoints" 
              :key="ep.value" 
              :label="ep.label" 
              :value="ep.value" 
            />
          </el-select>
          <el-button 
            type="primary" 
            style="margin-top: 10px; width: 100%;"
            @click="runEndpointTest"
            :loading="testLoading"
          >
            <el-icon><VideoPlay /></el-icon> 执行测试
          </el-button>
          <el-card v-if="testResult" shadow="never" style="margin-top: 15px;">
            <pre>{{ JSON.stringify(testResult, null, 2) }}</pre>
          </el-card>
        </el-card>
      </el-col>
    </el-row>
    
    <el-row style="margin-top: 20px;">
      <el-col :span="24">
        <el-card>
          <template #header>
            <span>消息队列故障配置</span>
          </template>
          <el-form :model="messageFaultForm" label-width="160px" inline>
            <el-form-item label="队列名称">
              <el-input v-model="messageFaultForm.queueName" placeholder="例如: order.queue" />
            </el-form-item>
            <el-form-item label="强制失败">
              <el-switch v-model="messageFaultForm.forceFail" />
            </el-form-item>
            <el-form-item label="重试概率">
              <el-slider 
                v-model="messageFaultForm.retryProbability" 
                :min="0" 
                :max="1" 
                :step="0.1"
                style="width: 150px;"
              />
            </el-form-item>
            <el-form-item label="最大重试次数">
              <el-input-number v-model="messageFaultForm.maxRetryCount" :min="1" :max="10" />
            </el-form-item>
            <el-form-item label="重复消息概率">
              <el-slider 
                v-model="messageFaultForm.duplicateProbability" 
                :min="0" 
                :max="1" 
                :step="0.1"
                style="width: 150px;"
              />
            </el-form-item>
            <el-form-item label="处理延迟">
              <el-input-number v-model="messageFaultForm.delayMs" :min="0" :max="5000" />
              <span>ms</span>
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="applyMessageFaultConfig">应用</el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import axios from 'axios'

const defaultEndpoints = [
  { label: '限流测试接口', value: '/api/v1/demo/rate-limit' },
  { label: '熔断测试接口', value: '/api/v1/demo/circuit-breaker/test' },
  { label: '故障注入演示', value: '/api/v1/demo/fault-injection' },
  { label: '重试测试', value: '/api/v1/demo/retry' },
  { label: '超时测试', value: '/api/v1/demo/timeout' },
  { label: '高并发测试', value: '/api/v1/demo/high-concurrency' },
  { label: '订单服务', value: '/api/v1/demo/order' },
  { label: '自定义', value: 'custom' }
]

const customEndpoint = ref('')
const selectedTestEndpoint = ref('')
const testLoading = ref(false)
const testResult = ref(null)
const activeFaults = ref([])

const faultForm = reactive({
  endpoint: '',
  forceFail: false,
  delayMs: 0,
  randomDelay: false,
  timeoutProbability: 0,
  errorProbability: 0,
  networkErrorProbability: 0,
  duplicateProbability: 0,
  highConcurrencyThreshold: 0
})

const messageFaultForm = reactive({
  queueName: '',
  forceFail: false,
  retryProbability: 0,
  maxRetryCount: 3,
  duplicateProbability: 0,
  delayMs: 0
})

const formatPercent = (value) => `${(value * 100).toFixed(0)}%`

const loadActiveFaults = async () => {
  try {
    const res = await axios.get('/api/v1/config/faults')
    activeFaults.value = Object.values(res.data.data || {})
  } catch (error) {
    console.error('Failed to load fault configs:', error)
  }
}

const applyFaultConfig = async () => {
  const endpoint = faultForm.endpoint === 'custom' ? customEndpoint.value : faultForm.endpoint
  if (!endpoint) {
    ElMessage.warning('请选择或输入端点')
    return
  }
  
  try {
    await axios.post(`/api/v1/config/fault/${encodeURIComponent(endpoint)}`, faultForm)
    ElMessage.success('故障配置已应用')
    loadActiveFaults()
  } catch (error) {
    ElMessage.error('配置失败')
  }
}

const applyMessageFaultConfig = async () => {
  if (!messageFaultForm.queueName) {
    ElMessage.warning('请输入队列名称')
    return
  }
  
  try {
    await axios.post(
      `/api/v1/config/message-fault/${encodeURIComponent(messageFaultForm.queueName)}`,
      messageFaultForm
    )
    ElMessage.success('消息队列故障配置已应用')
  } catch (error) {
    ElMessage.error('配置失败')
  }
}

const removeFaultConfig = async (endpoint) => {
  try {
    await axios.delete(`/api/v1/config/fault/${encodeURIComponent(endpoint)}`)
    ElMessage.success('配置已删除')
    loadActiveFaults()
  } catch (error) {
    ElMessage.error('删除失败')
  }
}

const resetAllFaults = async () => {
  try {
    await axios.post('/api/v1/config/faults/reset')
    ElMessage.success('所有故障配置已清除')
    loadActiveFaults()
  } catch (error) {
    ElMessage.error('清除失败')
  }
}

const resetForm = () => {
  Object.assign(faultForm, {
    endpoint: '',
    forceFail: false,
    delayMs: 0,
    randomDelay: false,
    timeoutProbability: 0,
    errorProbability: 0,
    networkErrorProbability: 0,
    duplicateProbability: 0,
    highConcurrencyThreshold: 0
  })
  customEndpoint.value = ''
}

const runEndpointTest = async () => {
  if (!selectedTestEndpoint.value) {
    ElMessage.warning('请选择测试端点')
    return
  }
  
  testLoading.value = true
  testResult.value = null
  
  try {
    const res = await axios.get(selectedTestEndpoint.value)
    testResult.value = res.data
    ElMessage.success('测试成功')
  } catch (error) {
    testResult.value = {
      error: error.message,
      status: error.response?.status,
      data: error.response?.data
    }
    ElMessage.error('测试请求失败（这可能是预期的故障注入效果）')
  } finally {
    testLoading.value = false
  }
}

onMounted(() => {
  loadActiveFaults()
})
</script>

<style scoped>
.form-hint {
  margin-left: 10px;
  color: #909399;
  font-size: 12px;
}

.slider-value {
  margin-left: 10px;
  color: #409eff;
  font-weight: bold;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

pre {
  margin: 0;
  font-size: 12px;
  background: #f5f7fa;
  padding: 10px;
  border-radius: 4px;
  overflow: auto;
  max-height: 300px;
}
</style>
