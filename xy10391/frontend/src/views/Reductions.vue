<template>
  <div class="reductions-page">
    <el-card class="filter-card" shadow="never">
      <el-form :inline="true" :model="filters" size="default">
        <el-form-item label="会员">
          <el-select 
            v-model="filters.memberId" 
            placeholder="全部会员" 
            filterable 
            clearable
            style="width: 250px;"
          >
            <el-option 
              v-for="member in members" 
              :key="member.id" 
              :label="member.member_code + ' - ' + member.company_name" 
              :value="member.id" 
            />
          </el-select>
        </el-form-item>
        <el-form-item label="年度">
          <el-select v-model="filters.year" placeholder="全部年度" clearable style="width: 120px;">
            <el-option :label="(currentYear - 1) + '年度'" :value="currentYear - 1" />
            <el-option :label="currentYear + '年度'" :value="currentYear" />
            <el-option :label="(currentYear + 1) + '年度'" :value="currentYear + 1" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="filters.status" placeholder="全部状态" clearable style="width: 120px;">
            <el-option label="待审批" value="pending" />
            <el-option label="已批准" value="approved" />
            <el-option label="已拒绝" value="rejected" />
            <el-option label="已取消" value="cancelled" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadRequests">
            <el-icon><Search /></el-icon> 查询
          </el-button>
          <el-button @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>
    
    <el-card class="table-card" shadow="never">
      <el-table 
        :data="tableData" 
        v-loading="loading" 
        stripe 
        border
        style="width: 100%"
      >
        <el-table-column prop="request_code" label="申请编号" width="120" />
        <el-table-column prop="member_code" label="会员编号" width="100" />
        <el-table-column prop="company_name" label="企业名称" min-width="180" show-overflow-tooltip />
        <el-table-column prop="level_name" label="会员等级" width="100" />
        <el-table-column prop="fee_year" label="年度" width="80" align="center" />
        <el-table-column prop="original_amount" label="应收金额" width="120" align="right">
          <template #default="{ row }">
            <span class="text-primary">¥{{ formatNumber(row.original_amount) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="申请减免" width="130" align="center">
          <template #default="{ row }">
            <span v-if="row.request_type === 'percentage'" class="text-warning">{{ row.request_value }}%</span>
            <span v-else class="text-warning">¥{{ formatNumber(row.request_value) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="applied_amount" label="减免金额" width="120" align="right">
          <template #default="{ row }">
            <span v-if="row.applied_amount > 0" class="text-success">¥{{ formatNumber(row.applied_amount) }}</span>
            <span v-else class="text-info">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <span :class="getStatusClass(row.status)">{{ getStatusText(row.status) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="creator_name" label="申请人" width="90" />
        <el-table-column prop="approver_name" label="审批人" width="90" />
        <el-table-column prop="created_at" label="申请时间" width="160" />
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-button size="small" type="primary" link @click="viewDetail(row)">
              详情
            </el-button>
            <el-button 
              v-if="row.status === 'pending' && canApprove" 
              size="small" 
              type="success" 
              link
              @click="handleApprove(row)"
            >
              批准
            </el-button>
            <el-button 
              v-if="row.status === 'pending' && canApprove" 
              size="small" 
              type="danger" 
              link
              @click="handleReject(row)"
            >
              拒绝
            </el-button>
            <el-button 
              v-if="row.status === 'pending'" 
              size="small" 
              type="warning" 
              link
              @click="handleCancel(row)"
            >
              取消
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
    
    <el-dialog v-model="detailDialogVisible" title="减免申请详情" width="600px">
      <el-descriptions :column="2" border v-if="currentRequest">
        <el-descriptions-item label="申请编号">{{ currentRequest.request_code }}</el-descriptions-item>
        <el-descriptions-item label="申请年度">{{ currentRequest.fee_year }}</el-descriptions-item>
        <el-descriptions-item label="企业名称" :span="2">{{ currentRequest.company_name }}</el-descriptions-item>
        <el-descriptions-item label="会员等级">{{ currentRequest.level_name }}</el-descriptions-item>
        <el-descriptions-item label="联系人">{{ currentRequest.contact_person }}</el-descriptions-item>
        <el-descriptions-item label="联系电话">{{ currentRequest.contact_phone }}</el-descriptions-item>
        <el-descriptions-item label="申请状态">
          <span :class="getStatusClass(currentRequest.status)">{{ getStatusText(currentRequest.status) }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="应收金额">
          <span class="text-primary">¥{{ formatNumber(currentRequest.original_amount) }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="申请类型">
          {{ currentRequest.request_type === 'percentage' ? '按比例减免' : '固定金额减免' }}
        </el-descriptions-item>
        <el-descriptions-item label="申请内容">
          <span v-if="currentRequest.request_type === 'percentage'" class="text-warning">
            {{ currentRequest.request_value }}%
          </span>
          <span v-else class="text-warning">
            ¥{{ formatNumber(currentRequest.request_value) }}
          </span>
        </el-descriptions-item>
        <el-descriptions-item label="减免金额" v-if="currentRequest.status === 'approved'">
          <span class="text-success">¥{{ formatNumber(currentRequest.applied_amount) }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="申请人">{{ currentRequest.creator_name }}</el-descriptions-item>
        <el-descriptions-item label="申请时间">{{ currentRequest.created_at }}</el-descriptions-item>
        <el-descriptions-item label="申请原因" :span="2">{{ currentRequest.reason }}</el-descriptions-item>
        <template v-if="currentRequest.approver_name">
          <el-descriptions-item label="审批人">{{ currentRequest.approver_name }}</el-descriptions-item>
          <el-descriptions-item label="审批时间">{{ currentRequest.approved_at }}</el-descriptions-item>
          <el-descriptions-item label="审批意见" :span="2">{{ currentRequest.approval_comment || '-' }}</el-descriptions-item>
        </template>
      </el-descriptions>
      
      <div v-if="currentRequest?.status === 'pending' && canApprove" class="action-bar">
        <el-button type="success" @click="handleApprove(currentRequest)">
          <el-icon><CircleCheck /></el-icon> 批准
        </el-button>
        <el-button type="danger" @click="handleReject(currentRequest)">
          <el-icon><CircleClose /></el-icon> 拒绝
        </el-button>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import request from '@/utils/request';
import dayjs from 'dayjs';
import { useUserStore } from '@/stores/user';

const userStore = useUserStore();

const currentYear = ref(dayjs().year());
const loading = ref(false);
const tableData = ref([]);
const members = ref([]);

const canApprove = computed(() => {
  return ['admin', 'manager'].includes(userStore.role);
});

const filters = reactive({
  memberId: '',
  year: '',
  status: ''
});

const detailDialogVisible = ref(false);
const currentRequest = ref(null);

function formatNumber(num) {
  if (num == null) return '0.00';
  return parseFloat(num).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getStatusText(status) {
  const map = {
    pending: '待审批',
    approved: '已批准',
    rejected: '已拒绝',
    cancelled: '已取消'
  };
  return map[status] || status;
}

function getStatusClass(status) {
  const map = {
    pending: 'badge-warning',
    approved: 'badge-success',
    rejected: 'badge-danger',
    cancelled: 'badge-info'
  };
  return map[status] || 'badge-info';
}

async function loadMembers() {
  const result = await request.get('/members');
  members.value = result.data;
}

async function loadRequests() {
  loading.value = true;
  try {
    const params = {};
    if (filters.memberId) params.memberId = filters.memberId;
    if (filters.year) params.year = filters.year;
    if (filters.status) params.status = filters.status;
    
    const result = await request.get('/reductions', { params });
    tableData.value = result.data;
  } finally {
    loading.value = false;
  }
}

function resetFilters() {
  filters.memberId = '';
  filters.year = '';
  filters.status = '';
  loadRequests();
}

function viewDetail(row) {
  currentRequest.value = row;
  detailDialogVisible.value = true;
}

function handleApprove(row) {
  ElMessageBox.prompt('请输入审批意见（可选）', '批准减免申请', {
    confirmButtonText: '确认批准',
    cancelButtonText: '取消',
    inputType: 'textarea',
    inputPlaceholder: '请输入审批意见...',
    inputValidator: () => true,
    type: 'success'
  }).then(async ({ value }) => {
    await request.post(`/reductions/${row.id}/approve`, {
      approvalComment: value
    });
    ElMessage.success('减免申请已批准');
    detailDialogVisible.value = false;
    loadRequests();
  }).catch(() => {});
}

function handleReject(row) {
  ElMessageBox.prompt('请输入拒绝原因', '拒绝减免申请', {
    confirmButtonText: '确认拒绝',
    cancelButtonText: '取消',
    inputType: 'textarea',
    inputPlaceholder: '请输入拒绝原因...',
    inputValidator: (value) => {
      if (!value) return '请输入拒绝原因';
      return true;
    },
    type: 'error'
  }).then(async ({ value }) => {
    await request.post(`/reductions/${row.id}/reject`, {
      approvalComment: value
    });
    ElMessage.success('减免申请已拒绝');
    detailDialogVisible.value = false;
    loadRequests();
  }).catch(() => {});
}

function handleCancel(row) {
  ElMessageBox.confirm('确定要取消该减免申请吗？', '确认取消', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(async () => {
    await request.post(`/reductions/${row.id}/cancel`);
    ElMessage.success('减免申请已取消');
    loadRequests();
  }).catch(() => {});
}

onMounted(() => {
  loadMembers();
  loadRequests();
});
</script>

<style scoped>
.reductions-page {
  padding: 0;
}

.filter-card {
  margin-bottom: 20px;
}

.table-card {
  padding: 0;
}

:deep(.el-table th) {
  background-color: #fafafa !important;
}

.action-bar {
  margin-top: 20px;
  text-align: center;
  display: flex;
  justify-content: center;
  gap: 20px;
}
</style>
