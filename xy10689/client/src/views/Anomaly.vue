<template>
  <div>
    <h2 style="margin-bottom: 20px">异常看板</h2>
    
    <el-card style="margin-bottom: 20px">
      <el-form :inline="true" :model="filters">
        <el-form-item label="状态">
          <el-select v-model="filters.status" placeholder="选择状态" clearable>
            <el-option label="待处理" value="pending" />
            <el-option label="已处理" value="resolved" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadData">查询</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card>
      <el-table :data="anomalies" style="width: 100%">
        <el-table-column prop="type" label="异常类型" />
        <el-table-column prop="description" label="异常描述" show-overflow-tooltip />
        <el-table-column prop="reason" label="原因" show-overflow-tooltip />
        <el-table-column prop="status" label="状态">
          <template #default="{ row }">
            <el-tag :type="row.status === 'pending' ? 'danger' : 'success'">
              {{ row.status === 'pending' ? '待处理' : '已处理' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="handler" label="处理人" />
        <el-table-column prop="handled_at" label="处理时间" />
        <el-table-column prop="created_at" label="创建时间" />
        <el-table-column label="操作" width="100">
          <template #default="{ row }">
            <el-button size="small" type="primary" :disabled="row.status === 'resolved'" @click="handleResolve(row)">处理</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="showResolveDialog" title="人工修正" width="600px">
      <el-form :model="resolveForm" label-width="80px">
        <el-form-item label="处理人">
          <el-input v-model="resolveForm.handler" />
        </el-form-item>
        <el-form-item label="修正前内容">
          <el-input v-model="resolveForm.correction_before" type="textarea" :rows="4" />
        </el-form-item>
        <el-form-item label="修正后内容">
          <el-input v-model="resolveForm.correction_after" type="textarea" :rows="4" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showResolveDialog = false">取消</el-button>
        <el-button type="primary" @click="submitResolve">确认处理</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { getAnomalies, resolveAnomaly as resolveAnomalyApi } from '../api'

const filters = ref({ status: '' })
const anomalies = ref([])
const showResolveDialog = ref(false)
const currentAnomaly = ref(null)

const resolveForm = ref({
  handler: '',
  correction_before: '',
  correction_after: ''
})

const loadData = async () => {
  try {
    const res = await getAnomalies(filters.value)
    anomalies.value = res.data
  } catch (e) {
    console.error(e)
  }
}

const handleResolve = (row) => {
  currentAnomaly.value = row
  resolveForm.value = {
    handler: '管理员',
    correction_before: row.correction_before || '',
    correction_after: ''
  }
  showResolveDialog.value = true
}

const submitResolve = async () => {
  try {
    await resolveAnomalyApi(currentAnomaly.value.id, resolveForm.value)
    ElMessage.success('处理成功')
    showResolveDialog.value = false
    loadData()
  } catch (e) {
    console.error(e)
  }
}

onMounted(() => {
  loadData()
})
</script>
