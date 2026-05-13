<template>
  <div>
    <h2 style="margin-bottom: 20px">换班记录管理</h2>

    <el-alert
      title="重复回调防护机制"
      type="info"
      :closable="false"
      style="margin-bottom: 20px"
    >
      <p>1. 同一换班记录的回调在60秒内只能执行一次</p>
      <p>2. 超过频率限制会被拦截</p>
      <p>3. 每次回调都会留痕，可追踪操作历史</p>
    </el-alert>

    <el-button type="primary" @click="showCreateDialog" style="margin-bottom: 20px">
      申请换班
    </el-button>

    <el-table :data="shifts" border>
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column prop="cleaning_id" label="清洁任务" width="120" />
      <el-table-column prop="from_staff_name" label="原负责人" width="120" />
      <el-table-column prop="to_staff_name" label="新负责人" width="120" />
      <el-table-column prop="change_time" label="申请时间" width="180">
        <template #default="{ row }">{{ formatTime(row.change_time) }}</template>
      </el-table-column>
      <el-table-column prop="callback_count" label="回调次数" width="100" />
      <el-table-column prop="status" label="状态" width="120">
        <template #default="{ row }">
          <el-tag :type="getStatusType(row.status)">{{ getStatusText(row.status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="350">
        <template #default="{ row }">
          <el-button v-if="row.status === 'pending'" size="small" @click="approveShift(row)" type="success">批准</el-button>
          <el-button v-if="row.status === 'pending'" size="small" @click="rejectShift(row)" type="danger">拒绝</el-button>
          <el-button size="small" @click="triggerCallback(row)" type="warning">触发回调</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="createDialogVisible" title="申请换班" width="500px">
      <el-form :model="newShift" label-width="100px">
        <el-form-item label="清洁任务">
          <el-select v-model="newShift.cleaning_id" placeholder="请选择清洁任务" style="width: 100%">
            <el-option v-for="cleaning in cleanings" :key="cleaning.id" :label="`#${cleaning.id} - ${cleaning.hall_name}`" :value="cleaning.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="原负责人">
          <el-select v-model="newShift.from_staff_id" placeholder="请选择" style="width: 100%">
            <el-option v-for="staff in staffList" :key="staff.id" :label="staff.name" :value="staff.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="新负责人">
          <el-select v-model="newShift.to_staff_id" placeholder="请选择" style="width: 100%">
            <el-option v-for="staff in staffList" :key="staff.id" :label="staff.name" :value="staff.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="原因">
          <el-input v-model="newShift.reason" type="textarea" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="createShift">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { shiftsAPI, staffAPI, cleaningAPI } from '../api'

const shifts = ref([])
const staffList = ref([])
const cleanings = ref([])
const createDialogVisible = ref(false)
const newShift = ref({
  cleaning_id: null,
  from_staff_id: null,
  to_staff_id: null,
  reason: ''
})

const loadShifts = async () => {
  try {
    const res = await shiftsAPI.list()
    shifts.value = res.data
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

const loadCleanings = async () => {
  try {
    const res = await cleaningAPI.list()
    cleanings.value = res.data
  } catch (err) {
    ElMessage.error('加载清洁任务失败')
  }
}

const formatTime = (time) => {
  if (!time) return '-'
  return new Date(time).toLocaleString('zh-CN')
}

const getStatusType = (status) => {
  const map = { pending: 'warning', approved: 'success', rejected: 'danger' }
  return map[status] || 'info'
}

const getStatusText = (status) => {
  const map = { pending: '待审批', approved: '已批准', rejected: '已拒绝' }
  return map[status] || status
}

const showCreateDialog = () => {
  createDialogVisible.value = true
}

const createShift = async () => {
  if (!newShift.value.from_staff_id || !newShift.value.to_staff_id) {
    ElMessage.warning('请填写完整信息')
    return
  }
  try {
    await shiftsAPI.create(newShift.value)
    ElMessage.success('换班申请已创建')
    createDialogVisible.value = false
    loadShifts()
  } catch (err) {
    ElMessage.error('创建失败')
  }
}

const approveShift = async (row) => {
  if (staffList.value.length === 0) {
    ElMessage.warning('请先添加员工')
    return
  }
  try {
    await shiftsAPI.approve(row.id, staffList.value[0].id)
    ElMessage.success('换班已批准')
    loadShifts()
  } catch (err) {
    ElMessage.error('操作失败')
  }
}

const rejectShift = async (row) => {
  if (staffList.value.length === 0) {
    ElMessage.warning('请先添加员工')
    return
  }
  try {
    await shiftsAPI.reject(row.id, staffList.value[0].id, '')
    ElMessage.success('换班已拒绝')
    loadShifts()
  } catch (err) {
    ElMessage.error('操作失败')
  }
}

const triggerCallback = async (row) => {
  try {
    await shiftsAPI.callback(row.id)
    ElMessage.success('回调成功')
    loadShifts()
  } catch (err) {
    ElMessage.error(err.response?.data?.error || '回调失败')
  }
}

onMounted(() => {
  loadShifts()
  loadStaff()
  loadCleanings()
})
</script>
