<template>
  <div class="approvals">
    <el-card shadow="hover">
      <template #header>
        <span>审批列表</span>
      </template>
      <el-table :data="approvals" style="width: 100%">
        <el-table-column label="审批类型" width="120">
          <template #default="{ row }">
            <el-tag>{{ getTypeText(row.type) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="template_name" label="模板名称" width="200" />
        <el-table-column prop="batch_name" label="批次名称" width="200" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)">{{ getStatusText(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="requester" label="申请人" width="100" />
        <el-table-column prop="approver" label="审批人" width="100" />
        <el-table-column prop="request_comment" label="申请备注" />
        <el-table-column prop="approval_comment" label="审批备注" />
        <el-table-column prop="requested_at" label="申请时间" width="180">
          <template #default="{ row }">{{ formatDate(row.requested_at) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="180" v-if="false">
          <template #default="{ row }">
            <el-button 
              link 
              type="success" 
              size="small" 
              :disabled="row.status !== 'pending'"
              @click="approve(row)">
              通过
            </el-button>
            <el-button 
              link 
              type="danger" 
              size="small" 
              :disabled="row.status !== 'pending'"
              @click="reject(row)">
              拒绝
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="showActionDialog" :title="isApprove ? '通过审批' : '拒绝审批'" width="500px">
      <el-form label-width="100px">
        <el-form-item label="审批备注">
          <el-input v-model="approvalComment" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showActionDialog = false">取消</el-button>
        <el-button :type="isApprove ? 'primary' : 'danger'" @click="doApproval">确认</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { approvalApi } from '@/api'

const approvals = ref([])
const showActionDialog = ref(false)
const isApprove = ref(true)
const currentApproval = ref(null)
const approvalComment = ref('')

const loadApprovals = async () => {
  try {
    const res = await approvalApi.list()
    approvals.value = res.data
  } catch (error) {
    ElMessage.error('加载审批失败')
  }
}

const approve = (row) => {
  currentApproval.value = row
  isApprove.value = true
  approvalComment.value = ''
  showActionDialog.value = true
}

const reject = (row) => {
  currentApproval.value = row
  isApprove.value = false
  approvalComment.value = ''
  showActionDialog.value = true
}

const doApproval = async () => {
  try {
    await approvalApi.action(currentApproval.value.id, {
      status: isApprove.value ? 'approved' : 'rejected',
      approval_comment: approvalComment.value
    })
    ElMessage.success('审批成功')
    showActionDialog.value = false
    loadApprovals()
  } catch (error) {
    ElMessage.error('审批失败')
  }
}

const getTypeText = (type) => {
  const map = {
    template: '模板审批',
    batch: '批次审批',
    compensation: '补偿审批'
  }
  return map[type] || type
}

const getStatusType = (status) => {
  const map = {
    pending: 'warning',
    approved: 'success',
    rejected: 'danger'
  }
  return map[status] || 'info'
}

const getStatusText = (status) => {
  const map = {
    pending: '待审批',
    approved: '已通过',
    rejected: '已拒绝'
  }
  return map[status] || status
}

const formatDate = (date) => {
  return new Date(date).toLocaleString('zh-CN')
}

onMounted(() => {
  loadApprovals()
})
</script>
