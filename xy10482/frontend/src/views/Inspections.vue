<template>
  <div class="inspections-page">
    <el-card>
      <template #header>
        <span>质检记录列表</span>
      </template>
      <el-table :data="inspections" border>
        <el-table-column prop="batch_no" label="批次号" width="180"></el-table-column>
        <el-table-column prop="plot_name" label="地块" width="100"></el-table-column>
        <el-table-column prop="grade_name" label="等级" width="80"></el-table-column>
        <el-table-column prop="batch_quantity" label="批次数量" width="100">
          <template #default="{ row }">{{ row.batch_quantity }} kg</template>
        </el-table-column>
        <el-table-column prop="inspector" label="质检员" width="100"></el-table-column>
        <el-table-column prop="result" label="质检结果" width="100">
          <template #default="{ row }">
            <el-tag :type="getResultType(row.result)">{{ getResultText(row.result) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="score" label="评分" width="80"></el-table-column>
        <el-table-column prop="defects" label="缺陷"></el-table-column>
        <el-table-column prop="inspection_date" label="质检时间" width="180"></el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { inspectionApi } from '../api'

const inspections = ref([])

const getResultType = (result) => {
  const map = {
    passed: 'success',
    failed: 'danger',
    pending: 'warning'
  }
  return map[result] || 'info'
}

const getResultText = (result) => {
  const map = {
    passed: '通过',
    failed: '不通过',
    pending: '待定'
  }
  return map[result] || result
}

const loadData = async () => {
  const res = await inspectionApi.getAll()
  if (res.data.success) {
    inspections.value = res.data.data
  }
}

onMounted(() => {
  loadData()
})
</script>

<style scoped>
</style>
