<template>
  <div class="member-detail-page">
    <el-page-header @back="goBack" content="会员详情" />
    
    <div v-loading="loading" class="mt-20">
      <el-row :gutter="20">
        <el-col :span="24">
          <el-card class="info-card" shadow="never">
            <template #header>
              <div class="card-title">
                <span><el-icon><User /></el-icon> 基本信息</span>
                <div>
                  <el-tag v-if="member?.is_small_enterprise" type="success" size="small" class="mr-10">小微企业</el-tag>
                  <span :class="getStatusClass(member?.status)">{{ getStatusText(member?.status) }}</span>
                </div>
              </div>
            </template>
            
            <el-descriptions :column="4" border>
              <el-descriptions-item label="会员编号">{{ member?.member_code }}</el-descriptions-item>
              <el-descriptions-item label="会员等级">{{ member?.memberLevelName }}</el-descriptions-item>
              <el-descriptions-item label="入会时间">{{ member?.join_date }}</el-descriptions-item>
              <el-descriptions-item label="到期时间">{{ member?.expiry_date }}</el-descriptions-item>
              <el-descriptions-item label="企业名称" :span="2">{{ member?.company_name }}</el-descriptions-item>
              <el-descriptions-item label="法人代表">{{ member?.legal_person }}</el-descriptions-item>
              <el-descriptions-item label="行业">{{ member?.industry }}</el-descriptions-item>
              <el-descriptions-item label="联系人">{{ member?.contact_person }}</el-descriptions-item>
              <el-descriptions-item label="联系电话">{{ member?.contact_phone }}</el-descriptions-item>
              <el-descriptions-item label="地址" :span="2">{{ member?.address }}</el-descriptions-item>
              <el-descriptions-item label="备注" :span="4">{{ member?.note || '-' }}</el-descriptions-item>
            </el-descriptions>
          </el-card>
        </el-col>
      </el-row>
      
      <el-row :gutter="20" class="mt-20">
        <el-col :span="12">
          <el-card class="info-card" shadow="never">
            <template #header>
              <span><el-icon><Money /></el-icon> {{ currentYear }}年度会费情况</span>
            </template>
            
            <div class="fee-summary">
              <div class="fee-item">
                <span class="fee-label">应收金额</span>
                <span class="fee-value primary">¥{{ formatNumber(member?.feeInfo?.originalAmount) }}</span>
              </div>
              <div class="fee-item">
                <span class="fee-label">减免金额</span>
                <span class="fee-value warning">¥{{ formatNumber(member?.feeInfo?.reductionAmount) }}</span>
              </div>
              <div class="fee-item">
                <span class="fee-label">已收金额</span>
                <span class="fee-value success">¥{{ formatNumber(member?.feeInfo?.paidAmount) }}</span>
              </div>
              <div class="fee-item">
                <span class="fee-label">欠费金额</span>
                <span :class="['fee-value', member?.feeInfo?.dueAmount > 0.01 ? 'danger' : 'success']">
                  ¥{{ formatNumber(member?.feeInfo?.dueAmount) }}
                </span>
              </div>
            </div>
            
            <el-alert 
              :title="member?.reminderStatus?.description" 
              :type="getAlertType(member?.reminderStatus?.level)"
              :closable="false"
              style="margin-top: 15px;"
            />
          </el-card>
        </el-col>
        
        <el-col :span="12">
          <el-card class="info-card" shadow="never">
            <template #header>
              <span><el-icon><Bell /></el-icon> 催缴状态</span>
            </template>
            
            <div class="reminder-info">
              <el-statistic title="当前状态">
                <template #default>
                  <span :class="getStatusClass(member?.reminderStatus?.status)">
                    {{ getReminderStatusText(member?.reminderStatus?.status) }}
                  </span>
                </template>
              </el-statistic>
              
              <div class="reminder-detail" v-if="member?.reminderStatus?.status !== 'resigned'">
                <div class="detail-item">
                  <span class="label">到期时间：</span>
                  <span>{{ member?.expiry_date }}</span>
                </div>
                <div class="detail-item" v-if="member?.reminderStatus?.daysOverdue">
                  <span class="label">逾期天数：</span>
                  <span class="text-danger">{{ member?.reminderStatus?.daysOverdue }}天</span>
                </div>
                <div class="detail-item" v-if="member?.reminderStatus?.daysToExpiry">
                  <span class="label">剩余天数：</span>
                  <span class="text-warning">{{ member?.reminderStatus?.daysToExpiry }}天</span>
                </div>
              </div>
            </div>
          </el-card>
        </el-col>
      </el-row>
      
      <el-row :gutter="20" class="mt-20">
        <el-col :span="12">
          <el-card class="info-card" shadow="never">
            <template #header>
              <span><el-icon><List /></el-icon> 缴费记录</span>
            </template>
            
            <el-table :data="member?.payments || []" size="small" stripe empty-text="暂无缴费记录">
              <el-table-column prop="payment_no" label="缴费单号" width="120" />
              <el-table-column prop="fee_year" label="年度" width="80" />
              <el-table-column prop="paid_amount" label="金额" width="100">
                <template #default="{ row }">¥{{ formatNumber(row.paid_amount) }}</template>
              </el-table-column>
              <el-table-column prop="payment_method" label="方式" width="100" />
              <el-table-column prop="payment_date" label="日期" width="110" />
              <el-table-column prop="creator_name" label="操作人" width="90" />
            </el-table>
          </el-card>
        </el-col>
        
        <el-col :span="12">
          <el-card class="info-card" shadow="never">
            <template #header>
              <span><el-icon><Discount /></el-icon> 减免记录</span>
            </template>
            
            <el-table :data="member?.reductions || []" size="small" stripe empty-text="暂无减免记录">
              <el-table-column prop="request_code" label="申请编号" width="100" />
              <el-table-column prop="fee_year" label="年度" width="70" />
              <el-table-column label="申请内容" width="130">
                <template #default="{ row }">
                  {{ row.request_type === 'percentage' ? row.request_value + '%' : '¥' + row.request_value }}
                </template>
              </el-table-column>
              <el-table-column prop="status" label="状态" width="80">
                <template #default="{ row }">
                  <span :class="getReductionStatusClass(row.status)">{{ getReductionStatusText(row.status) }}</span>
                </template>
              </el-table-column>
              <el-table-column prop="applied_amount" label="减免额" width="90">
                <template #default="{ row }">¥{{ formatNumber(row.applied_amount) }}</template>
              </el-table-column>
            </el-table>
          </el-card>
        </el-col>
      </el-row>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import request from '@/utils/request';
import dayjs from 'dayjs';

const router = useRouter();
const route = useRoute();

const loading = ref(false);
const member = ref(null);
const currentYear = ref(dayjs().year());

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
    resigned: 'badge-info',
    paid: 'badge-success',
    normal: 'badge-info',
    pending: 'badge-warning',
    overdue: 'badge-danger',
    inactive: 'badge-warning'
  };
  return map[status] || 'badge-info';
}

function getReminderStatusText(status) {
  const map = {
    paid: '已结清',
    normal: '正常',
    pending: '待催缴',
    overdue: '逾期',
    inactive: '暂停',
    resigned: '已退会'
  };
  return map[status] || status;
}

function getAlertType(level) {
  const map = {
    success: 'success',
    warning: 'warning',
    danger: 'error',
    info: 'info',
    inactive: 'warning'
  };
  return map[level] || 'info';
}

function getReductionStatusText(status) {
  const map = {
    pending: '待审批',
    approved: '已批准',
    rejected: '已拒绝',
    cancelled: '已取消'
  };
  return map[status] || status;
}

function getReductionStatusClass(status) {
  const map = {
    pending: 'badge-warning',
    approved: 'badge-success',
    rejected: 'badge-danger',
    cancelled: 'badge-info'
  };
  return map[status] || 'badge-info';
}

function goBack() {
  router.back();
}

async function loadMember() {
  loading.value = true;
  try {
    member.value = await request.get(`/members/${route.params.id}`, {
      params: { year: currentYear.value }
    });
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  loadMember();
});
</script>

<style scoped>
.member-detail-page {
  padding: 0;
}

.mt-20 {
  margin-top: 20px;
}

.card-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 600;
}

.mr-10 {
  margin-right: 10px;
}

.fee-summary {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 15px;
}

.fee-item {
  text-align: center;
  padding: 15px;
  background: #f8f9fa;
  border-radius: 8px;
}

.fee-label {
  display: block;
  font-size: 13px;
  color: #909399;
  margin-bottom: 5px;
}

.fee-value {
  font-size: 22px;
  font-weight: 600;
}

.fee-value.primary { color: #409eff; }
.fee-value.success { color: #67c23a; }
.fee-value.warning { color: #e6a23c; }
.fee-value.danger { color: #f56c6c; }

.reminder-info {
  text-align: center;
}

.reminder-detail {
  margin-top: 20px;
  text-align: left;
}

.detail-item {
  margin-bottom: 8px;
  font-size: 14px;
}

.detail-item .label {
  color: #909399;
}
</style>
