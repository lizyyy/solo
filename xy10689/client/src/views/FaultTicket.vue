<template>
  <div>
    <h2 style="margin-bottom: 20px">故障工单</h2>
    
    <el-card style="margin-bottom: 20px">
      <el-form :inline="true" :model="filters">
        <el-form-item label="状态">
          <el-select v-model="filters.status" placeholder="选择状态" clearable>
            <el-option label="待处理" value="open" />
            <el-option label="处理中" value="in_progress" />
            <el-option label="已解决" value="resolved" />
          </el-select>
        </el-form-item>
        <el-form-item label="处理人">
          <el-input v-model="filters.handler" placeholder="输入处理人" clearable />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadData">查询</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card>
      <el-table :data="tickets" style="width: 100%">
        <el-table-column prop="device_name" label="设备名称" />
        <el-table-column prop="room_name" label="所属会议室" />
        <el-table-column prop="reporter" label="报告人" />
        <el-table-column prop="description" label="问题描述" show-overflow-tooltip />
        <el-table-column prop="status" label="状态">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)">
              {{ getStatusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="handler" label="处理人" />
        <el-table-column prop="handled_at" label="处理时间" />
        <el-table-column prop="resolution" label="解决方案" show-overflow-tooltip />
        <el-table-column label="操作" width="100">
          <template #default="{ row }">
            <el-button size="small" @click="editTicket(row)">处理</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="showEditDialog" title="处理工单" width="500px">
      <el-form :model="ticketForm" label-width="80px">
        <el-form-item label="状态">
          <el-select v-model="ticketForm.status">
            <el-option label="处理中" value="in_progress" />
            <el-option label="已解决" value="resolved" />
          </el-select>
        </el-form-item>
        <el-form-item label="处理人">
          <el-input v-model="ticketForm.handler" />
        </el-form-item>
        <el-form-item label="解决方案">
          <el-input v-model="ticketForm.resolution" type="textarea" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showEditDialog = false">取消</el-button>
        <el-button type="primary" @click="submitEdit">确认</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { getFaultTickets, updateFaultTicket } from '../api'

const filters = ref({ status: '', handler: '' })
const tickets = ref([])
const showEditDialog = ref(false)
const currentTicket = ref(null)

const ticketForm = ref({
  status: '',
  handler: '',
  resolution: ''
})

const getStatusType = (status) => {
  const map = { open: 'danger', in_progress: 'warning', resolved: 'success' }
  return map[status] || 'info'
}

const getStatusText = (status) => {
  const map = { open: '待处理', in_progress: '处理中', resolved: '已解决' }
  return map[status] || status
}

const loadData = async () => {
  try {
    const res = await getFaultTickets(filters.value)
    tickets.value = res.data
  } catch (e) {
    console.error(e)
  }
}

const editTicket = (row) => {
  currentTicket.value = row
  ticketForm.value = {
    status: row.status,
    handler: row.handler || '',
    resolution: row.resolution || ''
  }
  showEditDialog.value = true
}

const submitEdit = async () => {
  try {
    await updateFaultTicket(currentTicket.value.id, ticketForm.value)
    ElMessage.success('处理成功')
    showEditDialog.value = false
    loadData()
  } catch (e) {
    console.error(e)
  }
}

onMounted(() => {
  loadData()
})
</script>
