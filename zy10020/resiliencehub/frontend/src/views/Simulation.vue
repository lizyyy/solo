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
              <el-descriptions-item label="成功数">
                <el-tag type="success">{{ peakResult.successCount }}</el-tag>
              </el-descriptions-item>
              <el-descriptions-item label="被限流数">
                <el-tag type="warning">{{ peakResult.rateLimitedCount }}</el-tag>
              </el-descriptions-item>
              <el-descriptions-item label="实际 QPS" :span="2">
                {{ peakResult.actualQps?.toFixed(2) }}
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
              <el-descriptions-item label="成功数">
                <el-tag type="success">{{ concurrencyResult.successCount }}</el-tag>
              </el-descriptions-item>
              <el-descriptions-item label="失败数">
                <el-tag type="danger">{{ concurrencyResult.failCount }}</el-tag>
              </el-descriptions-item>
              <el-descriptions-item label="被限流数" :span="2">
                <el-tag type="warning">{{ concurrencyResult.rateLimitedCount }}</el-tag>
              </el-descriptions-item>
            </el-descriptions>
          </el-card>
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
import { ref, reactive } from 'vue'
import { ElMessage } from 'element-plus'
import axios from 'axios'

const peakRunning = ref(false)
const concurrencyRunning = ref(false)
const rlLoading = ref(false)
const cbLoading = ref(false)
const retryLoading = ref(false)
const timeoutLoading = ref(false)

const peakResult = ref(null)
const concurrencyResult = ref(null)
const testResult = ref(null)
const timeoutValue = ref(2000)

const peakForm = reactive({
  totalRequests: 1000,
  concurrentUsers: 50,
  qpsLimit: 100
})

const concurrencyForm = reactive({
  requests: 100,
  concurrency: 10
})

const runPeakSimulation = async () => {
  peakRunning.value = true
  peakResult.value = null
  
  try {
    const res = await axios.get('/api/v1/demo/simulate-peak', { params: peakForm })
    peakResult.value = res.data.data
    ElMessage.success('峰值模拟完成')
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
    ElMessage.success('并发测试完成')
  } catch (error) {
    ElMessage.error('测试失败: ' + error.message)
  } finally {
    concurrencyRunning.value = false
  }
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
</style>
