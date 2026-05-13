<template>
  <div>
    <h2 style="margin-bottom: 20px">操作日志</h2>
    
    <el-card style="margin-bottom: 20px">
      <el-form :inline="true" :model="filterForm">
        <el-form-item label="责任人">
          <el-input v-model="filterForm.responsible_person" placeholder="请输入操作人" />
        </el-form-item>
        <el-form-item label="开始日期">
          <el-date-picker v-model="filterForm.start_date" type="date" value-format="YYYY-MM-DD" placeholder="选择开始日期" />
        </el-form-item>
        <el-form-item label="结束日期">
          <el-date-picker v-model="filterForm.end_date" type="date" value-format="YYYY-MM-DD" placeholder="选择结束日期" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadData">查询</el-button>
          <el-button @click="resetFilter">重置</el-button>
          <el-button type="success" @click="exportData">导出Excel</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-table :data="logs" style="width: 100%" border>
      <el-table-column prop="operation_time" label="操作时间" width="180" />
      <el-table-column prop="operator" label="操作人" width="100" />
      <el-table-column prop="module" label="模块" width="120" />
      <el-table-column prop="operation_type" label="操作类型" width="100" />
      <el-table-column prop="remarks" label="备注" />
      <el-table-column label="修改前后值" width="300">
        <template #default="{ row }">
          <div v-if="row.before_values || row.after_values">
            <el-tag size="small" type="info" style="margin-bottom: 5px">修改前</el-tag>
            <div style="font-size: 12px; color: #666; margin-bottom: 5px">{{ formatValue(row.before_values) }}</div>
            <el-tag size="small" type="success">修改后</el-tag>
            <div style="font-size: 12px; color: #666">{{ formatValue(row.after_values) }}</div>
          </div>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'
import { ElMessage } from 'element-plus'

const logs = ref([])
const filterForm = ref({
  responsible_person: '',
  start_date: '',
  end_date: ''
})

const formatValue = (val) => {
  if (!val) return '-'
  if (typeof val === 'object') return JSON.stringify(val)
  return val
}

const loadData = async () => {
  const params = {}
  if (filterForm.value.responsible_person) params.responsible_person = filterForm.value.responsible_person
  if (filterForm.value.start_date) params.start_date = filterForm.value.start_date
  if (filterForm.value.end_date) params.end_date = filterForm.value.end_date
  
  const res = await axios.get('/api/logs', { params })
  logs.value = res.data
}

const resetFilter = () => {
  filterForm.value = { responsible_person: '', start_date: '', end_date: '' }
  loadData()
}

const exportData = async () => {
  try {
    const params = {}
    if (filterForm.value.responsible_person) params.responsible_person = filterForm.value.responsible_person
    if (filterForm.value.start_date) params.start_date = filterForm.value.start_date
    if (filterForm.value.end_date) params.end_date = filterForm.value.end_date
    
    const res = await axios.get('/api/export', {
      params,
      responseType: 'blob'
    })
    
    const url = window.URL.createObjectURL(new Blob([res.data]))
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', 'operation_logs.xlsx')
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    ElMessage.success('导出成功')
  } catch (err) {
    ElMessage.error('导出失败')
  }
}

onMounted(() => {
  loadData()
})
</script>
