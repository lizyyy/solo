<template>
  <div>
    <h2 style="margin-bottom: 20px">补给计划管理</h2>
    <el-button type="primary" @click="openDialog">新增计划</el-button>
    <el-table :data="supplies" style="width: 100%; margin-top: 20px" border>
      <el-table-column prop="medicine_name" label="药品名称" />
      <el-table-column prop="box_name" label="所属药箱" />
      <el-table-column prop="planned_quantity" label="计划数量" />
      <el-table-column prop="unit" label="单位" width="80" />
      <el-table-column prop="planned_date" label="计划日期" />
      <el-table-column prop="actual_date" label="实际日期" />
      <el-table-column prop="supplier" label="供应商" />
      <el-table-column prop="responsible_person" label="负责人" />
      <el-table-column prop="status" label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="row.status === 'completed' ? 'success' : 'warning'">
            {{ row.status === 'completed' ? '已完成' : '待处理' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="150">
        <template #default="{ row }">
          <el-button v-if="row.status !== 'completed'" size="small" type="success" @click="completePlan(row)">完成</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dialogVisible" title="补给计划" width="500px">
      <el-form :model="form" label-width="100px">
        <el-form-item label="所属药箱">
          <el-select v-model="form.box_id" style="width: 100%">
            <el-option v-for="box in boxes" :key="box.id" :label="box.location_name" :value="box.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="药品名称">
          <el-input v-model="form.medicine_name" />
        </el-form-item>
        <el-form-item label="计划数量">
          <el-input-number v-model="form.planned_quantity" :min="1" />
        </el-form-item>
        <el-form-item label="单位">
          <el-input v-model="form.unit" />
        </el-form-item>
        <el-form-item label="计划日期">
          <el-date-picker v-model="form.planned_date" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
        </el-form-item>
        <el-form-item label="供应商">
          <el-input v-model="form.supplier" />
        </el-form-item>
        <el-form-item label="负责人">
          <el-input v-model="form.responsible_person" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input type="textarea" v-model="form.remarks" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="savePlan">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'
import { ElMessage } from 'element-plus'

const supplies = ref([])
const boxes = ref([])
const dialogVisible = ref(false)
const form = ref({})

const loadData = async () => {
  const [suppliesRes, boxesRes] = await Promise.all([
    axios.get('/api/supplies'),
    axios.get('/api/boxes')
  ])
  supplies.value = suppliesRes.data
  boxes.value = boxesRes.data
}

const openDialog = () => {
  form.value = { status: 'pending' }
  dialogVisible.value = true
}

const savePlan = async () => {
  try {
    await axios.post('/api/supplies', form.value)
    ElMessage.success('创建成功')
    dialogVisible.value = false
    loadData()
  } catch (err) {
    ElMessage.error('操作失败')
  }
}

const completePlan = async (row) => {
  try {
    await axios.put(`/api/supplies/${row.id}`, { status: 'completed' })
    ElMessage.success('已完成')
    loadData()
  } catch (err) {
    ElMessage.error('操作失败')
  }
}

onMounted(() => {
  loadData()
})
</script>
