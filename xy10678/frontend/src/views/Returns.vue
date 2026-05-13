<template>
  <div>
    <h2 style="margin-bottom: 20px">归还验收管理</h2>
    <el-button type="primary" @click="openDialog">新增验收</el-button>
    <el-table :data="returns" style="width: 100%; margin-top: 20px" border>
      <el-table-column prop="resident_name" label="居民姓名" />
      <el-table-column prop="medicine_name" label="药品名称" />
      <el-table-column prop="quantity_actual" label="归还数量" />
      <el-table-column prop="condition" label="完好情况" />
      <el-table-column prop="remarks" label="备注" />
      <el-table-column prop="inspection_date" label="验收日期" />
      <el-table-column prop="inspector" label="验收人" />
    </el-table>

    <el-dialog v-model="dialogVisible" title="归还验收" width="500px">
      <el-form :model="form" label-width="100px">
        <el-form-item label="借用记录">
          <el-select v-model="form.borrow_id" style="width: 100%" @change="onBorrowChange">
            <el-option v-for="b in borrowedList" :key="b.id" :label="b.resident_name + ' - ' + b.medicine_name" :value="b.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="归还数量">
          <el-input-number v-model="form.quantity_actual" :min="1" />
        </el-form-item>
        <el-form-item label="完好情况">
          <el-select v-model="form.condition" style="width: 100%">
            <el-option label="完好" value="完好" />
            <el-option label="包装破损" value="包装破损" />
            <el-option label="部分使用" value="部分使用" />
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input type="textarea" v-model="form.remarks" />
        </el-form-item>
        <el-form-item label="验收人">
          <el-input v-model="form.inspector" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveReturn">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'
import { ElMessage } from 'element-plus'

const returns = ref([])
const borrowedList = ref([])
const dialogVisible = ref(false)
const form = ref({})

const loadData = async () => {
  const [returnsRes, borrowsRes] = await Promise.all([
    axios.get('/api/returns'),
    axios.get('/api/borrows')
  ])
  returns.value = returnsRes.data
  borrowedList.value = borrowsRes.data.filter(b => b.status === 'borrowed')
}

const openDialog = () => {
  form.value = { inspector: '管理员' }
  dialogVisible.value = true
}

const onBorrowChange = (id) => {
  const borrow = borrowedList.value.find(b => b.id === id)
  if (borrow) {
    form.value.quantity_actual = borrow.quantity
  }
}

const saveReturn = async () => {
  try {
    await axios.post('/api/returns', form.value)
    ElMessage.success('验收完成')
    dialogVisible.value = false
    loadData()
  } catch (err) {
    ElMessage.error('操作失败')
  }
}

onMounted(() => {
  loadData()
})
</script>
