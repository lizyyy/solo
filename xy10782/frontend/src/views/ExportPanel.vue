<template>
  <div class="export-panel">
    <el-card>
      <template #header>导出数据</template>
      <el-form :inline="true" :model="exportForm" label-width="80px">
        <el-form-item label="开始日期">
          <el-date-picker v-model="exportForm.start_date" type="date" placeholder="选择开始日期" />
        </el-form-item>
        <el-form-item label="结束日期">
          <el-date-picker v-model="exportForm.end_date" type="date" placeholder="选择结束日期" />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="exportForm.status" placeholder="全部" clearable>
            <el-option label="待处理" value="pending" />
            <el-option label="质检通过" value="success" />
            <el-option label="质检拦截" value="blocked" />
            <el-option label="补偿处理" value="compensation" />
            <el-option label="人工复核" value="manual_review" />
          </el-select>
        </el-form-item>
        <el-form-item label="导出类型">
          <el-select v-model="exportForm.export_type">
            <el-option label="全部数据" value="all" />
            <el-option label="仅质检通过" value="success" />
            <el-option label="仅问题数据" value="issues" />
          </el-select>
        </el-form-item>
        <el-form-item label="操作人">
          <el-input v-model="exportForm.exported_by" placeholder="请输入操作人姓名" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="exportData" :loading="exporting">
            <el-icon><Download /></el-icon>
            导出Excel
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>
    
    <el-card style="margin-top: 20px">
      <template #header>历史导出记录</template>
      <el-table :data="exportList" border stripe>
        <el-table-column prop="filename" label="文件名" min-width="250" />
        <el-table-column prop="export_type" label="导出类型" width="120">
          <template #default="{ row }">
            <el-tag>{{ getExportTypeText(row.export_type) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="record_count" label="记录数" width="100" />
        <el-table-column prop="exported_by" label="操作人" width="120" />
        <el-table-column prop="exported_at" label="导出时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.exported_at) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="downloadFile(row.filename)">下载</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import dayjs from 'dayjs'
import { exportApi } from '../api'

const exportForm = ref({
  start_date: null,
  end_date: null,
  status: '',
  export_type: 'all',
  exported_by: ''
})

const exportList = ref([])
const exporting = ref(false)

const loadExportList = async () => {
  try {
    const res = await exportApi.list()
    exportList.value = res.data
  } catch (error) {
    console.error('加载导出列表失败')
  }
}

const exportData = async () => {
  if (!exportForm.value.exported_by) {
    ElMessage.warning('请输入操作人姓名')
    return
  }
  
  exporting.value = true
  try {
    const data = {
      ...exportForm.value,
      start_date: exportForm.value.start_date ? dayjs(exportForm.value.start_date).format('YYYY-MM-DD') : null,
      end_date: exportForm.value.end_date ? dayjs(exportForm.value.end_date).format('YYYY-MM-DD') : null
    }
    const res = await exportApi.export(data)
    ElMessage.success(`导出成功，共 ${res.data.count} 条记录`)
    loadExportList()
  } catch (error) {
    ElMessage.error('导出失败')
  } finally {
    exporting.value = false
  }
}

const downloadFile = (filename) => {
  window.open(exportApi.download(filename), '_blank')
}

const getExportTypeText = (type) => {
  const map = { all: '全部数据', success: '仅通过', issues: '仅问题' }
  return map[type] || type
}

const formatDate = (date) => {
  return dayjs(date).format('YYYY-MM-DD HH:mm:ss')
}

onMounted(() => {
  loadExportList()
})
</script>

<style scoped>
</style>
