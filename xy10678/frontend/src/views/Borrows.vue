<template>
  <div>
    <h2 style="margin-bottom: 20px">借用记录管理</h2>
    <el-button type="primary" @click="openDialog">新增借用</el-button>
    <el-table :data="borrows" style="width: 100%; margin-top: 20px" border>
      <el-table-column prop="resident_name" label="居民姓名" />
      <el-table-column prop="medicine_name" label="药品名称" />
      <el-table-column prop="box_name" label="所属药箱" />
      <el-table-column prop="quantity" label="借用数量" />
      <el-table-column prop="borrow_reason" label="借用原因" />
      <el-table-column prop="borrow_date" label="借用日期" />
      <el-table-column prop="expected_return_date" label="预计归还" />
      <el-table-column prop="status" label="状态" width="120">
        <template #default="{ row }">
          <el-tag :type="getStatusType(row.status)">
            {{ getStatusText(row.status) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="200">
        <template #default="{ row }">
          <el-button v-if="row.status === 'pending_review'" size="small" type="warning" @click="reviewBorrow(row)">复核</el-button>
          <el-button v-if="row.status === 'borrowed'" size="small" type="success" @click="returnBorrow(row)">归还</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dialogVisible" title="新增借用" width="500px">
      <el-form :model="form" label-width="100px">
        <el-form-item label="居民">
          <el-select v-model="form.resident_id" style="width: 100%">
            <el-option v-for="r in residents" :key="r.id" :label="r.name" :value="r.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="药品批次">
          <el-select v-model="form.batch_id" style="width: 100%" @change="onBatchChange">
            <el-option v-for="b in batches" :key="b.id" :label="b.medicine_name + '(' + b.quantity + b.unit + ')'" :value="b.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="借用数量">
          <el-input-number v-model="form.quantity" :min="1" :max="maxQuantity" />
        </el-form-item>
        <el-form-item label="借用原因">
          <el-input v-model="form.borrow_reason" />
        </el-form-item>
        <el-form-item label="借用日期">
          <el-date-picker v-model="form.borrow_date" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
        </el-form-item>
        <el-form-item label="预计归还">
          <el-date-picker v-model="form.expected_return_date" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
        </el-form-item>
        <el-form-item label="操作人">
          <el-input v-model="form.operator" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveBorrow">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="reviewDialogVisible" title="复核借用" width="500px">
      <el-form :model="reviewForm" label-width="100px">
        <el-form-item label="复核人">
          <el-input v-model="reviewForm.reviewer" />
        </el-form-item>
        <el-form-item label="复核意见">
          <el-input type="textarea" v-model="reviewForm.review_comment" />
        </el-form-item>
        <el-form-item label="复核结果">
          <el-radio-group v-model="reviewForm.status">
            <el-radio label="borrowed">通过</el-radio>
            <el-radio label="rejected">拒绝</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="reviewDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveReview">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'
import { ElMessage } from 'element-plus'

const borrows = ref([])
const residents = ref([])
const batches = ref([])
const dialogVisible = ref(false)
const reviewDialogVisible = ref(false)
const form = ref({})
const reviewForm = ref({})
const maxQuantity = ref(1)
const reviewId = ref(null)

const getStatusType = (status) => {
  const map = { borrowed: 'success', pending_review: 'warning', returned: 'info', rejected: 'danger' }
  return map[status] || ''
}

const getStatusText = (status) => {
  const map = { borrowed: '借用中', pending_review: '待复核', returned: '已归还', rejected: '已拒绝' }
  return map[status] || status
}

const loadData = async () => {
  const [borrowsRes, residentsRes, batchesRes] = await Promise.all([
    axios.get('/api/borrows'),
    axios.get('/api/residents'),
    axios.get('/api/batches')
  ])
  borrows.value = borrowsRes.data
  residents.value = residentsRes.data
  batches.value = batchesRes.data
}

const openDialog = () => {
  form.value = { operator: '管理员' }
  dialogVisible.value = true
}

const onBatchChange = (id) => {
  const batch = batches.value.find(b => b.id === id)
  if (batch) {
    form.value.box_id = batch.box_id
    maxQuantity.value = batch.quantity
  }
}

const saveBorrow = async () => {
  try {
    await axios.post('/api/borrows', form.value)
    ElMessage.success('创建成功')
    dialogVisible.value = false
    loadData()
  } catch (err) {
    ElMessage.error(err.response?.data?.error || '操作失败')
  }
}

const reviewBorrow = (row) => {
  reviewId.value = row.id
  reviewForm.value = {}
  reviewDialogVisible.value = true
}

const saveReview = async () => {
  try {
    await axios.put(`/api/borrows/${reviewId.value}/review`, reviewForm.value)
    ElMessage.success('复核完成')
    reviewDialogVisible.value = false
    loadData()
  } catch (err) {
    ElMessage.error('操作失败')
  }
}

const returnBorrow = (row) => {
  ElMessage.info('请在归还验收页面处理归还')
}

onMounted(() => {
  loadData()
})
</script>
