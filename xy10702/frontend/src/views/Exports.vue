<template>
  <div class="exports-page">
    <h2>导出面板</h2>
    
    <el-card style="margin-bottom: 20px">
      <template #header>新建导出</template>
      <el-form :inline="true" :model="exportForm" label-width="80px">
        <el-form-item label="导出类型">
          <el-select v-model="exportForm.export_type" style="width: 200px">
            <el-option label="会话列表" value="sessions" />
            <el-option label="回调记录" value="callbacks" />
            <el-option label="Token交换" value="token_exchanges" />
            <el-option label="时间线事件" value="timeline" />
            <el-option label="完整报告" value="full_report" />
          </el-select>
        </el-form-item>
        <el-form-item label="格式">
          <el-select v-model="exportFormat" style="width: 150px">
            <el-option label="Excel (.xlsx)" value="xlsx" />
            <el-option label="CSV" value="csv" />
            <el-option label="JSON" value="json" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="createExport" :loading="loading">
            <el-icon><Download /></el-icon> 生成导出
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card>
      <template #header>
        <span>历史导出 ({{ exports.length }})</span>
      </template>
      <el-table :data="exports" stripe>
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="export_type" label="类型" width="120">
          <template #default="{ row }">{{ getTypeLabel(row.export_type) }}</template>
        </el-table-column>
        <el-table-column prop="format" label="格式" width="100">
          <template #default="{ row }">
            <el-tag size="small" type="info">{{ row.format }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="filename" label="文件名" min-width="200" show-overflow-tooltip />
        <el-table-column prop="record_count" label="记录数" width="100" />
        <el-table-column prop="created_at" label="创建时间" width="180">
          <template #default="{ row }">{{ formatDate(row.created_at) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button size="small" type="primary" @click="download(row.id)">下载</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import api from '@/utils/api'
import { Download } from '@element-plus/icons-vue'

const loading = ref(false)
const exports = ref([])
const exportForm = ref({
  export_type: 'sessions',
  format: 'xlsx'
})
const exportFormat = ref('xlsx')

const loadExports = async () => {
  try {
    const res = await api.getExports()
    exports.value = res.data
  } catch (e) {
    ElMessage.error('加载导出列表失败')
  }
}

const createExport = async () => {
  loading.value = true
  try {
    const data = {
      export_type: exportForm.value.export_type,
      format: exportFormat.value
    }
    await api.createExport(data)
    ElMessage.success('导出文件已生成')
    loadExports()
  } catch (e) {
    ElMessage.error('导出失败')
  } finally {
    loading.value = false
  }
}

const download = (id) => {
  api.downloadExport(id)
  ElMessage.success('正在下载...')
}

const getTypeLabel = (type) => {
  const map = {
    sessions: '会话列表',
    callbacks: '回调记录',
    token_exchanges: 'Token交换',
    timeline: '时间线',
    full_report: '完整报告'
  }
  return map[type] || type
}

const formatDate = (dateStr) => {
  return dateStr ? new Date(dateStr).toLocaleString('zh-CN') : '-'
}

onMounted(() => {
  loadExports()
})
</script>

<style scoped>
.exports-page h2 {
  margin: 0 0 20px 0;
  color: #303133;
}
</style>
