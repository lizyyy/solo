<template>
  <div class="refunds-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>退押审核管理</span>
          <el-button type="primary" @click="exportRefunds">
            <el-icon><Download /></el-icon>导出退押清单
          </el-button>
        </div>
      </template>
      <el-table :data="refunds" v-loading="loading">
        <el-table-column prop="id" label="退押编号" width="120">
          <template #default="scope">TY{{ String(scope.row.id).padStart(6, '0') }}</template>
        </el-table-column>
        <el-table-column label="房号" width="150">
          <template #default="scope">
            {{ scope.row.building }}-{{ scope.row.unit }}-{{ scope.row.room_number }}
          </template>
        </el-table-column>
        <el-table-column prop="owner_name" label="业主" width="100" />
        <el-table-column prop="deposit_received" label="已收押金" width="100">
          <template #default="scope">¥{{ scope.row.deposit_received }}</template>
        </el-table-column>
        <el-table-column prop="total_deduction" label="扣款合计" width="100">
          <template #default="scope">
            <span v-if="scope.row.total_deduction > 0" style="color: #e6a23c">-¥{{ scope.row.total_deduction }}</span>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column prop="refund_amount" label="应退金额" width="120">
          <template #default="scope">
            <span style="color: #67c23a; font-weight: bold">¥{{ scope.row.refund_amount }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="applicant" label="申请人" width="100" />
        <el-table-column prop="applicant_date" label="申请时间" width="180" />
        <el-table-column label="状态" width="100">
          <template #default="scope">
            <el-tag :type="getStatusType(scope.row.status)">
              {{ getStatusText(scope.row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="180">
          <template #default="scope">
            <el-button v-if="scope.row.status === 'pending'" type="success" link @click="handleApprove(scope.row)">通过</el-button>
            <el-button v-if="scope.row.status === 'pending'" type="danger" link @click="handleReject(scope.row)">拒绝</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import api from '@/utils/api'

const loading = ref(false)
const refunds = ref([])

const statusMap = {
  pending: { text: '待审核', type: 'warning' },
  approved: { text: '已通过', type: 'success' },
  rejected: { text: '已拒绝', type: 'danger' }
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
    const response = await api.get('/refunds')
    refunds.value = response.data
  } catch (err) {
    console.error(err)
  } finally {
    loading.value = false
  }
}

async function handleApprove(row) {
  try {
    await ElMessageBox.confirm(`确认通过退押申请？\n应退金额：¥${row.refund_amount}`, '提示', {
      type: 'warning'
    })
    await api.put(`/refunds/${row.id}/approve`, { reviewer: '管理员' })
    ElMessage.success('退押审核通过')
    loadData()
  } catch (err) {
    if (err !== 'cancel') console.error(err)
  }
}

async function handleReject(row) {
  try {
    const { value: remark } = await ElMessageBox.prompt('请输入拒绝原因', '拒绝退押申请', {
      confirmButtonText: '确认',
      cancelButtonText: '取消',
      inputPattern: /.+/,
      inputErrorMessage: '请输入拒绝原因'
    })
    await api.put(`/refunds/${row.id}/reject`, { reviewer: '管理员', remark })
    ElMessage.success('已拒绝退押申请')
    loadData()
  } catch (err) {
    if (err !== 'cancel') console.error(err)
  }
}

function exportRefunds() {
  window.open('/api/refunds/export', '_blank')
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
