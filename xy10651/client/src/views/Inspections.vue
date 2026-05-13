<template>
  <div>
    <h2 style="margin-bottom: 20px">设备巡检管理</h2>

    <el-alert
      title="设备巡检拦截机制"
      type="info"
      :closable="false"
      style="margin-bottom: 20px"
    >
      <p>1. 清洁任务未完成时，无法开始设备巡检</p>
      <p>2. 巡检发现问题时，自动创建未覆盖岗位记录</p>
      <p>3. 设备问题需维修人员解决后才能标记为已解决</p>
    </el-alert>

    <el-table :data="inspections" border>
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column prop="hall_name" label="影厅" width="120" />
      <el-table-column prop="inspector_name" label="巡检员" width="120" />
      <el-table-column prop="inspection_time" label="巡检时间" width="180">
        <template #default="{ row }">{{ formatTime(row.inspection_time) }}</template>
      </el-table-column>
      <el-table-column prop="status" label="状态" width="120">
        <template #default="{ row }">
          <el-tag :type="getStatusType(row.status)">{{ getStatusText(row.status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="issues" label="问题" width="200" show-overflow-tooltip />
      <el-table-column label="操作" width="350">
        <template #default="{ row }">
          <el-button size="small" @click="viewDetail(row)" type="primary">详情</el-button>
          <el-button v-if="row.status === 'pending'" size="small" @click="startInspection(row)" type="success">开始巡检</el-button>
          <el-button v-if="row.status === 'needs_repair'" size="small" @click="resolveInspection(row)" type="warning">解决问题</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="resolveDialogVisible" title="解决问题" width="500px">
      <el-form :model="resolveForm" label-width="100px">
        <el-form-item label="解决人">
          <el-select v-model="resolveForm.resolved_by" placeholder="请选择">
            <el-option v-for="staff in staffList" :key="staff.id" :label="staff.name" :value="staff.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="解决方案">
          <el-input v-model="resolveForm.resolution" type="textarea" />
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
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { inspectionsAPI, staffAPI } from '../api'

const router = useRouter()
const inspections = ref([])
const staffList = ref([])
const resolveDialogVisible = ref(false)
const currentInspection = ref(null)
const resolveForm = ref({ resolved_by: null, resolution: '' })

const loadInspections = async () => {
  try {
    const res = await inspectionsAPI.list()
    inspections.value = res.data
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

const getStatusType = (status) => {
  const map = { pending: 'info', in_progress: 'primary', passed: 'success', needs_repair: 'warning', resolved: 'success' }
  return map[status] || 'info'
}

const getStatusText = (status) => {
  const map = { pending: '待巡检', in_progress: '巡检中', passed: '已通过', needs_repair: '需维修', resolved: '已解决' }
  return map[status] || status
}

const viewDetail = (row) => {
  router.push(`/inspections/${row.id}`)
}

const startInspection = async (row) => {
  if (staffList.value.length === 0) {
    ElMessage.warning('请先添加员工')
    return
  }
  try {
    await inspectionsAPI.start(row.id, staffList.value[0].id)
    ElMessage.success('巡检已开始')
    loadInspections()
  } catch (err) {
    ElMessage.error(err.response?.data?.error || '操作失败')
  }
}

const resolveInspection = (row) => {
  currentInspection.value = row
  resolveForm.value = { resolved_by: null, resolution: '' }
  resolveDialogVisible.value = true
}

const confirmResolve = async () => {
  if (!resolveForm.value.resolved_by) {
    ElMessage.warning('请选择解决人')
    return
  }
  try {
    await inspectionsAPI.resolve(currentInspection.value.id, resolveForm.value.resolved_by, resolveForm.value.resolution)
    ElMessage.success('问题已解决')
    resolveDialogVisible.value = false
    loadInspections()
  } catch (err) {
    ElMessage.error('操作失败')
  }
}

onMounted(() => {
  loadInspections()
  loadStaff()
})
</script>
