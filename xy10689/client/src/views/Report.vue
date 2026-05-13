<template>
  <div>
    <h2 style="margin-bottom: 20px">报表导出</h2>
    
    <el-card style="margin-bottom: 20px">
      <el-form :inline="true" :model="filters">
        <el-form-item label="开始日期">
          <el-date-picker v-model="filters.startDate" type="date" placeholder="选择开始日期" />
        </el-form-item>
        <el-form-item label="结束日期">
          <el-date-picker v-model="filters.endDate" type="date" placeholder="选择结束日期" />
        </el-form-item>
        <el-form-item label="处理人">
          <el-input v-model="filters.handler" placeholder="输入处理人" clearable />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleExport">导出 Excel</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card>
      <el-alert
        title="导出说明"
        type="info"
        description="导出的Excel报表包含以下内容：
1. 利用率统计：各会议室的预订情况、实际使用时长和利用率
2. 茶水服务记录：按处理人和时间筛选的服务详情
3. 故障工单：按处理人和时间筛选的工单处理记录"
        show-icon
      />
    </el-card>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { exportReport as exportReportApi } from '../api'
import dayjs from 'dayjs'

const filters = ref({
  startDate: dayjs().subtract(30, 'days').toDate(),
  endDate: new Date(),
  handler: ''
})

const handleExport = async () => {
  try {
    const params = {
      startDate: dayjs(filters.value.startDate).format('YYYY-MM-DD'),
      endDate: dayjs(filters.value.endDate).format('YYYY-MM-DD'),
      handler: filters.value.handler
    }
    
    const response = await exportReportApi(params)
    const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `会议室预约报表_${dayjs().format('YYYYMMDDHHmmss')}.xlsx`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
    
    ElMessage.success('导出成功')
  } catch (e) {
    console.error(e)
    ElMessage.error('导出失败')
  }
}
</script>
