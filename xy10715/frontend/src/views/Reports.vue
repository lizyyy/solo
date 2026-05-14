<template>
  <div class="reports-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>性能报告</span>
          <el-button type="primary" @click="createReport">生成新报告</el-button>
        </div>
      </template>

      <el-table :data="reports" v-loading="loading" stripe>
        <el-table-column prop="report_key" label="报告编号" width="200" />
        <el-table-column prop="avg_hit_rate" label="平均命中率" width="120">
          <template #default="{ row }">{{ row.avg_hit_rate }}%</template>
        </el-table-column>
        <el-table-column prop="total_preheat_batches" label="预热批次" width="120" />
        <el-table-column prop="total_invalidations" label="失效次数" width="120" />
        <el-table-column prop="created_at" label="生成时间" width="180" />
        <el-table-column label="操作" width="100">
          <template #default="{ row }">
            <el-button link type="primary" @click="viewReport(row)">查看</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="showDetail" title="性能报告详情" width="800px">
      <div v-if="currentReport">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="报告编号">{{ currentReport.report_key }}</el-descriptions-item>
          <el-descriptions-item label="生成时间">{{ currentReport.created_at }}</el-descriptions-item>
          <el-descriptions-item label="平均命中率">{{ currentReport.avg_hit_rate }}%</el-descriptions-item>
          <el-descriptions-item label="预热批次总数">{{ currentReport.total_preheat_batches }}</el-descriptions-item>
          <el-descriptions-item label="失效次数总数">{{ currentReport.total_invalidations }}</el-descriptions-item>
        </el-descriptions>

        <el-divider />

        <h4>报告数据</h4>
        <el-input
          type="textarea"
          :model-value="JSON.stringify(currentReport.report_data, null, 2)"
          readonly
          :rows="10"
        />
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import axios from 'axios'

const reports = ref([])
const loading = ref(false)
const showDetail = ref(false)
const currentReport = ref(null)

const loadReports = async () => {
  loading.value = true
  try {
    reports.value = []
  } catch (err) {
    ElMessage.error('加载报告列表失败')
  } finally {
    loading.value = false
  }
}

const createReport = async () => {
  try {
    const res = await axios.post('/api/reports', {
      rule_id: 1,
      avg_hit_rate: 95,
      total_preheat_batches: 10,
      total_invalidations: 5,
      report_data: {
        summary: '缓存系统运行良好，命中率稳定',
        trends: [
          { date: '2024-01-01', hit_rate: 92 },
          { date: '2024-01-02', hit_rate: 95 },
          { date: '2024-01-03', hit_rate: 96 }
        ],
        recommendations: ['建议继续保持当前预热策略']
      }
    })
    reports.value.unshift(res.data)
    ElMessage.success('报告生成成功')
  } catch (err) {
    ElMessage.error('生成报告失败')
  }
}

const viewReport = (report) => {
  currentReport.value = report
  showDetail.value = true
}

onMounted(() => {
  loadReports()
})
</script>

<style scoped>
.reports-page {
  max-width: 1400px;
  margin: 0 auto;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

h4 {
  margin-bottom: 10px;
  color: #303133;
}
</style>
