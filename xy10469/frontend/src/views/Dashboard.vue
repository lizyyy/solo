<template>
  <div class="dashboard">
    <el-row :gutter="20">
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-icon" style="background: #e6f7ff">
            <el-icon :size="32" color="#1890ff"><Shop /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-value">{{ summary.booths?.total || 0 }}</div>
            <div class="stat-label">总摊位数</div>
          </div>
          <div class="stat-footer">
            <span style="color: #52c41a">可用 {{ summary.booths?.available || 0 }}</span>
          </div>
        </el-card>
      </el-col>
      
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-icon" style="background: #f6ffed">
            <el-icon :size="32" color="#52c41a"><User /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-value">{{ summary.merchants?.total || 0 }}</div>
            <div class="stat-label">活跃商户</div>
          </div>
          <div class="stat-footer">
            <span>进行中申请 {{ summary.applications?.active || 0 }}</span>
          </div>
        </el-card>
      </el-col>
      
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-icon" style="background: #fff7e6">
            <el-icon :size="32" color="#fa8c16"><Wallet /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-value">{{ formatCurrency(summary.finance?.netRevenue || 0) }}</div>
            <div class="stat-label">累计收入</div>
          </div>
          <div class="stat-footer">
            <span>待收款 {{ formatCurrency(summary.finance?.pendingPayments || 0) }}</span>
          </div>
        </el-card>
      </el-col>
      
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-icon" style="background: #fff1f0">
            <el-icon :size="32" color="#f5222d"><Warning /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-value">{{ summary.alerts?.electricityRisk || 0 }}</div>
            <div class="stat-label">用电风险</div>
          </div>
          <div class="stat-footer">
            <span style="color: #fa8c16">待审批 {{ summary.alerts?.pendingApprovals || 0 }}</span>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" style="margin-top: 20px">
      <el-col :span="12">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>待处理事项</span>
            </div>
          </template>
          <el-table :data="pendingItems" style="width: 100%" height="300">
            <el-table-column prop="type" label="类型" width="100">
              <template #default="{ row }">
                <el-tag :type="row.tagType">{{ row.typeLabel }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="title" label="事项" />
            <el-table-column prop="time" label="时间" width="180">
              <template #default="{ row }">
                {{ formatDate(row.time) }}
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
      
      <el-col :span="12">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>收入构成</span>
            </div>
          </template>
          <el-table :data="incomeBreakdown" style="width: 100%" height="300">
            <el-table-column prop="name" label="收入类型" />
            <el-table-column prop="amount" label="金额" width="150">
              <template #default="{ row }">
                {{ formatCurrency(row.amount) }}
              </template>
            </el-table-column>
            <el-table-column prop="percent" label="占比" width="100">
              <template #default="{ row }">
                <el-progress 
                  :percentage="row.percent" 
                  :color="row.color"
                  :stroke-width="12"
                />
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { dashboardApi } from '@/api';
import { formatCurrency, formatDate, depositTypeMap, applicationStatusMap } from '@/utils/format';

const summary = ref({});
const pendingItems = ref([]);

const incomeBreakdown = computed(() => {
  const finance = summary.value.finance || {};
  const total = (finance.totalRent || 0) + (finance.totalDeductions || 0) + (finance.totalElectricity || 0);
  
  const items = [
    { 
      name: '租金收入', 
      amount: finance.totalRent || 0, 
      color: '#1890ff',
      percent: total > 0 ? Math.round((finance.totalRent || 0) / total * 100) : 0
    },
    { 
      name: '押金扣款', 
      amount: finance.totalDeductions || 0, 
      color: '#f5222d',
      percent: total > 0 ? Math.round((finance.totalDeductions || 0) / total * 100) : 0
    },
    { 
      name: '用电费用', 
      amount: finance.totalElectricity || 0, 
      color: '#52c41a',
      percent: total > 0 ? Math.round((finance.totalElectricity || 0) / total * 100) : 0
    }
  ];
  
  return items;
});

const loadData = async () => {
  try {
    const res = await dashboardApi.getSummary();
    summary.value = res.data;
    pendingItems.value = [
      { type: 'application', typeLabel: '申请审核', tagType: 'warning', title: '匠心手作 申请待审核', time: new Date() },
      { type: 'admission', typeLabel: '入场确认', tagType: 'primary', title: '甜心奶茶屋 待入场确认', time: new Date() }
    ];
  } catch (error) {
    console.error('加载数据失败:', error);
  }
};

onMounted(() => {
  loadData();
});
</script>

<style scoped>
.stat-card {
  display: flex;
  flex-direction: column;
}

.stat-card .el-card__body {
  display: flex;
  flex-direction: column;
  flex: 1;
}

.stat-icon {
  width: 60px;
  height: 60px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12px;
}

.stat-info {
  flex: 1;
}

.stat-value {
  font-size: 28px;
  font-weight: 600;
  color: #262626;
}

.stat-label {
  font-size: 14px;
  color: #8c8c8c;
  margin-top: 4px;
}

.stat-footer {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #f0f0f0;
  font-size: 13px;
  color: #8c8c8c;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 500;
}
</style>