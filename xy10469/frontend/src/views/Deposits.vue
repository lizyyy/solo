<template>
  <div class="deposits-page">
    <el-card>
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center">
          <div style="display: flex; gap: 16px; align-items: center">
            <el-select v-model="filters.type" placeholder="交易类型" style="width: 140px" clearable @change="loadData">
              <el-option v-for="(item, key) in depositTypeMap" :key="key" :label="item.label" :value="key" />
            </el-select>
            <el-select v-model="filters.status" placeholder="状态" style="width: 120px" clearable @change="loadData">
              <el-option label="待确认" value="pending" />
              <el-option label="已确认" value="confirmed" />
              <el-option label="已退还" value="refunded" />
            </el-select>
            <el-button @click="loadData">
              <el-icon><Search /></el-icon>
              查询
            </el-button>
          </div>
        </div>
      </template>
      
      <el-row :gutter="20" style="margin-bottom: 20px">
        <el-col :span="6">
          <el-statistic title="累计押金缴纳">
            <template #default>
              <span style="color: #52c41a">{{ formatCurrency(summary.totalDeposits || 0) }}</span>
            </template>
          </el-statistic>
        </el-col>
        <el-col :span="6">
          <el-statistic title="累计押金退还">
            <template #default>
              <span style="color: #fa8c16">{{ formatCurrency(summary.totalRefunds || 0) }}</span>
            </template>
          </el-statistic>
        </el-col>
        <el-col :span="6">
          <el-statistic title="累计押金扣款">
            <template #default>
              <span style="color: #f5222d">{{ formatCurrency(summary.totalDeductions || 0) }}</span>
            </template>
          </el-statistic>
        </el-col>
        <el-col :span="6">
          <el-statistic title="待确认收款">
            <template #default>
              <span style="color: #1890ff">{{ formatCurrency(summary.pendingPayments || 0) }}</span>
            </template>
          </el-statistic>
        </el-col>
      </el-row>
      
      <el-table :data="transactions" v-loading="loading" stripe>
        <el-table-column prop="transactionNo" label="交易编号" width="180" />
        <el-table-column label="商户" width="150">
          <template #default="{ row }">{{ row.merchantId?.name }}</template>
        </el-table-column>
        <el-table-column label="申请编号" width="160">
          <template #default="{ row }">{{ row.applicationId?.applicationNo }}</template>
        </el-table-column>
        <el-table-column prop="type" label="类型" width="120">
          <template #default="{ row }">
            <el-tag :type="depositTypeMap[row.type]?.type">{{ depositTypeMap[row.type]?.label }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="amount" label="金额" width="120">
          <template #default="{ row }">
            <span :style="row.type === 'refund' ? 'color: #fa8c16' : 'color: #52c41a'">
              {{ row.type === 'refund' ? '-' : '+' }}{{ formatCurrency(row.amount) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="paymentMethod" label="支付方式" width="100">
          <template #default="{ row }">{{ paymentMethodMap[row.paymentMethod] || '-' }}</template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusTagType(row.status)">{{ getStatusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="operator" label="操作人" width="100" />
        <el-table-column prop="transactionDate" label="交易时间" width="170">
          <template #default="{ row }">{{ formatDateTime(row.transactionDate) }}</template>
        </el-table-column>
        <el-table-column prop="notes" label="备注" min-width="120" show-overflow-tooltip />
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button 
              v-if="row.status === 'pending'" 
              size="small" 
              type="primary" 
              @click="handleConfirm(row)"
            >确认收款</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="confirmVisible" title="确认收款" width="450px">
      <el-form :model="confirmForm" label-width="80px">
        <el-form-item label="交易编号">
          <el-tag>{{ currentTransaction?.transactionNo }}</el-tag>
        </el-form-item>
        <el-form-item label="交易类型">
          <el-tag :type="depositTypeMap[currentTransaction?.type]?.type">
            {{ depositTypeMap[currentTransaction?.type]?.label }}
          </el-tag>
        </el-form-item>
        <el-form-item label="金额">
          <span style="font-size: 18px; font-weight: 600; color: #52c41a">
            {{ formatCurrency(currentTransaction?.amount) }}
          </span>
        </el-form-item>
        <el-form-item label="支付方式" prop="paymentMethod">
          <el-select v-model="confirmForm.paymentMethod" style="width: 100%">
            <el-option v-for="(label, value) in paymentMethodMap" :key="value" :label="label" :value="value" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="confirmVisible = false">取消</el-button>
        <el-button type="primary" @click="submitConfirm">确认收款</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { depositApi } from '@/api';
import { formatCurrency, formatDateTime, depositTypeMap, paymentMethodMap } from '@/utils/format';

const loading = ref(false);
const transactions = ref([]);
const summary = ref({});
const confirmVisible = ref(false);
const currentTransaction = ref(null);

const filters = reactive({
  type: '',
  status: ''
});

const confirmForm = reactive({
  paymentMethod: 'bank_transfer'
});

const getStatusTagType = (status) => {
  const map = { pending: 'warning', confirmed: 'success', cancelled: 'info', refunded: 'success' };
  return map[status] || 'info';
};

const getStatusLabel = (status) => {
  const map = { pending: '待确认', confirmed: '已确认', cancelled: '已取消', refunded: '已退还' };
  return map[status] || status;
};

const loadData = async () => {
  loading.value = true;
  try {
    const [transRes, summaryRes] = await Promise.all([
      depositApi.getAll(filters),
      depositApi.getSummary()
    ]);
    transactions.value = transRes.data;
    summary.value = summaryRes.data;
  } catch (error) {
    console.error('加载数据失败:', error);
  } finally {
    loading.value = false;
  }
};

const handleConfirm = (row) => {
  currentTransaction.value = row;
  confirmForm.paymentMethod = 'bank_transfer';
  confirmVisible.value = true;
};

const submitConfirm = async () => {
  try {
    await depositApi.confirmPayment(currentTransaction.value._id, {
      paymentMethod: confirmForm.paymentMethod
    });
    ElMessage.success('收款确认成功');
    confirmVisible.value = false;
    loadData();
  } catch (error) {
    console.error('确认失败:', error);
  }
};

onMounted(() => {
  loadData();
});
</script>

<style scoped>
.deposits-page {
  height: 100%;
}
</style>