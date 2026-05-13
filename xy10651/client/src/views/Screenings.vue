<template>
  <div>
    <h2 style="margin-bottom: 20px">影厅排片管理</h2>
    
    <el-button type="primary" @click="showCreateDialog" style="margin-bottom: 20px">
      新增排片
    </el-button>

    <el-table :data="screenings" border>
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column prop="hall_name" label="影厅" width="120" />
      <el-table-column prop="movie_name" label="影片" width="200" />
      <el-table-column prop="start_time" label="开始时间" width="180">
        <template #default="{ row }">{{ formatTime(row.start_time) }}</template>
      </el-table-column>
      <el-table-column prop="end_time" label="结束时间" width="180">
        <template #default="{ row }">{{ formatTime(row.end_time) }}</template>
      </el-table-column>
      <el-table-column prop="status" label="状态" width="120">
        <template #default="{ row }">
          <el-tag :type="getStatusType(row.status)">{{ getStatusText(row.status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="300">
        <template #default="{ row }">
          <el-button size="small" @click="viewDetail(row)" type="primary">详情</el-button>
          <el-button v-if="row.status === 'scheduled'" size="small" @click="startScreening(row)" type="success">开始放映</el-button>
          <el-button v-if="row.status === 'playing'" size="small" @click="endScreening(row)" type="warning">结束放映</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="detailDialogVisible" title="排片详情" width="700px">
      <el-timeline v-if="currentScreening">
        <el-timeline-item timestamp="创建排片" placement="top">
          <el-card>
            <h4>排片计划创建</h4>
            <p>影厅: {{ currentScreening.hall_name }}</p>
            <p>影片: {{ currentScreening.movie_name }}</p>
            <p>时间: {{ formatTime(currentScreening.start_time) }} - {{ formatTime(currentScreening.end_time) }}</p>
          </el-card>
        </el-timeline-item>
        <el-timeline-item v-if="currentScreening.status !== 'scheduled'" timestamp="开始放映" placement="top" type="primary">
          <el-card>
            <h4>放映已开始</h4>
          </el-card>
        </el-timeline-item>
        <el-timeline-item v-if="currentScreening.status === 'ended'" timestamp="结束放映" placement="top" type="success">
          <el-card>
            <h4>放映已结束</h4>
            <p>清洁任务已自动创建</p>
          </el-card>
        </el-timeline-item>
      </el-timeline>
    </el-dialog>

    <el-dialog v-model="createDialogVisible" title="新增排片" width="500px">
      <el-form :model="newScreening" label-width="100px">
        <el-form-item label="影厅">
          <el-select v-model="newScreening.hall_id" placeholder="请选择影厅">
            <el-option v-for="hall in halls" :key="hall.id" :label="hall.name" :value="hall.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="影片">
          <el-input v-model="newScreening.movie_name" placeholder="请输入影片名称" />
        </el-form-item>
        <el-form-item label="开始时间">
          <el-date-picker v-model="newScreening.start_time" type="datetime" placeholder="选择开始时间" />
        </el-form-item>
        <el-form-item label="结束时间">
          <el-date-picker v-model="newScreening.end_time" type="datetime" placeholder="选择结束时间" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="createScreening">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { screeningsAPI } from '../api'

const screenings = ref([])
const halls = ref([
  { id: 1, name: '1号厅' },
  { id: 2, name: '2号厅' },
  { id: 3, name: '3号厅' }
])
const detailDialogVisible = ref(false)
const createDialogVisible = ref(false)
const currentScreening = ref(null)
const newScreening = ref({
  hall_id: null,
  movie_name: '',
  start_time: null,
  end_time: null
})

const loadScreenings = async () => {
  try {
    const res = await screeningsAPI.list()
    screenings.value = res.data
  } catch (err) {
    ElMessage.error('加载排片失败')
  }
}

const formatTime = (time) => {
  if (!time) return '-'
  return new Date(time).toLocaleString('zh-CN')
}

const getStatusType = (status) => {
  const map = { scheduled: 'info', playing: 'primary', ended: 'success' }
  return map[status] || 'info'
}

const getStatusText = (status) => {
  const map = { scheduled: '待放映', playing: '放映中', ended: '已结束' }
  return map[status] || status
}

const viewDetail = (row) => {
  currentScreening.value = row
  detailDialogVisible.value = true
}

const showCreateDialog = () => {
  createDialogVisible.value = true
}

const createScreening = async () => {
  try {
    await screeningsAPI.create(newScreening.value)
    ElMessage.success('排片创建成功')
    createDialogVisible.value = false
    loadScreenings()
  } catch (err) {
    ElMessage.error('创建失败')
  }
}

const startScreening = async (row) => {
  try {
    await screeningsAPI.start(row.id)
    ElMessage.success('放映已开始')
    loadScreenings()
  } catch (err) {
    ElMessage.error('操作失败')
  }
}

const endScreening = async (row) => {
  try {
    await screeningsAPI.end(row.id)
    ElMessage.success('放映已结束，清洁任务已创建')
    loadScreenings()
  } catch (err) {
    ElMessage.error('操作失败')
  }
}

onMounted(() => {
  loadScreenings()
})
</script>
