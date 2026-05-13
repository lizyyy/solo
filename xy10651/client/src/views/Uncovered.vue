<template>
  <div>
    <h2 style="margin-bottom: 20px">未覆盖岗位管理</h2>

    <el-alert
      title="未覆盖岗位机制"
      type="info"
      :closable="false"
      style="margin-bottom: 20px"
    >
      <p>1. 设备巡检发现问题时自动创建未覆盖岗位记录</p>
      <p>2. 需要专人解决后才能标记为已覆盖</p>
      <p>3. 所有操作都会留痕记录</p>
    </el-alert>

    <el-table :data="uncovered" border>
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column prop="hall_name" label="影厅" width="120" />
      <el-table-column prop="position_name" label="岗位" width="150" />
      <el-table-column prop="detected_time" label="发现时间" width="180">
        <template #default="{ row }">{{ formatTime(row.detected_time) }}</template>
      </el-table-column>
      <el-table-column prop="resolved" label="状态" width="120">
        <template #default="{ row }">
          <el-tag :type="row.resolved ? 'success' : 'warning'">
            {{ row.resolved ? '已覆盖' : '未覆盖' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="resolver_name" label="解决人" width="120" />
      <el-table-column prop="notes" label="备注" width="200" show-overflow-tooltip />
      <el-table-column label="操作" width="150">
        <template #default="{ row }">
          <el-button v-if="!row.resolved" size="small" @click="resolvePosition(row)" type="success">标记已覆盖</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="resolveDialogVisible" title="标记已覆盖" width="500px">
      <el-form :model="resolveForm" label-width="100px">
        <el-form-item label="解决人">
          <el-select v-model="resolveForm.resolved_by" placeholder="请选择" style="width: 100%">
            <el-option v-for="staff in staffList" :key="staff.id" :label="staff.name" :value="staff.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="resolveForm.notes" type="textarea" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="resolveDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmResolve">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { positionsAPI, staffAPI } from '../api'

const uncovered = ref([])
const staffList = ref([])
const resolveDialogVisible = ref(false)
const currentUncovered = ref(null)
const resolveForm = ref({ resolved_by: null, notes: '' })

const loadUncovered = async () => {
  try {
    const res = await positionsAPI.uncovered()
    uncovered.value = res.data
  } catch (err) {
    ElMessage.error('加载失败')
  }
}

const loadStaff = async () => {
  try {
    const res = await staffAPI.list()
    staffList.value = res.data
  } catch (err) {
    ElMessage.error('加载员工失败')
  }
}

const formatTime = (time) => {
  if (!time) return '-'
  return new Date(time).toLocaleString('zh-CN')
}

const resolvePosition = (row) => {
  currentUncovered.value = row
  resolveForm.value = { resolved_by: null, notes: '' }
  resolveDialogVisible.value = true
}

const confirmResolve = async () => {
  if (!resolveForm.value.resolved_by) {
    ElMessage.warning('请选择解决人')
    return
  }
  try {
    await positionsAPI.resolveUncovered(currentUncovered.value.id, resolveForm.value.resolved_by, resolveForm.value.notes)
    ElMessage.success('已标记为已覆盖')
    resolveDialogVisible.value = false
    loadUncovered()
  } catch (err) {
    ElMessage.error('操作失败')
  }
}

onMounted(() => {
  loadUncovered()
  loadStaff()
})
</script>
