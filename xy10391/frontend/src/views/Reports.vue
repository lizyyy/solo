<template>
  <div class="reports-page">
    <el-card class="header-card" shadow="never">
      <div class="report-header">
        <div class="header-left">
          <h2><el-icon><DataLine /></el-icon> 年度会费报表</h2>
          <el-select v-model="selectedYear" @change="loadReport" style="width: 150px;">
            <el-option :label="(currentYear - 1) + '年度'" :value="currentYear - 1" />
            <el-option :label="currentYear + '年度'" :value="currentYear" />
            <el-option :label="(currentYear + 1) + '年度'" :value="currentYear + 1" />
          </el-select>
        </div>
        <div class="header-right">
          <el-button type="success" @click="exportReport">
            <el-icon><Download /></el-icon> 导出CSV
          </el-button>
        </div>
      </div>
    </el-card>
    
    <div v-loading="loading">
      <el-row :gutter="20" class="stats-row">
        <el-col :span="6">
          <el-card class="stat-card" shadow="never">
            <div class="stat-content">
              <div class="stat-icon blue">
                <el-icon size="24"><User /></el-icon>
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ report?.summary?.totalMembers || 0 }}</div>
                <div class="stat-label">会员总数</div>
              </div>
            </div>
          </el-card>
        </el-col>
        <el-col :span="6">
          <el-card class="stat-card" shadow="never">
            <div class="stat-content">
              <div class="stat-icon green">
                <el-icon size="24"><CircleCheck /></el-icon>
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ report?.summary?.paidMembers || 0 }}</div>
                <div class="stat-label">已结清</div>
              </div>
            </div>
          </el-card>
        </el-col>
        <el-col :span="6">
          <el-card class="stat-card" shadow="never">
            <div class="stat-content">
              <div class="stat-icon orange">
                <el-icon size="24"><Clock /></el-icon>
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ report?.summary?.overdueMembers || 0 }}</div>
                <div class="stat-label">逾期会员</div>
              </div>
            </div>
          </el-card>
        </el-col>
        <el-col :span="6">
          <el-card class="stat-card" shadow="never">
            <div class="stat-content">
              <div class="stat-icon purple">
                <el-icon size="24"><PieChart /></el-icon>
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ report?.summary?.paymentRate || 0 }}%</div>
                <div class="stat-label">缴费率</div>
              </div>
            </div>
          </el-card>
        </el-col>
      </el-row>
      
      <el-row :gutter="20" class="mt-20">
        <el-col :span="12">
          <el-card class="section-card" shadow="never">
            <template #header>
              <span><el-icon><Money /></el-icon> 金额汇总</span>
            </template>
            
            <div class="amount-summary">
              <div class="amount-item">
                <span class="amount-label">应收总额</span>
                <span class="amount-value primary">¥{{ formatNumber(report?.summary?.totalOriginal) }}</span>
              </div>
              <div class="amount-item">
                <span class="amount-label">减免总额</span>
                <span class="amount-value warning">¥{{ formatNumber(report?.summary?.totalReduction) }}</span>
              </div>
              <div class="amount-item">
                <span class="amount-label">已收总额</span>
                <span class="amount-value success">¥{{ formatNumber(report?.summary?.totalPaid) }}</span>
              </div>
              <div class="amount-item">
                <span class="amount-label">欠费总额</span>
                <span class="amount-value danger">¥{{ formatNumber(report?.summary?.totalDue) }}</span>
              </div>
            </div>
          </el-card>
        </el-col>
        
        <el-col :span="12">
          <el-card class="section-card" shadow="never">
            <template #header>
              <span><el-icon><InfoFilled /></el-icon> 其他统计</span>
            </template>
            
            <el-row :gutter="20">
              <el-col :span="8">
                <div class="info-item">
                  <div class="info-value warning">{{ report?.summary?.pendingReduction || 0 }}</div>
                  <div class="info-label">待审批减免</div>
                </div>
              </el-col>
              <el-col :span="8">
                <div class="info-item">
                  <div class="info-value">{{ report?.summary?.inactiveMembers || 0 }}</div>
                  <div class="info-label">暂停会员</div>
                </div>
              </el-col>
              <el-col :span="8">
                <div class="info-item">
                  <div class="info-value">{{ report?.summary?.resignedMembers || 0 }}</div>
                  <div class="info-label">已退会</div>
                </div>
              </el-col>
            </el-row>
          </el-card>
        </el-col>
      </el-row>
      
      <el-card class="section-card mt-20" shadow="never">
        <template #header>
          <span><el-icon><Menu /></el-icon> 按等级统计</span>
        </template>
        
        <el-table :data="byLevelData" size="small" stripe border>
          <el-table-column prop="levelName" label="会员等级" />
          <el-table-column prop="totalMembers" label="会员数" align="center" width="100" />
          <el-table-column prop="paidMembers" label="已结清" align="center" width="100">
            <template #default="{ row }">
              <span class="text-success">{{ row.paidMembers }}</span>
            </template>
          </el-table-column>
          <el-table-column label="缴费率" width="100" align="center">
            <template #default="{ row }">
              {{ row.totalMembers > 0 ? ((row.paidMembers / row.totalMembers) * 100).toFixed(1) : '0' }}%
            </template>
          </el-table-column>
          <el-table-column prop="overdueMembers" label="逾期" align="center" width="80">
            <template #default="{ row }">
              <span v-if="row.overdueMembers > 0" class="text-danger">{{ row.overdueMembers }}</span>
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column prop="originalAmount" label="应收金额" align="right" width="120">
            <template #default="{ row }">¥{{ formatNumber(row.originalAmount) }}</template>
          </el-table-column>
          <el-table-column prop="reductionAmount" label="减免金额" align="right" width="120">
            <template #default="{ row }">¥{{ formatNumber(row.reductionAmount) }}</template>
          </el-table-column>
          <el-table-column prop="paidAmount" label="已收金额" align="right" width="120">
            <template #default="{ row }">¥{{ formatNumber(row.paidAmount) }}</template>
          </el-table-column>
          <el-table-column prop="dueAmount" label="欠费金额" align="right" width="120">
            <template #default="{ row }">
              <span :class="row.dueAmount > 0 ? 'text-danger' : 'text-success'">
                ¥{{ formatNumber(row.dueAmount) }}
              </span>
            </template>
          </el-table-column>
        </el-table>
      </el-card>
      
      <el-card class="section-card mt-20" shadow="never">
        <template #header>
          <span><el-icon><List /></el-icon> 明细清单</span>
        </template>
        
        <el-table :data="report?.details || []" size="small" stripe border max-height="600">
          <el-table-column prop="memberCode" label="会员编号" width="90" fixed="left" />
          <el-table-column prop="companyName" label="企业名称" min-width="180" fixed="left" show-overflow-tooltip />
          <el-table-column prop="memberLevel" label="等级" width="100" />
          <el-table-column label="小微企业" width="80" align="center">
            <template #default="{ row }">
              <el-tag v-if="row.isSmallEnterprise" type="success" size="small">是</el-tag>
              <span v-else class="text-info">-</span>
            </template>
          </el-table-column>
          <el-table-column prop="status" label="会员状态" width="90">
            <template #default="{ row }">
              <span :class="getStatusClass(row.status)">{{ getStatusText(row.status) }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="originalAmount" label="应收" width="100" align="right">
            <template #default="{ row }">
              <span class="text-primary">¥{{ formatNumber(row.originalAmount) }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="reductionAmount" label="减免" width="100" align="right">
            <template #default="{ row }">
              <span class="text-warning">¥{{ formatNumber(row.reductionAmount) }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="paidAmount" label="已收" width="100" align="right">
            <template #default="{ row }">
              <span class="text-success">¥{{ formatNumber(row.paidAmount) }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="dueAmount" label="欠费" width="100" align="right">
            <template #default="{ row }">
              <span v-if="row.dueAmount > 0.01" class="text-danger">¥{{ formatNumber(row.dueAmount) }}</span>
              <span v-else class="text-success">-</span>
            </template>
          </el-table-column>
          <el-table-column label="结清" width="70" align="center">
            <template #default="{ row }">
              <el-icon v-if="row.isFullyPaid" class="text-success"><CircleCheck /></el-icon>
              <el-icon v-else class="text-danger"><CircleClose /></el-icon>
            </template>
          </el-table-column>
          <el-table-column prop="reminderDescription" label="催缴状态" width="150" show-overflow-tooltip>
            <template #default="{ row }">
              <span :class="getReminderClass(row.reminderStatus)">{{ row.reminderDescription }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="unpaidReason" label="欠费原因" width="150" show-overflow-tooltip>
            <template #default="{ row }">
              {{ row.unpaidReason || '-' }}
            </template>
          </el-table-column>
          <el-table-column prop="contactPerson" label="联系人" width="90" />
          <el-table-column prop="contactPhone" label="电话" width="120" />
        </el-table>
      </el-card>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import request from '@/utils/request';
import dayjs from 'dayjs';

const currentYear = ref(dayjs().year());
const selectedYear = ref(currentYear.value);
const loading = ref(false);
const report = ref(null);

const byLevelData = computed(() => {
  if (!report.value?.byLevel) return [];
  return Object.values(report.value.byLevel);
});

function formatNumber(num) {
  if (num == null) return '0.00';
  return parseFloat(num).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getStatusText(status) {
  const map = {
    active: '正常',
    inactive: '暂停',
    resigned: '已退会'
  };
  return map[status] || status;
}

function getStatusClass(status) {
  const map = {
    active: 'badge-success',
    inactive: 'badge-warning',
    resigned: 'badge-info'
  };
  return map[status] || 'badge-info';
}

function getReminderClass(status) {
  const map = {
    paid: 'badge-success',
    normal: 'badge-info',
    pending: 'badge-warning',
    overdue: 'badge-danger',
    inactive: 'badge-warning',
    resigned: 'badge-info'
  };
  return map[status] || 'badge-info';
}

async function loadReport() {
  loading.value = true;
  try {
    report.value = await request.get(`/reports/annual/${selectedYear.value}`);
  } finally {
    loading.value = false;
  }
}

function exportReport() {
  const token = localStorage.getItem('token');
  const url = `/api/reports/export/annual/${selectedYear.value}?token=${token}`;
  window.open(url, '_blank');
  ElMessage.success('正在导出报表...');
}

onMounted(() => {
  loadReport();
});
</script>

<style scoped>
.reports-page {
  padding: 0;
}

.header-card {
  margin-bottom: 20px;
}

.report-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.report-header h2 {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 15px 0 0;
}

.header-left {
  display: flex;
  align-items: center;
}

.stats-row {
  margin-bottom: 20px;
}

.stat-card {
  height: 100%;
}

.stat-content {
  display: flex;
  align-items: center;
  gap: 15px;
}

.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
}

.stat-icon.blue { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
.stat-icon.green { background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); }
.stat-icon.orange { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); }
.stat-icon.purple { background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); }

.stat-value {
  font-size: 24px;
  font-weight: bold;
  color: #333;
  line-height: 1;
}

.stat-label {
  font-size: 13px;
  color: #909399;
  margin-top: 4px;
}

.section-card {
  margin-bottom: 20px;
}

.mt-20 {
  margin-top: 20px;
}

.amount-summary {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 15px;
}

.amount-item {
  text-align: center;
  padding: 15px;
  background: #f8f9fa;
  border-radius: 8px;
}

.amount-label {
  display: block;
  font-size: 13px;
  color: #909399;
  margin-bottom: 5px;
}

.amount-value {
  font-size: 20px;
  font-weight: 600;
}

.amount-value.primary { color: #409eff; }
.amount-value.success { color: #67c23a; }
.amount-value.warning { color: #e6a23c; }
.amount-value.danger { color: #f56c6c; }

.info-item {
  text-align: center;
  padding: 10px;
}

.info-value {
  font-size: 28px;
  font-weight: bold;
  color: #333;
  line-height: 1;
}

.info-value.warning {
  color: #e6a23c;
}

.info-label {
  font-size: 13px;
  color: #909399;
  margin-top: 8px;
}

:deep(.el-table th) {
  background-color: #fafafa !important;
}
</style>
