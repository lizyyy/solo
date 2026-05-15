<template>
  <div>
    <el-card shadow="never">
      <template #header>
        <span>报表筛选条件</span>
      </template>
      <el-form :inline="true" :model="filterForm">
        <el-form-item label="责任人">
          <el-input v-model="filterForm.handler" placeholder="处理人名称" />
        </el-form-item>
        <el-form-item label="开始时间">
          <el-date-picker v-model="filterForm.startTime" type="date" value-format="YYYY-MM-DD" />
        </el-form-item>
        <el-form-item label="结束时间">
          <el-date-picker v-model="filterForm.endTime" type="date" value-format="YYYY-MM-DD" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="exportReport">导出Excel</el-button>
          <el-button type="success" @click="loadSummary">统计汇总</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-row :gutter="20" style="margin-top: 20px" v-if="summary">
      <el-col :span="12">
        <el-card shadow="never">
          <template #header>
            <span>材料缺口统计</span>
          </template>
          <el-descriptions :column="2" border>
            <el-descriptions-item label="总计">{{ summary.gapStats.total }}</el-descriptions-item>
            <el-descriptions-item label="已解决">{{ summary.gapStats.resolved }}</el-descriptions-item>
            <el-descriptions-item label="未解决">{{ summary.gapStats.unresolved }}</el-descriptions-item>
          </el-descriptions>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card shadow="never">
          <template #header>
            <span>异常处理统计</span>
          </template>
          <el-descriptions :column="2" border>
            <el-descriptions-item label="总计">{{ summary.exceptionStats.total }}</el-descriptions-item>
            <el-descriptions-item label="已修复">{{ summary.exceptionStats.fixed }}</el-descriptions-item>
            <el-descriptions-item label="未修复">{{ summary.exceptionStats.unfixed }}</el-descriptions-item>
          </el-descriptions>
        </el-card>
      </el-col>
    </el-row>

    <el-card shadow="never" style="margin-top: 20px" v-if="summary && summary.handlers.length">
      <template #header>
        <span>处理人排行</span>
      </template>
      <el-table :data="summary.handlers" style="width: 100%">
        <el-table-column prop="name" label="处理人" />
        <el-table-column prop="count" label="处理数量" />
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { reportApi } from '../api'
import { ElMessage } from 'element-plus'

const filterForm = ref({
  handler: '',
  startTime: '',
  endTime: ''
})
const summary = ref(null)

const exportReport = async () => {
  try {
    const res = await reportApi.exportReport(filterForm.value)
    if (res.data.success) {
      window.open(res.data.data.downloadUrl, '_blank')
      ElMessage.success('报表导出成功')
    }
  } catch (error) {
    ElMessage.error('导出失败')
  }
}

const loadSummary = async () => {
  try {
    const res = await reportApi.getSummary(filterForm.value)
    if (res.data.success) {
      summary.value = res.data.data
    }
  } catch (error) {
    ElMessage.error('加载统计失败')
  }
}
</script>
