<template>
  <div class="income-report">
    <el-card>
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center">
          <span>收入报表</span>
          <div style="display: flex; gap: 12px">
            <el-date-picker
              v-model="dateRange"
              type="daterange"
              range-separator="至"
              start-placeholder="开始日期"
              end-placeholder="结束日期"
              value-format="YYYY-MM-DD"
              style="width: 320px"
            />
            <el-button type="primary" @click="loadData">
              <el-icon><Search /></el-icon>
              查询
            </el-button>
          </div>
        </div>
      </template>

      <el-row :gutter="20" style="margin-bottom: 20px">
        <el-col :span="6">
          <el-statistic title="租金收入">
            <template #default>
              <span style="color: #1890ff">{{ formatCurrency(summary.totalRent || 0) }}</span>
            </template>
          </el-statistic>
        </el-col>
        <el-col :span="6">
          <el-statistic title="押金扣款">
            <template #default>
              <span style="color: #f5222d">{{ formatCurrency(summary.totalDeductions || 0) }}</span>
            </template>
          </el-statistic>
        </el-col>
        <el-col :span="6">
          <el-statistic title="用电费用">
            <template #default>
              <span style="color: #52c41a">{{ formatCurrency(summary.totalElectricity || 0) }}</span>
            </template>
          </el-statistic>
        </el-col>
        <el-col :span="6">
          <el-statistic title="总收入">
            <template #default>
              <span style="color: #722ed1; font-weight: 700">{{ formatCurrency(summary.totalIncome || 0) }}</span>
            </template>
          </el-statistic>
        </el-col>
      </el-row>

      <el-tabs v-model="activeTab">
        <el-tab-pane label="收入明细" name="details">
          <el-table :data="incomeDetails" v-loading="loading" stripe>
            <el-table-column prop="transactionNo" label="交易编号" width="180" />
            <el-table-column prop="type" label="收入类型" width="120">
              <template #default="{ row }">
                <el-tag :type="getTypeTagType(row.type)">{{ getTypeLabel(row.type) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="商户" width="150">
              <template #default="{ row }">{{ row.merchantName }}</template>
            </el-table-column>
            <el-table-column label="申请编号" width="160">
              <template #default="{ row }">{{ row.applicationNo }}</template>
            </el-table-column>
            <el-table-column prop="amount" label="金额" width="120" align="right">
              <template #default="{ row }">
                <span :style="getAmountColor(row.type)">{{ formatCurrency(row.amount) }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="paymentMethod" label="支付方式" width="100">
              <template #default="{ row }">{{ getPaymentMethodLabel(row.paymentMethod) }}</template>
            </el-table-column>
            <el-table-column prop="transactionDate" label="交易时间" width="170">
              <template #default="{ row }">{{ formatDateTime(row.transactionDate) }}</template>
            </el-table-column>
            <el-table-column prop="notes" label="备注" min-width="150" show-overflow-tooltip />
          </el-table>
        </el-tab-pane>
        
        <el-tab-pane label="按类型统计" name="byType">
          <el-table :data="statsByType" v-loading="loading" stripe style="max-width: 600px">
            <el-table-column prop="type" label="收入类型" width="150">
              <template #default="{ row }">
                <el-tag :type="getTypeTagType(row.type)">{{ getTypeLabel(row.type) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="count" label="交易笔数" width="120" align="right" />
            <el-table-column prop="amount" label="金额" width="150" align="right">
              <template #default="{ row }">
                <span style="font-weight: 600">{{ formatCurrency(row.amount) }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="percent" label="占比" width="180">
              <template #default="{ row }">
                <el-progress 
                  :percentage="row.percent" 
                  :color="getProgressColor(row.type)"
                  :stroke-width="12"
                />
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
        
        <el-tab-pane label="按摊位类型统计" name="byBoothType">
          <el-table :data="statsByBoothType" v-loading="loading" stripe>
            <el-table-column prop="boothType" label="摊位类型" width="150">
              <template #default="{ row }">{{ getBoothTypeLabel(row.boothType) }}</template>
            </el-table-column>
            <el-table-column prop="rentCount" label="租金笔数" width="100" align="right" />
            <el-table-column prop="rentAmount" label="租金金额" width="120" align="right">
              <template #default="{ row }">{{ formatCurrency(row.rentAmount) }}</template>
            </el-table-column>
            <el-table-column prop="deductionCount" label="扣款笔数" width="100" align="right" />
            <el-table-column prop="deductionAmount" label="扣款金额" width="120" align="right">
              <template #default="{ row }">{{ formatCurrency(row.deductionAmount) }}</template>
            </el-table-column>
            <el-table-column prop="electricityCount" label="用电笔数" width="100" align="right" />
            <el-table-column prop="electricityAmount" label="用电金额" width="120" align="right">
              <template #default="{ row }">{{ formatCurrency(row.electricityAmount) }}</template>
            </el-table-column>
            <el-table-column prop="total" label="合计" width="130" align="right">
              <template #default="{ row }">
                <span style="font-weight: 600; color: #722ed1">{{ formatCurrency(row.total) }}</span>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { reportApi } from '@/api';
import { formatCurrency, formatDateTime, boothTypeMap, paymentMethodMap, depositTypeMap } from '@/utils/format';
import dayjs from 'dayjs';

const loading = ref(false);
const activeTab = ref('details');

const now = dayjs();
const dateRange = ref([
  now.subtract(30, 'day').format('YYYY-MM-DD'),
  now.format('YYYY-MM-DD')
]);

const incomeDetails = ref([]);
const summary = ref({});

const getTypeTagType = (type) => {
  const map = { rent: 'primary', deduction: 'danger', electricity: 'success' };
  return map[type] || 'info';
};

const getTypeLabel = (type) => {
  const map = { rent: '租金', deduction: '押金扣款', electricity: '用电费用' };
  return map[type] || type;
};

const getAmountColor = (type) => {
  const map = { rent: 'color: #1890ff', deduction: 'color: #f5222d', electricity: 'color: #52c41a' };
  return map[type] || '';
};

const getProgressColor = (type) => {
  const map = { rent: '#1890ff', deduction: '#f5222d', electricity: '#52c41a' };
  return map[type] || '#722ed1';
};

const getBoothTypeLabel = (type) => {
  return boothTypeMap[type] || type;
};

const getPaymentMethodLabel = (method) => {
  return paymentMethodMap[method] || method;
};

const statsByType = computed(() => {
  const details = incomeDetails.value;
  const typeMap = {};
  let totalAmount = 0;
  
  details.forEach(item => {
    if (!typeMap[item.type]) {
      typeMap[item.type] = { type: item.type, count: 0, amount: 0 };
    }
    typeMap[item.type].count++;
    typeMap[item.type].amount += item.amount;
    totalAmount += item.amount;
  });
  
  return Object.values(typeMap).map(item => ({
    ...item,
    percent: totalAmount > 0 ? Math.round(item.amount / totalAmount * 100) : 0
  }));
});

const statsByBoothType = computed(() => {
  const boothTypeMap2 = {};
  
  incomeDetails.value.forEach(item => {
    const boothType = item.boothType || 'other';
    if (!boothTypeMap2[boothType]) {
      boothTypeMap2[boothType] = {
        boothType,
        rentCount: 0,
        rentAmount: 0,
        deductionCount: 0,
        deductionAmount: 0,
        electricityCount: 0,
        electricityAmount: 0,
        total: 0
      };
    }
    
    if (item.type === 'rent') {
      boothTypeMap2[boothType].rentCount++;
      boothTypeMap2[boothType].rentAmount += item.amount;
    } else if (item.type === 'deduction') {
      boothTypeMap2[boothType].deductionCount++;
      boothTypeMap2[boothType].deductionAmount += item.amount;
    } else if (item.type === 'electricity') {
      boothTypeMap2[boothType].electricityCount++;
      boothTypeMap2[boothType].electricityAmount += item.amount;
    }
    boothTypeMap2[boothType].total += item.amount;
  });
  
  return Object.values(boothTypeMap2);
});

const loadData = async () => {
  if (!dateRange.value || dateRange.value.length < 2) {
    return;
  }
  
  loading.value = true;
  try {
    const res = await reportApi.getIncomeReport({
      startDate: dateRange.value[0],
      endDate: dateRange.value[1]
    });
    
    const transactions = res.data?.transactions || [];
    const depositSummary = res.data?.summary || {};
    
    const validTypes = ['rent', 'deduction', 'electricity'];
    incomeDetails.value = transactions
      .filter(t => validTypes.includes(t.type))
      .map(item => ({
        ...item,
        merchantName: item.merchantId?.name || '-',
        applicationNo: item.applicationId?.applicationNo || '-',
        boothType: item.applicationId?.boothId?.type || 'other'
      }));
    
    summary.value = {
      totalRent: depositSummary.totalRent || incomeDetails.value.filter(t => t.type === 'rent').reduce((sum, t) => sum + t.amount, 0),
      totalDeductions: depositSummary.totalDeductions || incomeDetails.value.filter(t => t.type === 'deduction').reduce((sum, t) => sum + t.amount, 0),
      totalElectricity: depositSummary.totalElectricity || incomeDetails.value.filter(t => t.type === 'electricity').reduce((sum, t) => sum + t.amount, 0)
    };
    summary.value.totalIncome = summary.value.totalRent + summary.value.totalDeductions + summary.value.totalElectricity;
  } catch (error) {
    console.error('加载收入报表失败:', error);
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  loadData();
});
</script>

<style scoped>
.income-report {
  height: 100%;
}
</style>
