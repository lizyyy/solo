<template>
  <div class="rate-limit">
    <el-card>
      <template #header>
        <span>限流配置查询</span>
      </template>
      <el-form :inline="true">
        <el-form-item label="限流 Key">
          <el-input v-model="searchKey" placeholder="输入限流 key" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="searchRateLimit">
            <el-icon><Search /></el-icon> 查询
          </el-button>
          <el-button type="danger" @click="resetRateLimit">
            <el-icon><Delete /></el-icon> 重置
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>
    
    <el-card style="margin-top: 20px;" v-if="metrics">
      <template #header>
        <span>限流指标</span>
      </template>
      <el-descriptions :column="3" border>
        <el-descriptions-item label="限流 Key">{{ metrics.key }}</el-descriptions-item>
        <el-descriptions-item label="剩余令牌数">
          <el-tag :type="metrics.remainingTokens > 0 ? 'success' : 'danger'">
            {{ metrics.remainingTokens }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="固定窗口计数">
          {{ metrics.fixedWindowCount }}
        </el-descriptions-item>
        <el-descriptions-item label="滑动窗口计数" :span="3">
          {{ metrics.slidingWindowCount }}
        </el-descriptions-item>
      </el-descriptions>
    </el-card>
    
    <el-card style="margin-top: 20px;">
      <template #header>
        <span>限流算法说明</span>
      </template>
      <el-row :gutter="20">
        <el-col :span="6">
          <el-card class="algo-card" shadow="hover">
            <div class="algo-title">令牌桶</div>
            <div class="algo-desc">以固定速率放入令牌，请求时获取令牌，适合平滑限流</div>
            <el-tag type="info" size="small">Token Bucket</el-tag>
          </el-card>
        </el-col>
        <el-col :span="6">
          <el-card class="algo-card" shadow="hover">
            <div class="algo-title">漏桶</div>
            <div class="algo-desc">固定速率流出请求，平滑突发流量</div>
            <el-tag type="info" size="small">Leaky Bucket</el-tag>
          </el-card>
        </el-col>
        <el-col :span="6">
          <el-card class="algo-card" shadow="hover">
            <div class="algo-title">固定窗口</div>
            <div class="algo-desc">时间窗口固定计数，实现简单但有边界问题</div>
            <el-tag type="info" size="small">Fixed Window</el-tag>
          </el-card>
        </el-col>
        <el-col :span="6">
          <el-card class="algo-card" shadow="hover">
            <div class="algo-title">滑动窗口</div>
            <div class="algo-desc">平滑时间窗口，解决固定窗口的边界问题</div>
            <el-tag type="info" size="small">Sliding Window</el-tag>
          </el-card>
        </el-col>
      </el-row>
    </el-card>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import axios from 'axios'

const searchKey = ref('')
const metrics = ref(null)

const searchRateLimit = async () => {
  if (!searchKey.value) {
    ElMessage.warning('请输入限流 key')
    return
  }
  
  try {
    const res = await axios.get(`/api/v1/config/rate-limit/${encodeURIComponent(searchKey.value)}`)
    metrics.value = res.data.data
    ElMessage.success('查询成功')
  } catch (error) {
    ElMessage.error('查询失败')
  }
}

const resetRateLimit = async () => {
  if (!searchKey.value) {
    ElMessage.warning('请输入限流 key')
    return
  }
  
  try {
    await axios.post(`/api/v1/config/rate-limit/${encodeURIComponent(searchKey.value)}`, {
      limit: 100,
      window: 1,
      strategy: 'TOKEN_BUCKET'
    })
    metrics.value = null
    ElMessage.success('限流配置已重置')
  } catch (error) {
    ElMessage.error('重置失败')
  }
}
</script>

<style scoped>
.algo-card {
  text-align: center;
  cursor: pointer;
  transition: all 0.3s;
}

.algo-card:hover {
  transform: translateY(-5px);
}

.algo-title {
  font-size: 16px;
  font-weight: bold;
  margin-bottom: 10px;
  color: #303133;
}

.algo-desc {
  font-size: 12px;
  color: #909399;
  margin-bottom: 10px;
  line-height: 1.5;
}
</style>
