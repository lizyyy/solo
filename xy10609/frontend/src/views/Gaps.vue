<template>
  <div>
    <el-card shadow="never">
      <el-form :inline="true" :model="searchForm">
        <el-form-item label="严重程度">
          <el-select v-model="searchForm.severity" clearable>
            <el-option label="高" value="high" />
            <el-option label="中" value="medium" />
            <el-option label="低" value="low" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="searchForm.isResolved" clearable>
            <el-option label="未解决" :value="false" />
            <el-option label="已解决" :value="true" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadGaps">查询</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never" style="margin-top: 20px">
      <el-table :data="gaps" style="width: 100%">
        <el-table-column prop="gap_type" label="缺口类型" width="120" />
        <el-table-column prop="gap_description" label="缺口描述" />
        <el-table-column prop="matter_name" label="所属事项" width="150" />
        <el-table-column prop="attachment_name" label="关联附件" width="150" />
        <el-table-column prop="severity" label="严重程度" width="100">
          <template #default="{ row }">
            <el-tag :type="row.severity === 'high' ? 'danger' : row.severity === 'medium' ? 'warning' : 'success'">
              {{ row.severity === 'high' ? '高' : row.severity === 'medium' ? '中' : '低' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="is_resolved" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.is_resolved ? 'success' : 'danger'">
              {{ row.is_resolved ? '已解决' : '未解决' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120">
          <template #default="{ row }">
            <el-button v-if="!row.is_resolved" size="small" type="primary" @click="resolveGap(row)">标记解决</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { gapsApi } from '../api'
import { ElMessage, ElMessageBox } from 'element-plus'

const searchForm = ref({ severity: '', isResolved: undefined })
const gaps = ref([])

const loadGaps = async () => {
  try {
    const res = await gapsApi.getGaps(searchForm.value)
    if (res.data.success) {
      gaps.value = res.data.data
    }
  } catch (error) {
    ElMessage.error('加载失败')
  }
}

const resolveGap = async (row) => {
  try {
    await ElMessageBox.confirm('确定标记为已解决？', '提示')
    await gapsApi.resolveGap(row.id, { resolvedBy: 'admin' })
    ElMessage.success('操作成功')
    loadGaps()
  } catch (error) {
    if (error !== 'cancel') ElMessage.error('操作失败')
  }
}

onMounted(() => {
  loadGaps()
})
</script>
