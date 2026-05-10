<template>
  <div class="simulation">
    <el-row :gutter="20">
      <el-col :span="12">
        <el-card>
          <template #header>
            <span>流量峰值模拟</span>
          </template>
          <el-form :model="peakForm" label-width="140px">
            <el-form-item label="总请求数">
              <el-input-number v-model="peakForm.totalRequests" :min="100" :max="100000" :step="100" />
            </el-form-item>
            <el-form-item label="并发用户数">
              <el-input-number v-model="peakForm.concurrentUsers" :min="10" :max="1000" :step="10" />
            </el-form-item>
            <el-form-item label="QPS 限制">
              <el-input-number v-model="peakForm.qpsLimit" :min="10" :max="5000" :step="10" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="runPeakSimulation" :loading="peakRunning">
                <el-icon><VideoPlay /></el-icon> 开始模拟
              </el-button>
            </el-form-item>
          </el-form>
          <el-card v-if="peakResult" shadow="never">
            <el-descriptions :column="2" border>
              <el-descriptions-item label="总请求数">{{ peakResult.totalRequests }}</el-descriptions-item>
              <el-descriptions-item label="并发用户数">{{ peakResult.concurrentUsers }}</el-descriptions-item>
              <el-descriptions-item label="QPS 限制">{{ peakResult.qpsLimit }}</el-descriptions-item>
              <el-descriptions-item label="持续时间">{{ peakResult.durationMs }} ms</el-descriptions-item>
              <el-descriptions-item label="实际 QPS">{{ peakResult.actualQps?.toFixed(2) }}</el-descriptions-item>
              <el-descriptions-item label="最大并发线程">{{ peakResult.maxActiveThreads }}</el-descriptions-item>
              <el-descriptions-item label="成功数">
                <el-tag type="success">{{ peakResult.successCount }}</el-tag>
              </el-descriptions-item>
              <el-descriptions-item label="被限流数">
                <el-tag type="warning">{{ peakResult.rateLimitedCount }}</el-tag>
              </el-descriptions-item>
              <el-descriptions-item label="P50 延迟">{{ peakResult.p50LatencyMs }} ms</el-descriptions-item>
              <el-descriptions-item label="P95 延迟">{{ peakResult.p95LatencyMs }} ms</el-descriptions-item>
              <el-descriptions-item label="P99 延迟">{{ peakResult.p99LatencyMs }} ms</el-descriptions-item>
              <el-descriptions-item label="执行类型">
                <el-tag type="info">{{ peakResult.executionType }}</el-tag>
              </el-descriptions-item>
            </el-descriptions>
          </el-card>
        </el-card>
      </el-col>
      
      <el-col :span="12">
        <el-card>
          <template #header>
            <span>高并发测试</span>
          </template>
          <el-form :model="concurrencyForm" label-width="140px">
            <el-form-item label="请求数">
              <el-input-number v-model="concurrencyForm.requests" :min="10" :max="10000" :step="10" />
            </el-form-item>
            <el-form-item label="并发数限制">
              <el-input-number v-model="concurrencyForm.concurrency" :min="1" :max="500" :step="5" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="runConcurrencyTest" :loading="concurrencyRunning">
                <el-icon><Cpu /></el-icon> 开始测试
              </el-button>
            </el-form-item>
          </el-form>
          <el-card v-if="concurrencyResult" shadow="never">
            <el-descriptions :column="2" border>
              <el-descriptions-item label="总请求数">{{ concurrencyResult.totalRequests }}</el-descriptions-item>
              <el-descriptions-item label="并发限制">{{ concurrencyResult.maxConcurrency }}</el-descriptions-item>
              <el-descriptions-item label="实际观测并发">{{ concurrencyResult.maxObservedConcurrent }}</el-descriptions-item>
              <el-descriptions-item label="执行类型">
                <el-tag type="info">{{ concurrencyResult.executionType }}</el-tag>
              </el-descriptions-item>
              <el-descriptions-item label="成功数">
                <el-tag type="success">{{ concurrencyResult.successCount }}</el-tag>
              </el-descriptions-item>
              <el-descriptions-item label="失败数">
                <el-tag type="danger">{{ concurrencyResult.failCount }}</el-tag>
              </el-descriptions-item>
              <el-descriptions-item label="被限流数">
                <el-tag type="warning">{{ concurrencyResult.rateLimitedCount }}</el-tag>
              </el-descriptions-item>
              <el-descriptions-item label="实际 QPS">{{ concurrencyResult.actualQps?.toFixed(2) }}</el-descriptions-item>
            </el-descriptions>
          </el-card>
        </el-card>
      </el-col>
    </el-row>
    
    <el-row style="margin-top: 20px;">
      <el-col :span="12">
        <el-card>
          <template #header>
            <span>消息队列测试</span>
          </template>
          <el-form :model="messageForm" label-width="140px">
            <el-form-item label="队列类型">
              <el-radio-group v-model="messageForm.queueType">
                <el-radio value="demo">Demo 队列</el-radio>
                <el-radio value="order">Order 队列</el-radio>
              </el-radio-group>
            </el-form-item>
            <el-form-item label="测试类型">
              <el-radio-group v-model="messageForm.testType">
                <el-radio value="single">单条消息</el-radio>
                <el-radio value="batch">批量发送</el-radio>
                <el-radio value="concurrent">并发发送</el-radio>
              </el-radio-group>
            </el-form-item>
            
            <template v-if="messageForm.testType !== 'single'">
              <el-form-item label="消息数量">
                <el-input-number v-model="messageForm.messageCount" :min="5" :max="10000" :step="10" />
              </el-form-item>
              <el-form-item label="模拟重复消息">
                <el-switch v-model="messageForm.simulateDuplicates" />
              </el-form-item>
              <el-form-item label="模拟消费失败">
                <el-switch v-model="messageForm.simulateFailure" />
              </el-form-item>
            </template>
            
            <template v-if="messageForm.testType === 'concurrent'">
              <el-form-item label="并发生产者数">
                <el-input-number v-model="messageForm.concurrentProducers" :min="2" :max="100" :step="5" />
              </el-form-item>
            </template>
            
            <el-form-item>
              <el-button type="primary" @click="runMessageTest" :loading="messageRunning">
                <el-icon><Promotion /></el-icon> 发送消息
              </el-button>
              <el-button @click="loadMessageStats">
                <el-icon><DataAnalysis /></el-icon> 刷新统计
              </el-button>
              <el-button type="danger" @click="resetMessageStats" :loading="statsResetRunning">
                <el-icon><Delete /></el-icon> 重置统计
              </el-button>
            </el-form-item>
          </el-form>
          
          <el-card v-if="messageResult" shadow="never" style="margin-top: 15px;">
            <template #header>
              <div class="result-header">
                <span>消息发送结果</span>
                <el-button size="small" @click="messageResult = null">
                  <el-icon><Close /></el-icon>
                </el-button>
              </div>
            </template>
            <el-descriptions :column="2" border>
              <el-descriptions-item label="队列类型">{{ messageResult.queueType }}</el-descriptions-item>
              <el-descriptions-item label="总消息数">{{ messageResult.totalMessages }}</el-descriptions-item>
              <el-descriptions-item label="发送成功">
                <el-tag type="success">{{ messageResult.successCount || messageResult.sentCount }}</el-tag>
              </el-descriptions-item>
              <el-descriptions-item label="发送失败">
                <el-tag type="danger">{{ messageResult.failCount }}</el-tag>
              </el-descriptions-item>
              <template v-if="messageResult.duplicateCount !== undefined">
                <el-descriptions-item label="重复消息">
                  <el-tag type="warning">{{ messageResult.duplicateCount }}</el-tag>
                </el-descriptions-item>
              </template>
              <template v-if="messageResult.durationMs !== undefined">
                <el-descriptions-item label="耗时">{{ messageResult.durationMs }} ms</el-descriptions-item>
                <el-descriptions-item label="消息/秒">{{ messageResult.messagesPerSecond?.toFixed(2) }}</el-descriptions-item>
              </template>
            </el-descriptions>
          </el-card>
        </el-card>
      </el-col>
      
      <el-col :span="12">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>消息队列消费统计</span>
              <el-button size="small" @click="loadMessageStats">
                <el-icon><Refresh /></el-icon>
              </el-button>
            </div>
          </template>
          <el-tabs v-model="messageStatsTab">
            <el-tab-pane label="Demo 队列" name="demo">
              <el-descriptions :column="2" border>
                <el-descriptions-item label="总接收">{{ messageStats.demo?.totalReceived || 0 }}</el-descriptions-item>
                <el-descriptions-item label="处理成功">
                  <el-tag type="success">{{ messageStats.demo?.processedSuccessfully || 0 }}</el-tag>
                </el-descriptions-item>
                <el-descriptions-item label="消费失败">
                  <el-tag type="danger">{{ messageStats.demo?.failedMessages || 0 }}</el-tag>
                </el-descriptions-item>
                <el-descriptions-item label="重试次数">
                  <el-tag type="warning">{{ messageStats.demo?.retryMessages || 0 }}</el-tag>
                </el-descriptions-item>
                <el-descriptions-item label="去重跳过">
                  <el-tag type="info">{{ messageStats.demo?.duplicateMessages || 0 }}</el-tag>
                </el-descriptions-item>
                <el-descriptions-item label="最后处理">
                  {{ formatTime(messageStats.demo?.lastProcessTime) }}
                </el-descriptions-item>
              </el-descriptions>
            </el-tab-pane>
            <el-tab-pane label="Order 队列" name="order">
              <el-descriptions :column="2" border>
                <el-descriptions-item label="总接收">{{ messageStats.order?.totalReceived || 0 }}</el-descriptions-item>
                <el-descriptions-item label="处理成功">
                  <el-tag type="success">{{ messageStats.order?.processedSuccessfully || 0 }}</el-tag>
                </el-descriptions-item>
                <el-descriptions-item label="消费失败">
                  <el-tag type="danger">{{ messageStats.order?.failedMessages || 0 }}</el-tag>
                </el-descriptions-item>
                <el-descriptions-item label="重试次数">
                  <el-tag type="warning">{{ messageStats.order?.retryMessages || 0 }}</el-tag>
                </el-descriptions-item>
                <el-descriptions-item label="去重跳过">
                  <el-tag type="info">{{ messageStats.order?.duplicateMessages || 0 }}</el-tag>
                </el-descriptions-item>
                <el-descriptions-item label="最后处理">
                  {{ formatTime(messageStats.order?.lastProcessTime) }}
                </el-descriptions-item>
              </el-descriptions>
            </el-tab-pane>
          </el-tabs>
          
          <el-alert 
            type="info" 
            :closable="false"
            title="如何测试消息重复消费？"
            style="margin-top: 15px;"
          >
            <p>1. 先在「故障注入」页面配置目标队列的「重复消息概率」和「重试概率」</p>
            <p>2. 勾选「模拟重复消息」发送批量消息</p>
            <p>3. 观察「去重跳过」和「重试次数」统计</p>
          </el-alert>
        </el-card>
      </el-col>
    </el-row>
    
    <el-row style="margin-top: 20px;">
      <el-col :span="24">
        <el-card>
          <template #header>
            <span>演示接口快捷测试</span>
          </template>
          <el-row :gutter="20">
            <el-col :span="6">
              <el-card class="demo-card" shadow="hover">
                <el-icon class="demo-icon"><Timer /></el-icon>
                <div class="demo-title">限流测试</div>
                <div class="demo-desc">测试令牌桶限流效果</div>
                <el-button type="primary" size="small" @click="testRateLimit" :loading="rlLoading">
                  执行
                </el-button>
              </el-card>
            </el-col>
            <el-col :span="6">
              <el-card class="demo-card" shadow="hover">
                <el-icon class="demo-icon"><Connection /></el-icon>
                <div class="demo-title">熔断测试</div>
                <div class="demo-desc">测试熔断器状态切换</div>
                <el-button type="primary" size="small" @click="testCircuitBreaker" :loading="cbLoading">
                  执行(正常)
                </el-button>
                <el-button type="danger" size="small" @click="testCircuitBreakerFail" :loading="cbLoading" style="margin-left: 5px;">
                  执行(失败)
                </el-button>
              </el-card>
            </el-col>
            <el-col :span="6">
              <el-card class="demo-card" shadow="hover">
                <el-icon class="demo-icon"><RefreshLeft /></el-icon>
                <div class="demo-title">重试测试</div>
                <div class="demo-desc">测试自动重试机制</div>
                <el-button type="primary" size="small" @click="testRetry" :loading="retryLoading">
                  执行
                </el-button>
              </el-card>
            </el-col>
            <el-col :span="6">
              <el-card class="demo-card" shadow="hover">
                <el-icon class="demo-icon"><Clock /></el-icon>
                <div class="demo-title">超时测试</div>
                <div class="demo-desc">测试超时熔断</div>
                <el-slider v-model="timeoutValue" :min="100" :max="10000" :step="100" style="margin-bottom: 10px;" />
                <el-button type="primary" size="small" @click="testTimeout" :loading="timeoutLoading">
                  执行 ({{ timeoutValue }}ms)
                </el-button>
              </el-card>
            </el-col>
          </el-row>
          
          <el-card v-if="testResult" shadow="never" style="margin-top: 20px;">
            <template #header>
              <div class="result-header">
                <span>测试结果</span>
                <el-button size="small" @click="testResult = null">
                  <el-icon><Close /></el-icon>
                </el-button>
              </div>
            </template>
            <pre>{{ JSON.stringify(testResult, null, 2) }}</pre>
          </el-card>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import axios from 'axios'

const peakRunning = ref(false)
const concurrencyRunning = ref(false)
const messageRunning = ref(false)
const statsResetRunning = ref(false)
const rlLoading = ref(false)
const cbLoading = ref(false)
const retryLoading = ref(false)
const timeoutLoading = ref(false)

const peakResult = ref(null)
const concurrencyResult = ref(null)
const messageResult = ref(null)
const testResult = ref(null)
const timeoutValue = ref(2000)
const messageStatsTab = ref('demo')
const messageStats = ref({ demo: {}, order: {} })

const peakForm = reactive({
  totalRequests: 1000,
  concurrentUsers: 50,
  qpsLimit: 100
})

const concurrencyForm = reactive({
  requests: 100,
  concurrency: 10
})

const messageForm = reactive({
  queueType: 'demo',
  testType: 'single',
  messageCount: 20,
  concurrentProducers: 10,
  simulateDuplicates: false,
  simulateFailure: false
})

const runPeakSimulation = async () => {
  peakRunning.value = true
  peakResult.value = null
  
  try {
    const res = await axios.get('/api/v1/demo/simulate-peak', { params: peakForm })
    peakResult.value = res.data.data
    ElMessage.success('峰值模拟完成 - 所有请求并发执行')
  } catch (error) {
    ElMessage.error('模拟失败: ' + error.message)
  } finally {
    peakRunning.value = false
  }
}

const runConcurrencyTest = async () => {
  concurrencyRunning.value = true
  concurrencyResult.value = null
  
  try {
    const res = await axios.post('/api/v1/demo/high-concurrency', null, { params: concurrencyForm })
    concurrencyResult.value = res.data.data
    ElMessage.success('并发测试完成 - 真正并发执行')
  } catch (error) {
    ElMessage.error('测试失败: ' + error.message)
  } finally {
    concurrencyRunning.value = false
  }
}

const runMessageTest = async () => {
  messageRunning.value = true
  messageResult.value = null
  
  try {
    let res
    
    if (messageForm.testType === 'single') {
      const endpoint = messageForm.queueType === 'demo' ? 
        '/api/v1/message/send/demo' : 
        '/api/v1/message/send/order'
      res = await axios.post(endpoint, { test: 'single-message' })
      res.data.data.totalMessages = 1
      res.data.data.successCount = 1
      res.data.data.failCount = 0
    } else if (messageForm.testType === 'batch') {
      res = await axios.post('/api/v1/message/send/batch', null, {
        params: {
          queueType: messageForm.queueType,
          count: messageForm.messageCount,
          simulateDuplicates: messageForm.simulateDuplicates,
          simulateFailure: messageForm.simulateFailure
        }
      })
    } else {
      res = await axios.post('/api/v1/message/send/concurrent', null, {
        params: {
          queueType: messageForm.queueType,
          totalMessages: messageForm.messageCount,
          concurrentProducers: messageForm.concurrentProducers,
          duplicateProbability: messageForm.simulateDuplicates ? 0.15 : 0
        }
      })
    }
    
    messageResult.value = res.data.data
    ElMessage.success('消息发送完成')
    
    setTimeout(loadMessageStats, 500)
  } catch (error) {
    ElMessage.error('消息发送失败: ' + error.message)
  } finally {
    messageRunning.value = false
  }
}

const loadMessageStats = async () => {
  try {
    const res = await axios.get('/api/v1/message/stats')
    messageStats.value = res.data.data || { demo: {}, order: {} }
  } catch (error) {
    console.error('Failed to load message stats:', error)
  }
}

const resetMessageStats = async () => {
  statsResetRunning.value = true
  try {
    await axios.post('/api/v1/message/stats/reset')
    messageStats.value = { demo: {}, order: {} }
    ElMessage.success('消息统计已重置')
  } catch (error) {
    ElMessage.error('重置失败: ' + error.message)
  } finally {
    statsResetRunning.value = false
  }
}

const formatTime = (timestamp) => {
  if (!timestamp) return '-'
  return new Date(timestamp).toLocaleString()
}

const testRateLimit = async () => {
  rlLoading.value = true
  try {
    const res = await axios.get('/api/v1/demo/rate-limit', { params: { clientId: 'test-' + Date.now() } })
    testResult.value = res.data
    ElMessage.success('限流测试完成')
  } catch (error) {
    testResult.value = { error: error.response?.data || error.message }
    ElMessage.error('限流触发 (预期行为)')
  } finally {
    rlLoading.value = false
  }
}

const testCircuitBreaker = async (shouldFail = false) => {
  cbLoading.value = true
  try {
    const res = await axios.post('/api/v1/demo/circuit-breaker/test', null, { params: { shouldFail } })
    testResult.value = res.data.data
    ElMessage.success('熔断测试完成')
  } catch (error) {
    testResult.value = { error: error.response?.data || error.message }
    ElMessage.error('请求失败 (预期行为)')
  } finally {
    cbLoading.value = false
  }
}

const testCircuitBreakerFail = () => testCircuitBreaker(true)

const testRetry = async () => {
  retryLoading.value = true
  try {
    const res = await axios.get('/api/v1/demo/retry', { params: { shouldFail: true } })
    testResult.value = res.data.data
    ElMessage.success('重试测试完成')
  } catch (error) {
    testResult.value = { error: error.response?.data || error.message }
    ElMessage.error('重试耗尽 (预期行为)')
  } finally {
    retryLoading.value = false
  }
}

const testTimeout = async () => {
  timeoutLoading.value = true
  try {
    const res = await axios.get('/api/v1/demo/timeout', { params: { delayMs: timeoutValue.value } })
    testResult.value = res.data.data
    ElMessage.success('超时测试完成')
  } catch (error) {
    testResult.value = { error: error.response?.data || error.message }
    ElMessage.error('请求超时 (预期行为)')
  } finally {
    timeoutLoading.value = false
  }
}

onMounted(() => {
  loadMessageStats()
})
</script>

<style scoped>
.demo-card {
  text-align: center;
  cursor: pointer;
  transition: all 0.3s;
}

.demo-card:hover {
  transform: translateY(-5px);
}

.demo-icon {
  font-size: 40px;
  color: #409eff;
  margin-bottom: 10px;
}

.demo-title {
  font-size: 16px;
  font-weight: bold;
  margin-bottom: 5px;
}

.demo-desc {
  font-size: 12px;
  color: #909399;
  margin-bottom: 15px;
}

.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

pre {
  margin: 0;
  font-size: 12px;
  background: #f5f7fa;
  padding: 15px;
  border-radius: 4px;
  overflow: auto;
  max-height: 400px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
