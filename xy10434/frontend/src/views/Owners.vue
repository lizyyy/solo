<template>
  <div class="owners-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>业主管理</span>
          <el-button type="primary" @click="openCreateDialog">
            <el-icon><Plus /></el-icon>新增业主
          </el-button>
        </div>
      </template>
      <el-table :data="owners" v-loading="loading">
        <el-table-column prop="name" label="业主姓名" width="120" />
        <el-table-column prop="phone" label="联系电话" width="150" />
        <el-table-column prop="id_card" label="身份证号" width="200" />
        <el-table-column prop="created_at" label="登记时间" width="180" />
        <el-table-column label="操作" width="150">
          <template #default="scope">
            <el-button type="primary" link @click="openEditDialog(scope.row)">编辑</el-button>
            <el-button type="danger" link @click="handleDelete(scope.row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑业主' : '新增业主'" width="500px">
      <el-form :model="form" :rules="rules" ref="formRef" label-width="100px">
        <el-form-item label="业主姓名" prop="name">
          <el-input v-model="form.name" placeholder="请输入业主姓名" />
        </el-form-item>
        <el-form-item label="联系电话" prop="phone">
          <el-input v-model="form.phone" placeholder="请输入联系电话" />
        </el-form-item>
        <el-form-item label="身份证号">
          <el-input v-model="form.id_card" placeholder="请输入身份证号" />
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
const owners = ref([])
const dialogVisible = ref(false)
const isEdit = ref(false)
const formRef = ref(null)

const form = reactive({
  id: null,
  name: '',
  phone: '',
  id_card: ''
})

const rules = {
  name: [{ required: true, message: '请输入业主姓名', trigger: 'blur' }]
}

async function loadData() {
  loading.value = true
  try {
    const response = await api.get('/owners')
    owners.value = response.data
  } catch (err) {
    console.error(err)
  } finally {
    loading.value = false
  }
}

function openCreateDialog() {
  isEdit.value = false
  Object.assign(form, { id: null, name: '', phone: '', id_card: '' })
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
      await api.put(`/owners/${form.id}`, form)
      ElMessage.success('更新成功')
    } else {
      await api.post('/owners', form)
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
    await ElMessageBox.confirm('确定要删除该业主吗？', '提示', {
      type: 'warning'
    })
    await api.delete(`/owners/${row.id}`)
    ElMessage.success('删除成功')
    loadData()
  } catch (err) {
    if (err !== 'cancel') console.error(err)
  }
}

onMounted(() => {
  loadData()
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
