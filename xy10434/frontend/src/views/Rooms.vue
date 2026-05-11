<template>
  <div class="rooms-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>房号管理</span>
          <el-button type="primary" @click="openCreateDialog">
            <el-icon><Plus /></el-icon>新增房号
          </el-button>
        </div>
      </template>
      <el-table :data="rooms" v-loading="loading">
        <el-table-column prop="building" label="楼栋" width="100" />
        <el-table-column prop="unit" label="单元" width="100" />
        <el-table-column prop="room_number" label="房号" width="100" />
        <el-table-column prop="owner_name" label="业主" width="120">
          <template #default="scope">
            <span v-if="scope.row.owner_name">{{ scope.row.owner_name }}</span>
            <span v-else style="color: #999">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="owner_phone" label="联系电话" width="150">
          <template #default="scope">
            <span v-if="scope.row.owner_phone">{{ scope.row.owner_phone }}</span>
            <span v-else style="color: #999">-</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="scope">
            <el-tag :type="scope.row.status === 'occupied' ? 'success' : 'info'">
              {{ scope.row.status === 'occupied' ? '已入住' : '空置' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150">
          <template #default="scope">
            <el-button type="primary" link @click="openEditDialog(scope.row)">编辑</el-button>
            <el-button type="danger" link @click="handleDelete(scope.row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑房号' : '新增房号'" width="500px">
      <el-form :model="form" :rules="rules" ref="formRef" label-width="100px">
        <el-form-item label="楼栋" prop="building">
          <el-input v-model="form.building" placeholder="如：1栋、A栋" />
        </el-form-item>
        <el-form-item label="单元" prop="unit">
          <el-input v-model="form.unit" placeholder="如：1单元" />
        </el-form-item>
        <el-form-item label="房号" prop="room_number">
          <el-input v-model="form.room_number" placeholder="如：101" />
        </el-form-item>
        <el-form-item label="绑定业主">
          <el-select v-model="form.owner_id" placeholder="选择业主" style="width: 100%" filterable clearable>
            <el-option 
              v-for="owner in owners" 
              :key="owner.id" 
              :label="`${owner.name}${owner.phone ? ' (' + owner.phone + ')' : ''}`"
              :value="owner.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="房屋状态">
          <el-select v-model="form.status" style="width: 100%">
            <el-option label="空置" value="empty" />
            <el-option label="已入住" value="occupied" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitForm">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import api from '@/utils/api'

const loading = ref(false)
const submitting = ref(false)
const rooms = ref([])
const owners = ref([])
const dialogVisible = ref(false)
const isEdit = ref(false)
const formRef = ref(null)

const form = reactive({
  id: null,
  building: '',
  unit: '',
  room_number: '',
  owner_id: null,
  status: 'empty'
})

const rules = {
  building: [{ required: true, message: '请输入楼栋', trigger: 'blur' }],
  unit: [{ required: true, message: '请输入单元', trigger: 'blur' }],
  room_number: [{ required: true, message: '请输入房号', trigger: 'blur' }]
}

async function loadData() {
  loading.value = true
  try {
    const response = await api.get('/rooms')
    rooms.value = response.data
  } catch (err) {
    console.error(err)
  } finally {
    loading.value = false
  }
}

async function loadOwners() {
  try {
    const response = await api.get('/owners')
    owners.value = response.data
  } catch (err) {
    console.error(err)
  }
}

function openCreateDialog() {
  isEdit.value = false
  Object.assign(form, { id: null, building: '', unit: '', room_number: '', owner_id: null, status: 'empty' })
  dialogVisible.value = true
}

function openEditDialog(row) {
  isEdit.value = true
  Object.assign(form, row)
  dialogVisible.value = true
}

async function submitForm() {
  try {
    await formRef.value.validate()
    submitting.value = true
    
    if (isEdit.value) {
      await api.put(`/rooms/${form.id}`, form)
      ElMessage.success('更新成功')
    } else {
      await api.post('/rooms', form)
      ElMessage.success('新增成功')
    }
    
    dialogVisible.value = false
    loadData()
  } catch (err) {
    console.error(err)
  } finally {
    submitting.value = false
  }
}

async function handleDelete(row) {
  try {
    await ElMessageBox.confirm('确定要删除该房号吗？', '提示', {
      type: 'warning'
    })
    await api.delete(`/rooms/${row.id}`)
    ElMessage.success('删除成功')
    loadData()
  } catch (err) {
    if (err !== 'cancel') console.error(err)
  }
}

onMounted(() => {
  loadData()
  loadOwners()
})
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 500;
  font-size: 16px;
}
</style>
