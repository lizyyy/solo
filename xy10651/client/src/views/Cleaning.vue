<template>
  <div>
    <h2 style="margin-bottom: 20px">散场清洁管理</h2>

    <el-table :data="cleanings" border>
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column prop="hall_name" label="影厅" width="120" />
      <el-table-column prop="movie_name" label="影片" width="180" />
      <el-table-column prop="staff_name" label="负责人" width="120" />
      <el-table-column prop="scheduled_time" label="计划时间" width="180">
        <template #default="{ row }">{{ formatTime(row.scheduled_time) }}</template>
      </el-table-column>
      <el-table-column prop="status" label="状态" width="120">
        <template #default="{ row }">
          <el-tag :type="getStatusType(row.status)">{{ getStatusText(row.status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="400">
        <template #default="{ row }">
          <el-button size="small" @click="viewDetail(row)" type="primary">详情</el-button>
          <el-button v-if="row.status === 'pending'" size="small" @click="assignStaff(row)">分配人员</el-button>
          <el-button v-if="row.status === 'pending' && row.assigned_staff_id" size="small" @click="startCleaning(row)" type="success">开始清洁</el-button>
          <el-button v-if="row.status === 'in_progress'" size="small" @click="completeCleaning(row)" type="warning">完成清洁</el-button>
          <el-button v-if="row.status === 'completed'" size="small" @click="reviewCleaning(row, true)" type="success">复核通过</el-button>
          <el-button v-if="row.status === 'completed'" size="small" @click="reviewCleaning(row, false)" type="danger">驳回</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="assignDialogVisible" title="分配人员" width="400px">
      <el-select v-model="selectedStaffId" placeholder="请选择员工" style="width: 100%">
        <el-option v-for="staff in staffList" :key="staff.id" :label="staff.name" :value="staff.id" />
      </el-select>
      <template #footer>
        <el-button @click="assignDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmAssign">确定</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="completeDialogVisible" title="完成清洁" width="500px">
      <el-form :model="completeForm" label-width="100px">
        <el-form-item label="质量评分">
          <el-rate v-model="completeForm.quality_score" :max="5" show-score />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="completeForm.notes" type="textarea" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="completeDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmComplete">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { cleaningAPI, staffAPI } from '../api'

const router = useRouter()
const cleanings = ref([])
const staffList = ref([])
const assignDialogVisible = ref(false)
const completeDialogVisible = ref(false)
const currentCleaning = ref(null)
const selectedStaffId = ref(null)
const completeForm = ref({ quality_score: 5, notes: '' })

const loadCleanings = async () => {
  try {
    const res = await cleaningAPI.list()
    cleanings.value = res.data
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
  const map = { pending: 'info', in_progress: 'primary', completed: 'warning', reviewed: 'success', rejected: 'danger' }
  return map[status] || 'info'
}

const getStatusText = (status) => {
  const map = { pending: '待分配', in_progress: '清洁中', completed: '待复核', reviewed: '已通过', rejected: '已驳回' }
  return map[status] || status
}

const viewDetail = (row) => {
  router.push(`/cleaning/${row.id}`)
}

const assignStaff = (row) => {
  currentCleaning.value = row
  selectedStaffId.value = null
  assignDialogVisible.value = true
}

const confirmAssign = async () => {
  if (!selectedStaffId.value) {
    ElMessage.warning('请选择员工')
    return
  }
  try {
    await cleaningAPI.assign(currentCleaning.value.id, selectedStaffId.value)
    ElMessage.success('分配成功')
    assignDialogVisible.value = false
    loadCleanings()
  } catch (err) {
    ElMessage.error(err.response?.data?.error || '分配失败')
  }
}

const startCleaning = async (row) => {
  try {
    await cleaningAPI.start(row.id)
    ElMessage.success('已开始清洁')
    loadCleanings()
  } catch (err) {
    ElMessage.error('操作失败')
  }
}

const completeCleaning = (row) => {
  currentCleaning.value = row
  completeForm.value = { quality_score: 5, notes: '' }
  completeDialogVisible.value = true
}

const confirmComplete = async () => {
  try {
    await cleaningAPI.complete(currentCleaning.value.id, completeForm.value)
    ElMessage.success('清洁已完成，设备巡检已创建')
    completeDialogVisible.value = false
    loadCleanings()
  } catch (err) {
    ElMessage.error('操作失败')
  }
}

const reviewCleaning = async (row, approved) => {
  try {
    await cleaningAPI.review(row.id, approved, '')
    ElMessage.success(approved ? '复核通过' : '已驳回')
    loadCleanings()
  } catch (err) {
    ElMessage.error('操作失败')
  }
}

onMounted(() => {
  loadCleanings()
  loadStaff()
})
</script>
