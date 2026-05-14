<template>
  <div class="reports-page">
    <h2 class="page-title">报表管理</h2>
    
    <el-card class="export-card">
      <template #header>
        <span>数据导出</span>
      </template>
      <el-form :model="exportForm" label-width="120px">
        <el-row :gutter="20">
          <el-col :span="8">
            <el-form-item label="导出类型" required>
            <el-select v-model="exportForm.export_type" placeholder="请选择导出类型" style="width: 100%">
              <el-option label="学员进度数据" value="progress" />
              <el-option label="补学任务数据" value="remedial_tasks" />
              <el-option label="证书资格数据" value="certificates" />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="8">
          <el-form-item label="文件格式">
            <el-select v-model="exportForm.file_format" placeholder="请选择文件格式" style="width: 100%">
              <el-option label="Excel (.xlsx)" value="xlsx" />
              <el-option label="CSV (.csv)" value="csv" />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="8">
          <el-form-item>
            <el-button type="primary" @click="handleExport" :loading="exporting">
              <el-icon><Download /></el-icon>
              开始导出
            </el-button>
          </el-form-item>
        </el-col>
      </el-row>
    </el-form>
  </el-card>

    <el-card class="table-card">
      <template #header>
        <span>导出历史</span>
      </template>
      <el-table
        :data="tableData"
        v-loading="loading"
        border
        stripe
        style="width: 100%"
      >
        <el-table-column prop="report_id" label="报表ID" width="200" />
        <el-table-column prop="report_type" label="报表类型" width="150">
          <template #default="{ row }">
            <el-tag>{{ getReportTypeName(row.report_type) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="report_name" label="报表名称" min-width="180" show-overflow-tooltip />
        <el-table-column prop="generated_by" label="生成人" width="120" />
        <el-table-column prop="generated_at" label="生成时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.generated_at) }}
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 'completed' ? 'success' : 'warning'">
              {{ row.status === 'completed' ? '已完成' : '处理中' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="downloadReport(row)">
              <el-icon><Download /></el-icon>
              下载
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.page_size"
        :total="pagination.total"
        :page-sizes="[10, 20, 50, 100]"
        layout="total, sizes, prev, pager, next, jumper"
        @size-change="loadData"
        @current-change="loadData"
        class="pagination"
      />
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { reportApi } from '@/api'
import { ElMessage } from 'element-plus'

const loading = ref(false)
const exporting = ref(false)
const tableData = ref([])

const pagination = reactive({
  page: 1,
  page_size: 20,
  total: 0
})

const exportForm = reactive({
  export_type: '',
  file_format: 'xlsx',
  filters: {}
})

const loadData = async () => {
  loading.value = true
  try {
    const response = await reportApi.getList({
      page: pagination.page,
      page_size: pagination.page_size
    })
    if (response.data.success) {
      tableData.value = response.data.data.items
      pagination.total = response.data.data.total
    }
  } catch (error) {
    ElMessage.error('加载数据失败')
  } finally {
    loading.value = false
  }
}

const handleExport = async () => {
  if (!exportForm.export_type) {
    ElMessage.warning('请选择导出类型')
    return
  }

  exporting.value = true
  try {
    const response = await reportApi.export(exportForm)
    if (response.data.success) {
      ElMessage.success('导出成功，正在准备下载...')
      setTimeout(() => {
        downloadReport(response.data.data)
      }, 500)
      loadData()
    }
  } catch (error) {
    ElMessage.error('导出失败')
  } finally {
    exporting.value = false
  }
}

const downloadReport = (row) => {
  reportApi.download(row.report_id)
}

const getReportTypeName = (type) => {
  const map = {
    progress: '学员进度',
    remedial_tasks: '补学任务',
    certificates: '证书资格'
  }
  return map[type] || type
}

const formatDate = (dateStr) => {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleString('zh-CN')
}

loadData()
</script>

<style scoped>
.reports-page {
  padding: 0;
}

.page-title {
  margin: 0 0 20px 0;
  font-size: 24px;
  font-weight: 600;
  color: #303133;
}

.export-card {
  margin-bottom: 20px;
}

.table-card {
  margin-bottom: 20px;
}

.pagination {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}
</style>
