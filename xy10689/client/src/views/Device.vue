<template>
  <div>
    <h2 style="margin-bottom: 20px">设备管理</h2>
    
    <el-card>
      <el-table :data="devices" style="width: 100%">
        <el-table-column prop="room_name" label="所属会议室" />
        <el-table-column prop="name" label="设备名称" />
        <el-table-column prop="type" label="设备类型" />
        <el-table-column prop="status" label="状态">
          <template #default="{ row }">
            <el-tag :type="row.status === 'normal' ? 'success' : 'danger'">
              {{ row.status === 'normal' ? '正常' : '故障' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150">
          <template #default="{ row }">
            <el-button size="small" @click="editDevice(row)">编辑</el-button>
            <el-button size="small" @click="viewHistory(row)">修改记录</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="showEditDialog" title="编辑设备" width="500px">
      <el-form :model="deviceForm" label-width="80px">
        <el-form-item label="设备名称">
          <el-input v-model="deviceForm.name" />
        </el-form-item>
        <el-form-item label="设备类型">
          <el-input v-model="deviceForm.type" />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="deviceForm.status">
            <el-option label="正常" value="normal" />
            <el-option label="故障" value="fault" />
          </el-select>
        </el-form-item>
        <el-form-item label="操作人">
          <el-input v-model="deviceForm.modifiedBy" />
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
import { getDevices, updateDevice, getModificationHistory } from '../api'

const devices = ref([])
const showEditDialog = ref(false)
const showHistoryDialog = ref(false)
const historyList = ref([])
const currentDevice = ref(null)

const deviceForm = ref({
  name: '',
  type: '',
  status: '',
  modifiedBy: 'admin'
})

const loadData = async () => {
  try {
    const res = await getDevices()
    devices.value = res.data
  } catch (e) {
    console.error(e)
  }
}

const editDevice = (row) => {
  currentDevice.value = row
  deviceForm.value = {
    name: row.name,
    type: row.type,
    status: row.status,
    modifiedBy: 'admin'
  }
  showEditDialog.value = true
}

const submitEdit = async () => {
  try {
    await updateDevice(currentDevice.value.id, deviceForm.value)
    ElMessage.success('修改成功')
    showEditDialog.value = false
    loadData()
  } catch (e) {
    console.error(e)
  }
}

const viewHistory = async (row) => {
  try {
    const res = await getModificationHistory({ entity_type: 'device', entity_id: row.id })
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
