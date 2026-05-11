<template>
  <div class="electricity-risk-report">
    <el-card>
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center">
          <span>用电风险报表</span>
          <el-button @click="loadData">
            <el-icon><Refresh /></el-icon>
            刷新
          </el-button>
        </div>
      </template>

      <el-row :gutter="20" style="margin-bottom: 20px">
        <el-col :span="6">
          <el-statistic title="风险申请总数">
            <template #default>
              <span style="color: #722ed1">{{ summary.total || 0 }}</span>
            </template>
          </el-statistic>
        </el-col>
        <el-col :span="6">
          <el-statistic title="高风险">
            <template #default>
              <span style="color: #f5222d">{{ summary.highRisk || 0 }}</span>
            </template>
          </el-statistic>
        </el-col>
        <el-col :span="6">
          <el-statistic title="中风险">
            <template #default>
              <span style="color: #fa8c16">{{ summary.mediumRisk || 0 }}</span>
            </template>
          </el-statistic>
        </el-col>
        <el-col :span="6">
          <el-statistic title="待审批">
            <template #default>
              <span style="color: #1890ff">{{ summary.pendingApproval || 0 }}</span>
            </template>
          </el-statistic>
        </el-col>
      </el-row>

      <el-table :data="riskDetails" v-loading="loading" stripe>
        <el-table-column label="风险等级" width="100">
          <template #default="{ row }">
            <el-tag :type="getRiskTagType(row.riskLevel)">
              {{ getRiskLabel(row.riskLevel) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="applicationNo" label="申请编号" width="160" />
        <el-table-column label="商户" width="150">
          <template #default="{ row }">{{ row.merchantName }}</template>
        </el-table-column>
        <el-table-column label="摊位" width="120">
          <template #default="{ row }">{{ row.boothCode }} - {{ row.boothName }}</template>
        </el-table-column>
        <el-table-column label="标准用电(kW)" width="110" align="right">
          <template #default="{ row }">{{ row.standardElectricity || 0 }}</template>
        </el-table-column>
        <el-table-column label="申请用电(kW)" width="110" align="right">
          <template #default="{ row }">
            <span :style="row.requestedElectricity > row.standardElectricity ? 'color: #f5222d; font-weight: 600' : ''">
              {{ row.requestedElectricity || 0 }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="超额(kW)" width="100" align="right">
          <template #default="{ row }">
            <span :style="row.exceedAmount > 0 ? 'color: #f5222d' : ''">
              {{ row.exceedAmount > 0 ? '+' + row.exceedAmount : 0 }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="超额比例" width="100" align="right">
          <template #default="{ row }">
            <span :style="row.exceedPercent > 0 ? 'color: #f5222d' : ''">
              {{ row.exceedPercent > 0 ? '+' + row.exceedPercent + '%' : '0%' }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="审批状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusTagType(row.status)">
              {{ getStatusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="riskReason" label="风险说明" min-width="180" show-overflow-tooltip />
        <el-table-column label="申请日期" width="160">
          <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { reportApi } from '@/api';
import { formatDate } from '@/utils/format';

const loading = ref(false);
const summary = ref({});
const riskDetails = ref([]);

const getRiskTagType = (level) => {
  const map = { high: 'danger', medium: 'warning', low: 'info' };
  return map[level] || 'info';
};

const getRiskLabel = (level) => {
  const map = { high: '高风险', medium: '中风险', low: '低风险' };
  return map[level] || level;
};

const getStatusTagType = (status) => {
  const map = { pending: 'warning', approved: 'success', rejected: 'danger' };
  return map[status] || 'info';
};

const getStatusLabel = (status) => {
  const map = { pending: '待审批', approved: '已通过', rejected: '已拒绝' };
  return map[status] || status;
};

const loadData = async () => {
  loading.value = true;
  try {
    const res = await reportApi.getElectricityRisk();
    summary.value = res.data?.summary || {};
    
    const details = res.data?.details || [];
    riskDetails.value = details.map(item => ({
      ...item,
      merchantName: item.applicationId?.merchantId?.name || '-',
      boothCode: item.applicationId?.boothId?.code || '-',
      boothName: item.applicationId?.boothId?.name || '-',
      applicationNo: item.applicationId?.applicationNo || '-',
      exceedAmount: (item.requestedElectricity || 0) - (item.standardElectricity || 0),
      exceedPercent: item.standardElectricity > 0 
        ? Math.round(((item.requestedElectricity || 0) - item.standardElectricity) / item.standardElectricity * 100) 
        : 0
    }));
  } catch (error) {
    console.error('加载用电风险数据失败:', error);
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  loadData();
});
</script>

<style scoped>
.electricity-risk-report {
  height: 100%;
}
</style>
