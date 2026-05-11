<template>
  <div class="inspections-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <el-form :inline="true" :model="filterForm">
            <el-form-item label="状态">
              <el-select v-model="filterForm.status" placeholder="全部" clearable style="width: 140px" @change="loadData">
                <el-option label="待复核" value="pending" />
                <el-option label="已复核" value="reviewed" />
                <el-option label="正常" value="normal" />
              </el-select>
            </el-form-item>
          </el-form>
        </div>
      </template>
      <el-table :data="inspections" v-loading="loading">
        <el-table-column label="房号" width="150">
          <template #default="scope">
            {{ scope.row.building }}-{{ scope.row.unit }}-{{ scope.row.room_number }}
          </template>
        </el-table-column>
        <el-table-column prop="owner_name" label="业主" width="100" />
        <el-table-column prop="inspector" label="巡查人" width="100" />
        <el-table-column prop="inspection_date" label="巡查时间" width="180" />
        <el-table-column prop="violation_type" label="违规类型" width="120">
          <template #default="scope">
            <span v-if="scope.row.violation_type" style="color: #e6a23c">{{ scope.row.violation_type }}</span>
            <span v-else style="color: #67c23a">无违规</span>
          </template>
        </el-table-column>
        <el-table-column prop="description" label="违规描述" />
        <el-table-column prop="deduction_amount" label="扣款金额" width="100">
          <template #default="scope">
            <span v-if="scope.row.deduction_amount > 0" style="color: #e6a23c">-¥{{ scope.row.deduction_amount }}</span>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="scope">
            <el-tag :type="getStatusType(scope.row.status)">
              {{ getStatusText(scope.row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100">
          <template #default="scope">
            <el-button v-if="scope.row.status === 'pending'" type="primary" link @click="openReviewDialog(scope.row)">复核</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="reviewDialogVisible" title="整改复核" width="600px">
      <el-descriptions v-if="currentInspection" :column="1" border>
        <el-descriptions-item label="房号">
          {{ currentInspection.building }}-{{ currentInspection.unit }}-{{ currentInspection.room_number }}
        </el-descriptions-item>
        <el-descriptions-item label="业主">{{ currentInspection.owner_name }}</el-descriptions-item>
        <el-descriptions-item label="违规类型">{{ currentInspection.violation_type }}</el-descriptions-item>
        <el-descriptions-item label="违规描述">{{ currentInspection.description }}</el-descriptions-item>
        <el-descriptions-item label="整改要求">{{ currentInspection.rectification_requirement }}</el-descriptions-item>
        <el-descriptions-item label="扣款金额" style="color: #e6a23c">¥{{ currentInspection.deduction_amount }}</el-descriptions-item>
      </el-descriptions>
      <el-divider />
      <el-form :model="reviewForm" label-width="100px">
        <el-form-item label="整改结果">
          <el-input v-model="reviewForm.rectification_result" type="textarea" :rows="3" placeholder="请输入整改结果说明" />
        </el-form-item>
        <el-form-item label="复核人">
          <el-input v-model="reviewForm.reviewer" placeholder="复核人姓名" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="reviewDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitReview">确认复核</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import api from '@/utils/api'

const loading = ref(false)
const submitting = ref(false)
const inspections = ref([])
const reviewDialogVisible = ref(false)
const currentInspection = ref(null)

const filterForm = reactive({
  status: ''
})

const reviewForm = reactive({
  rectification_result: '',
  reviewer: ''
})

const statusMap = {
  pending: { text: '待复核', type: 'warning' },
  reviewed: { text: '已复核', type: 'success' },
  normal: { text: '正常', type: 'info' }
}

function getStatusText(status) {
  return statusMap[status]?.text || status
}

function getStatusType(status) {
  return statusMap[status]?.type || 'info'
}

async function loadData() {
  loading.value = true
  try {
    const params = {}
    if (filterForm.status) params.status = filterForm.status
    const response = await api.get('/inspections', { params })
    inspections.value = response.data
  } catch (err) {
    console.error(err)
  } finally {
    loading.value = false
  }
}

function openReviewDialog(row) {
  currentInspection.value = row
  reviewForm.rectification_result = ''
  reviewForm.reviewer = ''
  reviewDialogVisible.value = true
}

async function submitReview() {
  if (!reviewForm.reviewer) {
    ElMessage.warning('请输入复核人姓名')
    return
  }
  submitting.value = true
  try {
    await api.put(`/inspections/${currentInspection.value.id}`, reviewForm)
    ElMessage.success('复核完成')
    reviewDialogVisible.value = false
    loadData()
  } catch (err) {
    console.error(err)
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  loadData()
})
</script>

<style scoped>
.card-header {
  font-weight: 500;
  font-size: 16px;
}
</style>
