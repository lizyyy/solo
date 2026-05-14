<template>
  <div class="report-page">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <span>覆盖率报告</span>
        </div>
      </template>

      <el-row :gutter="20" class="stats-row">
        <el-col :span="6">
          <el-statistic title="总报告数" :value="reports.length" />
        </el-col>
        <el-col :span="6">
          <el-statistic title="平均覆盖率" :value="avgCoverage" suffix="%" />
        </el-col>
        <el-col :span="6">
          <el-statistic title="平均占位符错误" :value="avgPlaceholderErrors" />
        </el-col>
        <el-col :span="6">
          <el-statistic title="已发布版本" :value="publishedCount" />
        </el-col>
      </el-row>

      <el-table :data="reports" v-loading="loading" border style="margin-top: 20px;">
        <el-table-column prop="version" label="版本号" width="150" />
        <el-table-column prop="language_code" label="语言" width="100" />
        <el-table-column prop="total_keys" label="总 Key 数" width="120" />
        <el-table-column prop="translated_keys" label="已翻译" width="120" />
        <el-table-column prop="missing_keys" label="缺失" width="100">
          <template #default="{ row }">
            <el-tag :type="row.missing_keys > 0 ? 'warning' : 'success'" size="small">
              {{ row.missing_keys }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="coverage_rate" label="覆盖率" width="150">
          <template #default="{ row }">
            <el-progress
              :percentage="row.coverage_rate"
              :color="getCoverageColor(row.coverage_rate)"
              :stroke-width="10"
            />
          </template>
        </el-table-column>
        <el-table-column prop="placeholder_error_count" label="占位符错误" width="120">
          <template #default="{ row }">
            <el-tag :type="row.placeholder_error_count > 0 ? 'danger' : 'success'" size="small">
              {{ row.placeholder_error_count }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="generated_at" label="生成时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.generated_at) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button size="small" type="primary" @click="exportReport(row)">
              导出语言包
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { reportApi } from '@/api'

const loading = ref(false)
const reports = ref([])

const avgCoverage = computed(() => {
  if (reports.value.length === 0) return 0
  const sum = reports.value.reduce((acc, r) => acc + r.coverage_rate, 0)
  return (sum / reports.value.length).toFixed(1)
})

const avgPlaceholderErrors = computed(() => {
  if (reports.value.length === 0) return 0
  const sum = reports.value.reduce((acc, r) => acc + r.placeholder_error_count, 0)
  return (sum / reports.value.length).toFixed(1)
})

const publishedCount = computed(() => {
  return reports.value.length
})

const getCoverageColor = (rate) => {
  if (rate >= 90) return '#67c23a'
  if (rate >= 70) return '#e6a23c'
  return '#f56c6c'
}

const formatDate = (dateStr) => {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleString('zh-CN')
}

const loadReports = async () => {
  loading.value = true
  try {
    reports.value = await reportApi.getReports()
  } catch (error) {
    ElMessage.error('加载报告失败')
  } finally {
    loading.value = false
  }
}

const exportReport = async (row) => {
  try {
    const blob = await reportApi.exportLanguagePack({
      language_pack_id: row.language_pack_id,
      version_release_id: row.version_release_id,
      format: 'json'
    })
    
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${row.language_code}_${row.version}.json`
    link.click()
    window.URL.revokeObjectURL(url)
    
    ElMessage.success('导出成功')
  } catch (error) {
    ElMessage.error('导出失败')
  }
}

onMounted(() => {
  loadReports()
})
</script>

<style scoped>
.report-page {
  height: 100%;
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.stats-row {
  margin-bottom: 20px;
}
</style>
