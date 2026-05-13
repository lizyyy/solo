<template>
  <div>
    <h2 style="margin-bottom: 20px">效期风险预警</h2>
    <el-table :data="risks" style="width: 100%" border>
      <el-table-column prop="medicine_name" label="药品名称" />
      <el-table-column prop="batch_number" label="批次号" />
      <el-table-column prop="box_name" label="所属药箱" />
      <el-table-column prop="risk_level" label="风险等级" width="120">
        <template #default="{ row }">
          <el-tag :type="getRiskType(row.risk_level)" size="small">
            {{ getRiskText(row.risk_level) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="days_to_expiry" label="剩余天数" width="100" />
      <el-table-column prop="risk_date" label="预警日期" />
      <el-table-column prop="processed" label="处理状态" width="100">
        <template #default="{ row }">
          <el-tag :type="row.processed ? 'success' : 'warning'">
            {{ row.processed ? '已处理' : '未处理' }}
          </el-tag>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'

const risks = ref([])

const getRiskType = (level) => {
  const map = { critical: 'danger', warning: 'warning', expired: 'info' }
  return map[level] || ''
}

const getRiskText = (level) => {
  const map = { critical: '紧急', warning: '预警', expired: '已过期' }
  return map[level] || level
}

const loadData = async () => {
  const res = await axios.get('/api/expiry-risks')
  risks.value = res.data
}

onMounted(() => {
  loadData()
})
</script>
