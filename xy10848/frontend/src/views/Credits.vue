<template>
  <div>
    <h2 style="margin-bottom: 20px">退费审核</h2>

    <el-card style="margin-bottom: 20px">
      <el-form :inline="true" :model="filters" size="small">
        <el-form-item label="状态">
          <el-select v-model="filters.status" placeholder="全部" clearable @change="fetchData">
            <el-option label="待审核" value="pending" />
            <el-option label="已通过" value="approved" />
            <el-option label="已拒绝" value="rejected" />
          </el-select>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card>
      <el-table :data="credits" style="width: 100%">
        <el-table-column prop="id" label="退费ID" width="100" show-overflow-tooltip />
        <el-table-column prop="request_id" label="关联请求" width="120" show-overflow-tooltip />
        <el-table-column prop="member_id" label="成员ID" width="120" show-overflow-tooltip />
        <el-table-column prop="quota_returned" label="返还额度" width="120" />
        <el-table-column prop="reason" label="原因" show-overflow-tooltip />
        <el-table-column label="状态" width="120">
          <template #default="{ row }">
            <el-tag :type="row.status === 'approved' ? 'success' : row.status === 'rejected' ? 'danger' : 'warning'">
              {{ row.status === 'approved' ? '已通过' : row.status === 'rejected' ? '已拒绝' : '待审核' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="250" fixed="right">
          <template #default="{ row }">
            <el-button v-if="row.status === 'pending'" type="success" size="small" link @click="handleApprove(row.id)">通过</el-button>
            <el-button v-if="row.status === 'pending'" type="danger" size="small" link @click="handleReject(row.id)">拒绝</el-button>
            <el-button v-if="row.reviewed_by" size="small" link disabled>审核人: {{ row.reviewed_by }}</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="showReviewDialog" title="审核退费" width="400px">
      <el-form :model="reviewForm" label-width="80px">
        <el-form-item label="审核备注">
          <el-input v-model="reviewForm.note" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showReviewDialog = false">取消</el-button>
        <el-button type="primary" @click="submitReview">确认</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useQuotaStore } from '../stores/quota'
import { ElMessage } from 'element-plus'

const store = useQuotaStore()
const showReviewDialog = ref(false)
const currentReviewId = ref('')
const currentAction = ref('')
const filters = ref({ status: '' })
const reviewForm = ref({ note: '' })

const credits = computed(() => store.credits)

const fetchData = async () => {
  await store.fetchCredits(filters.value)
}

const handleApprove = (id) => {
  currentReviewId.value = id
  currentAction.value = 'approved'
  showReviewDialog.value = true
}

const handleReject = (id) => {
  currentReviewId.value = id
  currentAction.value = 'rejected'
  showReviewDialog.value = true
}

const submitReview = async () => {
  await store.reviewCredit(currentReviewId.value, currentAction.value, '管理员', reviewForm.value.note)
  ElMessage.success('审核完成')
  showReviewDialog.value = false
  reviewForm.value.note = ''
  fetchData()
  store.fetchStats()
}

onMounted(fetchData)
</script>
