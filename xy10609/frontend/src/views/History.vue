<template>
  <div>
    <el-card shadow="never">
      <el-form :inline="true" :model="searchForm">
        <el-form-item label="表名">
          <el-select v-model="searchForm.tableName" clearable>
            <el-option label="办事事项" value="business_matters" />
            <el-option label="身份类型" value="identity_types" />
            <el-option label="附件" value="attachments" />
          </el-select>
        </el-form-item>
        <el-form-item label="修改人">
          <el-input v-model="searchForm.changedBy" clearable />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadHistory">查询</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never" style="margin-top: 20px">
      <el-table :data="history" style="width: 100%">
        <el-table-column prop="table_name" label="表名" width="150">
          <template #default="{ row }">
            <el-tag size="small">{{ getTableNameCN(row.table_name) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="record_id" label="记录ID" width="100" />
        <el-table-column prop="field_name" label="字段名" width="150" />
        <el-table-column prop="old_value" label="修改前值" show-overflow-tooltip />
        <el-table-column prop="new_value" label="修改后值" show-overflow-tooltip />
        <el-table-column prop="changed_by" label="修改人" width="120" />
        <el-table-column prop="changed_at" label="修改时间" width="180" />
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { historyApi } from '../api'
import { ElMessage } from 'element-plus'

const searchForm = ref({ tableName: '', changedBy: '' })
const history = ref([])

const getTableNameCN = (tableName) => {
  const map = {
    'business_matters': '办事事项',
    'identity_types': '身份类型',
    'attachments': '附件'
  }
  return map[tableName] || tableName
}

const loadHistory = async () => {
  try {
    const res = await historyApi.getHistory(searchForm.value)
    if (res.data.success) {
      history.value = res.data.data
    }
  } catch (error) {
    ElMessage.error('加载失败')
  }
}

onMounted(() => {
  loadHistory()
})
</script>
