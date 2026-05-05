<template>
  <div class="risk-assessments-container">
    <el-card shadow="never" class="filter-card">
      <el-form :inline="true" :model="filterForm" class="filter-form">
        <el-form-item label="风险等级">
          <el-select v-model="filterForm.final_risk_level" placeholder="全部等级" clearable style="width: 140px">
            <el-option label="严重" value="严重" />
            <el-option label="高" value="高" />
            <el-option label="中" value="中" />
            <el-option label="低" value="低" />
          </el-select>
        </el-form-item>
        <el-form-item label="是否人工改判">
          <el-select v-model="filterForm.manual_override" placeholder="全部" clearable style="width: 140px">
            <el-option label="是" :value="true" />
            <el-option label="否" :value="false" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="fetchAssessments">
            <el-icon><Search /></el-icon>
            查询
          </el-button>
          <el-button @click="resetFilter">重置</el-button>
          <el-button type="success" @click="handleBatchExport">
            <el-icon><Download /></el-icon>
            批量导出
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="hover" style="margin-top: 20px">
      <el-table 
        :data="assessmentList" 
        v-loading="loading" 
        style="width: 100%"
        @selection-change="handleSelectionChange"
      >
        <el-table-column type="selection" width="55" />
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="final_risk_level" label="风险等级" width="120">
          <template #default="{ row }">
            <el-tag :type="getRiskTagType(row.final_risk_level)" size="small">
              {{ row.final_risk_level }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="final_risk_score" label="风险评分" width="120">
          <template #default="{ row }">
            <span :style="{ color: getRiskLevelColor(row.final_risk_level), fontWeight: 'bold' }">
              {{ (row.final_risk_score * 100).toFixed(1) }}%
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="ai_risk_level" label="AI等级" width="100">
          <template #default="{ row }">
            <el-tag :type="getRiskTagType(row.ai_risk_level)" size="small" effect="plain">
              {{ row.ai_risk_level }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="ai_detection_type" label="检测类型" width="120" />
        <el-table-column prop="manual_override" label="人工改判" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.manual_override" type="warning" size="small">已改判</el-tag>
            <span v-else class="text-muted">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="评估时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link @click="goToDetail(row.id)">
              详情
            </el-button>
            <el-button type="success" link @click="handleExportSingle(row)">
              导出
            </el-button>
          </template>
        </el-table-column>
      </el-table>
      
      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.pageSize"
        :page-sizes="[10, 20, 50, 100]"
        :total="pagination.total"
        layout="total, sizes, prev, pager, next, jumper"
        style="margin-top: 20px; justify-content: flex-end"
        @size-change="handleSizeChange"
        @current-change="handleCurrentChange"
      />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, type ElTableRowSelection } from 'element-plus'
import { getRiskAssessments } from '@/api/risk_assessments'
import { exportMarkdown, exportJson } from '@/api/export'
import { getRiskLevelColor, type RiskLevel } from '@/types'
import dayjs from 'dayjs'

const router = useRouter()

const loading = ref(false)
const selectedRows = ref<any[]>([])

const filterForm = reactive({
  final_risk_level: undefined as RiskLevel | undefined,
  manual_override: undefined as boolean | undefined,
})

const pagination = reactive({
  page: 1,
  pageSize: 10,
  total: 0,
})

const assessmentList = ref<any[]>([])

const getRiskTagType = (level?: string) => {
  const typeMap: Record<string, string> = {
    '严重': 'danger',
    '高': 'warning',
    '中': 'primary',
    '低': 'success',
  }
  return typeMap[level || ''] || 'info'
}

const formatDate = (date: string) => {
  return dayjs(date).format('YYYY-MM-DD HH:mm')
}

const fetchAssessments = async () => {
  loading.value = true
  try {
    const result = await getRiskAssessments({
      skip: (pagination.page - 1) * pagination.pageSize,
      limit: pagination.pageSize,
      final_risk_level: filterForm.final_risk_level,
      manual_override: filterForm.manual_override,
    })
    assessmentList.value = result.items
    pagination.total = result.total
  } catch (error: any) {
    ElMessage.error(error.message || '获取评估列表失败')
  } finally {
    loading.value = false
  }
}

const resetFilter = () => {
  filterForm.final_risk_level = undefined
  filterForm.manual_override = undefined
  pagination.page = 1
  fetchAssessments()
}

const handleSizeChange = (size: number) => {
  pagination.pageSize = size
  pagination.page = 1
  fetchAssessments()
}

const handleCurrentChange = (page: number) => {
  pagination.page = page
  fetchAssessments()
}

const handleSelectionChange = (selection: ElTableRowSelection<any>) => {
  selectedRows.value = selection
}

const goToDetail = (id: number) => {
  router.push(`/risk-assessments/${id}`)
}

const handleExportSingle = async (row: any) => {
  try {
    const result = await exportMarkdown({ assessment_ids: [row.id] })
    const blob = new Blob([result.content], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `复核单_${row.id}.md`
    link.click()
    URL.revokeObjectURL(url)
    ElMessage.success('导出成功')
  } catch (error: any) {
    ElMessage.error(error.message || '导出失败')
  }
}

const handleBatchExport = async () => {
  if (selectedRows.value.length === 0) {
    ElMessage.warning('请先选择要导出的评估记录')
    return
  }
  
  const ids = selectedRows.value.map(r => r.id)
  
  try {
    const result = await exportMarkdown({ assessment_ids: ids })
    const blob = new Blob([result.content], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `复核单_批量_${dayjs().format('YYYYMMDD')}.md`
    link.click()
    URL.revokeObjectURL(url)
    ElMessage.success(`成功导出 ${ids.length} 条记录`)
  } catch (error: any) {
    ElMessage.error(error.message || '导出失败')
  }
}

onMounted(() => {
  fetchAssessments()
})
</script>

<style scoped>
.risk-assessments-container {
  min-height: 100%;
}

.filter-card {
  margin-bottom: 20px;
}

.filter-form {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
}

.text-muted {
  color: #909399;
}
</style>
