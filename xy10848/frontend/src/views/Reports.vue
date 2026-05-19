<template>
  <div>
    <h2 style="margin-bottom: 20px">报表导出</h2>

    <el-row :gutter="20">
      <el-col :span="12">
        <el-card>
          <template #header>
            <span>月度汇总报表</span>
          </template>
          <el-form :model="monthlyForm" label-width="80px">
            <el-form-item label="年份">
              <el-select v-model="monthlyForm.year">
                <el-option :value="2024" label="2024" />
                <el-option :value="2025" label="2025" />
              </el-select>
            </el-form-item>
            <el-form-item label="月份">
              <el-select v-model="monthlyForm.month">
                <el-option v-for="m in 12" :key="m" :value="m" :label="m + '月'" />
              </el-select>
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="exportMonthly">导出CSV</el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </el-col>

      <el-col :span="12">
        <el-card>
          <template #header>
            <span>成员使用明细</span>
          </template>
          <el-form :model="memberForm" label-width="80px">
            <el-form-item label="成员">
              <el-select v-model="memberForm.member_id" placeholder="请选择">
                <el-option v-for="m in members" :key="m.id" :label="m.name" :value="m.id" />
              </el-select>
            </el-form-item>
            <el-form-item label="年份">
              <el-select v-model="memberForm.year" clearable>
                <el-option :value="2024" label="2024" />
                <el-option :value="2025" label="2025" />
              </el-select>
            </el-form-item>
            <el-form-item label="月份">
              <el-select v-model="memberForm.month" clearable>
                <el-option v-for="m in 12" :key="m" :value="m" :label="m + '月'" />
              </el-select>
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="exportMember" :disabled="!memberForm.member_id">导出CSV</el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </el-col>
    </el-row>

    <el-divider />

    <h3 style="margin-bottom: 15px">月度汇总预览</h3>
    <el-card>
      <el-table :data="summaries" style="width: 100%">
        <el-table-column prop="year" label="年份" width="100" />
        <el-table-column prop="month" label="月份" width="100" />
        <el-table-column prop="member_id" label="成员ID" width="150" show-overflow-tooltip />
        <el-table-column prop="project_id" label="项目ID" width="150" show-overflow-tooltip />
        <el-table-column prop="total_requests" label="总请求数" width="100" />
        <el-table-column prop="successful_requests" label="成功数" width="100" />
        <el-table-column prop="failed_requests" label="失败数" width="100" />
        <el-table-column prop="quota_consumed" label="消耗额度" width="120" />
        <el-table-column prop="quota_returned" label="返还额度" width="120" />
        <el-table-column prop="net_quota_used" label="净使用" width="120" />
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useQuotaStore } from '../stores/quota'
import { ElMessage } from 'element-plus'
import axios from 'axios'

const store = useQuotaStore()
const now = new Date()

const monthlyForm = ref({ year: now.getFullYear(), month: now.getMonth() + 1 })
const memberForm = ref({ member_id: '', year: now.getFullYear(), month: now.getMonth() + 1 })

const members = computed(() => store.members)
const summaries = computed(() => store.summaries)

const exportMonthly = async () => {
  try {
    const res = await axios.get('/api/export/monthly-report', {
      params: monthlyForm.value,
      responseType: 'blob'
    })
    const url = window.URL.createObjectURL(new Blob([res.data]))
    const link = document.createElement('a')
    link.href = url
    link.download = `monthly-report-${monthlyForm.value.year}-${monthlyForm.value.month}.csv`
    link.click()
    ElMessage.success('导出成功')
  } catch (e) {
    ElMessage.error('导出失败')
  }
}

const exportMember = async () => {
  try {
    const params = { member_id: memberForm.value.member_id }
    if (memberForm.value.year) params.year = memberForm.value.year
    if (memberForm.value.month) params.month = memberForm.value.month
    
    const res = await axios.get('/api/export/member-details', {
      params,
      responseType: 'blob'
    })
    const url = window.URL.createObjectURL(new Blob([res.data]))
    const link = document.createElement('a')
    link.href = url
    link.download = `member-${memberForm.value.member_id}-details.csv`
    link.click()
    ElMessage.success('导出成功')
  } catch (e) {
    ElMessage.error('导出失败')
  }
}

onMounted(async () => {
  await store.fetchMembers()
  await store.fetchSummaries()
})
</script>
