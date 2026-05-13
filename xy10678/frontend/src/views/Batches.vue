<template>
  <div>
    <h2 style="margin-bottom: 20px">药品批次管理</h2>
    <el-button type="primary" @click="openDialog">新增批次</el-button>
    <el-table :data="batches" style="width: 100%; margin-top: 20px" border>
      <el-table-column prop="medicine_name" label="药品名称" />
      <el-table-column prop="batch_number" label="批次号" />
      <el-table-column prop="box_name" label="所属药箱" />
      <el-table-column prop="quantity" label="库存数量" />
      <el-table-column prop="unit" label="单位" width="80" />
      <el-table-column prop="expiry_date" label="有效期至" />
      <el-table-column prop="supplier" label="供应商" />
      <el-table-column label="操作" width="150">
        <template #default="{ row }">
          <el-button size="small" @click="editBatch(row)">编辑</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dialogVisible" title="药品批次" width="500px">
      <el-form :model="form" label-width="100px">
        <el-form-item label="所属药箱">
          <el-select v-model="form.box_id" style="width: 100%">
            <el-option v-for="box in boxes" :key="box.id" :label="box.location_name" :value="box.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="药品名称">
          <el-input v-model="form.medicine_name" />
        </el-form-item>
        <el-form-item label="批次号">
          <el-input v-model="form.batch_number" />
        </el-form-item>
        <el-form-item label="数量">
          <el-input-number v-model="form.quantity" :min="0" />
        </el-form-item>
        <el-form-item label="单位">
          <el-input v-model="form.unit" />
        </el-form-item>
        <el-form-item label="生产日期">
          <el-date-picker v-model="form.production_date" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
        </el-form-item>
        <el-form-item label="有效期至">
          <el-date-picker v-model="form.expiry_date" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
        </el-form-item>
        <el-form-item label="供应商">
          <el-input v-model="form.supplier" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveBatch">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'
import { ElMessage } from 'element-plus'

const batches = ref([])
const boxes = ref([])
const dialogVisible = ref(false)
const form = ref({})
const editId = ref(null)

const loadData = async () => {
  const [batchesRes, boxesRes] = await Promise.all([
    axios.get('/api/batches'),
    axios.get('/api/boxes')
  ])
  batches.value = batchesRes.data
  boxes.value = boxesRes.data
}

const openDialog = () => {
  editId.value = null
  form.value = { status: 'normal' }
  dialogVisible.value = true
}

const editBatch = (row) => {
  editId.value = row.id
  form.value = { ...row }
  dialogVisible.value = true
}

const saveBatch = async () => {
  try {
    if (editId.value) {
      await axios.put(`/api/batches/${editId.value}`, form.value)
      ElMessage.success('更新成功')
    } else {
      await axios.post('/api/batches', form.value)
      ElMessage.success('创建成功')
    }
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
