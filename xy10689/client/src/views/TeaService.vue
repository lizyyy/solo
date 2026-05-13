<template>
  <div>
    <h2 style="margin-bottom: 20px">茶水服务</h2>
    
    <el-card style="margin-bottom: 20px">
      <el-form :inline="true" :model="filters">
        <el-form-item label="状态">
          <el-select v-model="filters.status" placeholder="选择状态" clearable>
            <el-option label="待处理" value="pending" />
            <el-option label="准备中" value="preparing" />
            <el-option label="已完成" value="completed" />
            <el-option label="已取消" value="cancelled" />
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
      <el-table :data="teaServices" style="width: 100%">
        <el-table-column prop="booking_title" label="会议主题" />
        <el-table-column prop="room_name" label="会议室" />
        <el-table-column prop="type" label="服务类型" />
        <el-table-column prop="quantity" label="数量" />
        <el-table-column prop="status" label="状态">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)">
              {{ getStatusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="handler" label="处理人" />
        <el-table-column prop="handled_at" label="处理时间" />
        <el-table-column label="操作" width="200">
          <template #default="{ row }">
            <el-button size="small" @click="editService(row)">编辑</el-button>
            <el-button size="small" @click="viewHistory(row)">修改记录</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="showEditDialog" title="编辑茶水服务" width="500px">
      <el-form :model="serviceForm" label-width="80px">
        <el-form-item label="服务类型">
          <el-select v-model="serviceForm.type">
            <el-option label="绿茶" value="绿茶" />
            <el-option label="咖啡" value="咖啡" />
            <el-option label="矿泉水" value="矿泉水" />
            <el-option label="红茶" value="红茶" />
          </el-select>
        </el-form-item>
        <el-form-item label="数量">
          <el-input-number v-model="serviceForm.quantity" :min="1" />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="serviceForm.status">
            <el-option label="待处理" value="pending" />
            <el-option label="准备中" value="preparing" />
            <el-option label="已完成" value="completed" />
            <el-option label="已取消" value="cancelled" />
          </el-select>
        </el-form-item>
        <el-form-item label="处理人">
          <el-input v-model="serviceForm.handler" />
        </el-form-item>
        <el-form-item label="操作人">
          <el-input v-model="serviceForm.modifiedBy" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showEditDialog = false">取消</el-button>
        <el-button type="primary" @click="submitEdit">确认</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showHistoryDialog" title="修改历史" width="600px">
      <el-table :data="historyList" style="width: 100%">
        <el-table-column prop="field_name" label="修改字段" />
        <el-table-column prop="old_value" label="修改前" />
        <el-table-column prop="new_value" label="修改后" />
        <el-table-column prop="modified_by" label="操作人" />
        <el-table-column prop="modified_at" label="操作时间" />
      </el-table>
    </el-dialog>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { getTeaServices, updateTeaService, getModificationHistory } from '../api'

const filters = ref({ status: '', handler: '' })
const teaServices = ref([])
const showEditDialog = ref(false)
const showHistoryDialog = ref(false)
const historyList = ref([])
const currentService = ref(null)

const serviceForm = ref({
  type: '',
  quantity: 1,
  status: '',
  handler: '',
  modifiedBy: 'admin'
})

const getStatusType = (status) => {
  const map = { pending: 'warning', preparing: 'primary', completed: 'success', cancelled: 'danger' }
  return map[status] || 'info'
}

const getStatusText = (status) => {
  const map = { pending: '待处理', preparing: '准备中', completed: '已完成', cancelled: '已取消' }
  return map[status] || status
}

const loadData = async () => {
  try {
    const res = await getTeaServices(filters.value)
    teaServices.value = res.data
  } catch (e) {
    console.error(e)
  }
}

const editService = (row) => {
  currentService.value = row
  serviceForm.value = {
    type: row.type,
    quantity: row.quantity,
    status: row.status,
    handler: row.handler,
    modifiedBy: 'admin'
  }
  showEditDialog.value = true
}

const submitEdit = async () => {
  try {
    await updateTeaService(currentService.value.id, serviceForm.value)
    ElMessage.success('修改成功')
    showEditDialog.value = false
    loadData()
  } catch (e) {
    console.error(e)
  }
}

const viewHistory = async (row) => {
  try {
    const res = await getModificationHistory({ entity_type: 'tea_service', entity_id: row.id })
    historyList.value = res.data
    showHistoryDialog.value = true
  } catch (e) {
    console.error(e)
  }
}

onMounted(() => {
  loadData()
})
</script>
