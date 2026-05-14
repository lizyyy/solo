<template>
  <div class="statistics">
    <el-card>
      <template #header>质检统计</template>
      <el-row :gutter="20">
        <el-col :span="6">
          <el-statistic title="总记录数" :value="stats.total_count" />
        </el-col>
        <el-col :span="6">
          <el-statistic title="质检通过">
            <template #value>
              <span class="text-success">{{ stats.success_count }}</span>
            </template>
          </el-statistic>
        </el-col>
        <el-col :span="6">
          <el-statistic title="质检拦截">
            <template #value>
              <span class="text-danger">{{ stats.blocked_count }}</span>
            </template>
          </el-statistic>
        </el-col>
        <el-col :span="6">
          <el-statistic title="人工复核">
            <template #value>
              <span class="text-warning">{{ stats.manual_review_count }}</span>
            </template>
          </el-statistic>
        </el-col>
      </el-row>
      
      <el-divider />
      
      <h4>近7天统计数据</h4>
      <el-table :data="statisticsList" border stripe>
        <el-table-column prop="date" label="日期" width="120" />
        <el-table-column prop="total_count" label="总数" width="100" />
        <el-table-column prop="success_count" label="通过" width="100">
          <template #default="{ row }">
            <span class="text-success">{{ row.success_count }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="blocked_count" label="拦截" width="100">
          <template #default="{ row }">
            <span class="text-danger">{{ row.blocked_count }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="compensation_count" label="补偿" width="100">
          <template #default="{ row }">
            <span class="text-warning">{{ row.compensation_count }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="manual_review_count" label="复核" width="100">
          <template #default="{ row }">
            <span class="text-warning">{{ row.manual_review_count }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="avg_confidence" label="平均置信度" width="120">
          <template #default="{ row }">
            {{ (row.avg_confidence * 100).toFixed(1) }}%
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { statisticsApi } from '../api'

const stats = ref({
  total_count: 0,
  success_count: 0,
  blocked_count: 0,
  compensation_count: 0,
  manual_review_count: 0
})

const statisticsList = ref([])

const loadStatistics = async () => {
  try {
    const res = await statisticsApi.get(7)
    statisticsList.value = res.data
    
    if (res.data.length > 0) {
      const today = res.data[0]
      stats.value = {
        total_count: today.total_count,
        success_count: today.success_count,
        blocked_count: today.blocked_count,
        compensation_count: today.compensation_count,
        manual_review_count: today.manual_review_count
      }
    }
  } catch (error) {
    console.error('加载统计数据失败')
  }
}

onMounted(() => {
  loadStatistics()
})
</script>

<style scoped>
.text-success {
  color: #67c23a;
  font-size: 24px;
  font-weight: bold;
}

.text-danger {
  color: #f56c6c;
  font-size: 24px;
  font-weight: bold;
}

.text-warning {
  color: #e6a23c;
  font-size: 24px;
  font-weight: bold;
}

h4 {
  margin-bottom: 15px;
  color: #303133;
}
</style>
