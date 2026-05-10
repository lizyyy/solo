<template>
  <div class="payments-page">
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
            <el-option label="已缴费" value="paid" />
            <el-option label="已退款" value="refunded" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadPayments">
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
        <el-table-column prop="payment_no" label="缴费单号" width="140" />
        <el-table-column prop="member_code" label="会员编号" width="100" />
        <el-table-column prop="company_name" label="企业名称" min-width="180" show-overflow-tooltip />
        <el-table-column prop="level_name" label="会员等级" width="100" />
        <el-table-column prop="fee_year" label="缴费年度" width="90" align="center" />
        <el-table-column prop="original_amount" label="应收金额" width="120" align="right">
          <template #default="{ row }">
            <span class="text-primary">¥{{ formatNumber(row.original_amount) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="reduction_amount" label="减免金额" width="120" align="right">
          <template #default="{ row }">
            <span class="text-warning">¥{{ formatNumber(row.reduction_amount) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="paid_amount" label="实收金额" width="120" align="right">
          <template #default="{ row }">
            <span class="text-success">¥{{ formatNumber(row.paid_amount) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="payment_method" label="缴费方式" width="100" />
        <el-table-column prop="payment_date" label="缴费日期" width="120" />
        <el-table-column prop="status" label="状态" width="90">
          <template #default="{ row }">
            <span v-if="row.status === 'paid'" class="badge-success">已缴费</span>
            <span v-else-if="row.status === 'refunded'" class="badge-warning">已退款</span>
            <span v-else class="badge-info">{{ row.status }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="creator_name" label="操作人" width="90" />
        <el-table-column prop="remark" label="备注" min-width="150" show-overflow-tooltip />
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button 
              v-if="row.status === 'paid'" 
              size="small" 
              type="warning" 
              link
              @click="handleRefund(row)"
            >
              退款
            </el-button>
            <el-button size="small" type="primary" link @click="viewDetail(row)">
              详情
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
    
    <el-dialog v-model="detailDialogVisible" title="缴费详情" width="600px">
      <el-descriptions :column="2" border v-if="currentPayment">
        <el-descriptions-item label="缴费单号">{{ currentPayment.payment_no }}</el-descriptions-item>
        <el-descriptions-item label="缴费年度">{{ currentPayment.fee_year }}</el-descriptions-item>
        <el-descriptions-item label="企业名称" :span="2">{{ currentPayment.company_name }}</el-descriptions-item>
        <el-descriptions-item label="会员等级">{{ currentPayment.level_name }}</el-descriptions-item>
        <el-descriptions-item label="缴费方式">{{ currentPayment.payment_method }}</el-descriptions-item>
        <el-descriptions-item label="应收金额">
          <span class="text-primary">¥{{ formatNumber(currentPayment.original_amount) }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="减免金额">
          <span class="text-warning">¥{{ formatNumber(currentPayment.reduction_amount) }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="实收金额">
          <span class="text-success">¥{{ formatNumber(currentPayment.paid_amount) }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="缴费日期">{{ currentPayment.payment_date }}</el-descriptions-item>
        <el-descriptions-item label="操作人">{{ currentPayment.creator_name }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <span v-if="currentPayment.status === 'paid'" class="badge-success">已缴费</span>
          <span v-else-if="currentPayment.status === 'refunded'" class="badge-warning">已退款</span>
          <span v-else class="badge-info">{{ currentPayment.status }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="创建时间">{{ currentPayment.created_at }}</el-descriptions-item>
        <el-descriptions-item label="备注" :span="2">{{ currentPayment.remark || '-' }}</el-descriptions-item>
      </el-descriptions>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import request from '@/utils/request';
import dayjs from 'dayjs';

const currentYear = ref(dayjs().year());
const loading = ref(false);
const tableData = ref([]);
const members = ref([]);

const filters = reactive({
  memberId: '',
  year: '',
  status: ''
});

const detailDialogVisible = ref(false);
const currentPayment = ref(null);

function formatNumber(num) {
  if (num == null) return '0.00';
  return parseFloat(num).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function loadMembers() {
  const result = await request.get('/members');
  members.value = result.data;
}

async function loadPayments() {
  loading.value = true;
  try {
    const params = {};
    if (filters.memberId) params.memberId = filters.memberId;
    if (filters.year) params.year = filters.year;
    if (filters.status) params.status = filters.status;
    
    const result = await request.get('/payments', { params });
    tableData.value = result.data;
  } finally {
    loading.value = false;
  }
}

function resetFilters() {
  filters.memberId = '';
  filters.year = '';
  filters.status = '';
  loadPayments();
}

function viewDetail(row) {
  currentPayment.value = row;
  detailDialogVisible.value = true;
}

function handleRefund(row) {
  ElMessageBox.confirm(`确定要对缴费单号 ${row.payment_no} 进行退款操作吗？`, '确认退款', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(async () => {
    await request.post(`/payments/${row.id}/refund`);
    ElMessage.success('退款成功');
    loadPayments();
  }).catch(() => {});
}

onMounted(() => {
  loadMembers();
  loadPayments();
});
</script>

<style scoped>
.payments-page {
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
</style>
