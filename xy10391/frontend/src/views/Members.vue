<template>
  <div class="members-page">
    <el-card class="filter-card" shadow="never">
      <el-form :inline="true" :model="filters" size="default">
        <el-form-item label="搜索">
          <el-input 
            v-model="filters.keyword" 
            placeholder="企业名称/会员编号/联系人"
            clearable
            style="width: 200px;"
            @keyup.enter="loadMembers"
          />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="filters.status" placeholder="全部状态" clearable style="width: 120px;">
            <el-option label="正常" value="active" />
            <el-option label="暂停" value="inactive" />
            <el-option label="已退会" value="resigned" />
          </el-select>
        </el-form-item>
        <el-form-item label="等级">
          <el-select v-model="filters.level" placeholder="全部等级" clearable style="width: 140px;">
            <el-option 
              v-for="level in memberLevels" 
              :key="level.id" 
              :label="level.level_name" 
              :value="level.id" 
            />
          </el-select>
        </el-form-item>
        <el-form-item label="年度">
          <el-select v-model="filters.year" style="width: 100px;">
            <el-option :label="(currentYear - 1) + '年度'" :value="currentYear - 1" />
            <el-option :label="currentYear + '年度'" :value="currentYear" />
            <el-option :label="(currentYear + 1) + '年度'" :value="currentYear + 1" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadMembers">
            <el-icon><Search /></el-icon> 查询
          </el-button>
          <el-button @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>
      
      <div class="action-bar">
        <el-button type="primary" @click="openAddDialog">
          <el-icon><Plus /></el-icon> 新增会员
        </el-button>
        <el-button type="success" @click="exportReport">
          <el-icon><Download /></el-icon> 导出报表
        </el-button>
      </div>
    </el-card>
    
    <el-card class="table-card" shadow="never">
      <el-table 
        :data="tableData" 
        v-loading="loading" 
        stripe 
        border
        style="width: 100%"
      >
        <el-table-column prop="memberCode" label="会员编号" width="90" fixed="left" />
        <el-table-column prop="companyName" label="企业名称" min-width="180" fixed="left" show-overflow-tooltip />
        <el-table-column prop="memberLevelName" label="等级" width="100" />
        <el-table-column prop="contactPerson" label="联系人" width="90" />
        <el-table-column prop="contactPhone" label="联系电话" width="120" />
        <el-table-column label="小微企业" width="80" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.isSmallEnterprise" type="success" size="small">是</el-tag>
            <span v-else class="text-info">-</span>
          </template>
        </el-table-column>
        <el-table-column label="入会时间" width="110">
          <template #default="{ row }">
            {{ row.joinDate }}
          </template>
        </el-table-column>
        <el-table-column label="到期时间" width="110">
          <template #default="{ row }">
            {{ row.expiryDate }}
          </template>
        </el-table-column>
        <el-table-column label="应收" width="100" align="right">
          <template #default="{ row }">
            <span class="text-primary">¥{{ formatNumber(row.originalAmount) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="减免" width="100" align="right">
          <template #default="{ row }">
            <span class="text-warning">¥{{ formatNumber(row.reductionAmount) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="已收" width="100" align="right">
          <template #default="{ row }">
            <span class="text-success">¥{{ formatNumber(row.paidAmount) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="欠费" width="100" align="right">
          <template #default="{ row }">
            <span v-if="row.dueAmount > 0.01" class="text-danger">¥{{ formatNumber(row.dueAmount) }}</span>
            <span v-else class="text-success">-</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <span :class="getReminderClass(row.reminderStatus)">{{ row.reminderDescription }}</span>
          </template>
        </el-table-column>
        <el-table-column label="会员状态" width="90">
          <template #default="{ row }">
            <span :class="getStatusClass(row.status)">{{ getStatusText(row.status) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-button size="small" type="primary" link @click="viewDetail(row)">
              详情
            </el-button>
            <el-button size="small" type="warning" link @click="openPaymentDialog(row)">
              缴费
            </el-button>
            <el-button size="small" type="success" link @click="openReductionDialog(row)">
              减免
            </el-button>
            <el-button size="small" link @click="openEditDialog(row)">
              编辑
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
    
    <el-dialog 
      v-model="memberDialogVisible" 
      :title="isEdit ? '编辑会员' : '新增会员'" 
      width="700px"
    >
      <el-form :model="memberForm" :rules="memberRules" ref="memberFormRef" label-width="100px">
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="企业名称" prop="companyName">
              <el-input v-model="memberForm.companyName" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="会员等级" prop="memberLevelId">
              <el-select v-model="memberForm.memberLevelId" style="width: 100%;">
                <el-option 
                  v-for="level in memberLevels" 
                  :key="level.id" 
                  :label="level.level_name" 
                  :value="level.id" 
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="法人">
              <el-input v-model="memberForm.legalPerson" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="联系人" prop="contactPerson">
              <el-input v-model="memberForm.contactPerson" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="联系电话" prop="contactPhone">
              <el-input v-model="memberForm.contactPhone" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="行业">
              <el-input v-model="memberForm.industry" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="入会时间" prop="joinDate">
              <el-date-picker 
                v-model="memberForm.joinDate" 
                type="date" 
                value-format="YYYY-MM-DD"
                style="width: 100%;"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="到期时间">
              <el-date-picker 
                v-model="memberForm.expiryDate" 
                type="date" 
                value-format="YYYY-MM-DD"
                style="width: 100%;"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="会员状态" prop="status">
              <el-select v-model="memberForm.status" style="width: 100%;">
                <el-option label="正常" value="active" />
                <el-option label="暂停" value="inactive" />
                <el-option label="已退会" value="resigned" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="小微企业">
              <el-switch v-model="memberForm.isSmallEnterprise" />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="地址">
              <el-input v-model="memberForm.address" type="textarea" :rows="2" />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="备注">
              <el-input v-model="memberForm.note" type="textarea" :rows="2" />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
      <template #footer>
        <el-button @click="memberDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveMember" :loading="saving">保存</el-button>
      </template>
    </el-dialog>
    
    <el-dialog 
      v-model="paymentDialogVisible" 
      title="缴费录入" 
      width="600px"
    >
      <el-form :model="paymentForm" :rules="paymentRules" ref="paymentFormRef" label-width="100px">
        <el-form-item label="会员">
          <el-input :value="currentMember?.companyName" disabled />
        </el-form-item>
        <el-form-item label="缴费年度" prop="feeYear">
          <el-select v-model="paymentForm.feeYear" style="width: 100%;">
            <el-option :label="(currentYear - 1) + '年度'" :value="currentYear - 1" />
            <el-option :label="currentYear + '年度'" :value="currentYear" />
            <el-option :label="(currentYear + 1) + '年度'" :value="currentYear + 1" />
          </el-select>
        </el-form-item>
        <el-form-item label="缴费方式" prop="paymentMethod">
          <el-select v-model="paymentForm.paymentMethod" style="width: 100%;">
            <el-option label="银行转账" value="银行转账" />
            <el-option label="支票" value="支票" />
            <el-option label="现金" value="现金" />
            <el-option label="微信支付" value="微信支付" />
            <el-option label="支付宝" value="支付宝" />
            <el-option label="其他" value="其他" />
          </el-select>
        </el-form-item>
        <el-form-item label="缴费金额" prop="paidAmount">
          <el-input-number 
            v-model="paymentForm.paidAmount" 
            :min="0" 
            :precision="2" 
            :controls="false"
            style="width: 100%;"
          />
        </el-form-item>
        <el-form-item label="缴费日期" prop="paymentDate">
          <el-date-picker 
            v-model="paymentForm.paymentDate" 
            type="date" 
            value-format="YYYY-MM-DD"
            style="width: 100%;"
          />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="paymentForm.remark" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="paymentDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="savePayment" :loading="saving">确认缴费</el-button>
      </template>
    </el-dialog>
    
    <el-dialog 
      v-model="reductionDialogVisible" 
      title="减免申请" 
      width="600px"
    >
      <el-form :model="reductionForm" :rules="reductionRules" ref="reductionFormRef" label-width="100px">
        <el-form-item label="会员">
          <el-input :value="currentMember?.companyName" disabled />
        </el-form-item>
        <el-form-item label="减免年度" prop="feeYear">
          <el-select v-model="reductionForm.feeYear" style="width: 100%;">
            <el-option :label="currentYear + '年度'" :value="currentYear" />
            <el-option :label="(currentYear + 1) + '年度'" :value="currentYear + 1" />
          </el-select>
        </el-form-item>
        <el-form-item label="减免类型" prop="requestType">
          <el-radio-group v-model="reductionForm.requestType">
            <el-radio value="percentage">按比例减免</el-radio>
            <el-radio value="fixed">固定金额减免</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item :label="reductionForm.requestType === 'percentage' ? '减免比例(%)' : '减免金额'">
          <el-input-number 
            v-model="reductionForm.requestValue" 
            :min="0" 
            :max="reductionForm.requestType === 'percentage' ? 100 : undefined"
            :precision="2" 
            :controls="false"
            style="width: 100%;"
          />
        </el-form-item>
        <el-form-item label="减免原因" prop="reason">
          <el-input v-model="reductionForm.reason" type="textarea" :rows="3" placeholder="请详细说明减免原因" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="reductionDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveReduction" :loading="saving">提交申请</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import request from '@/utils/request';
import dayjs from 'dayjs';

const router = useRouter();

const currentYear = ref(dayjs().year());
const loading = ref(false);
const saving = ref(false);
const tableData = ref([]);
const memberLevels = ref([]);

const filters = reactive({
  keyword: '',
  status: '',
  level: '',
  year: currentYear.value
});

const memberDialogVisible = ref(false);
const isEdit = ref(false);
const memberFormRef = ref(null);
const memberForm = reactive({
  id: null,
  companyName: '',
  memberLevelId: '',
  legalPerson: '',
  contactPerson: '',
  contactPhone: '',
  address: '',
  industry: '',
  isSmallEnterprise: false,
  joinDate: '',
  expiryDate: '',
  status: 'active',
  note: ''
});

const memberRules = {
  companyName: [{ required: true, message: '请输入企业名称', trigger: 'blur' }],
  memberLevelId: [{ required: true, message: '请选择会员等级', trigger: 'change' }],
  contactPerson: [{ required: true, message: '请输入联系人', trigger: 'blur' }],
  contactPhone: [{ required: true, message: '请输入联系电话', trigger: 'blur' }],
  joinDate: [{ required: true, message: '请选择入会时间', trigger: 'change' }]
};

const paymentDialogVisible = ref(false);
const currentMember = ref(null);
const paymentFormRef = ref(null);
const paymentForm = reactive({
  feeYear: currentYear.value,
  paidAmount: '',
  paymentMethod: '',
  paymentDate: dayjs().format('YYYY-MM-DD'),
  remark: ''
});

const paymentRules = {
  feeYear: [{ required: true, message: '请选择缴费年度', trigger: 'change' }],
  paidAmount: [{ required: true, message: '请输入缴费金额', trigger: 'blur' }],
  paymentMethod: [{ required: true, message: '请选择缴费方式', trigger: 'change' }],
  paymentDate: [{ required: true, message: '请选择缴费日期', trigger: 'change' }]
};

const reductionDialogVisible = ref(false);
const reductionFormRef = ref(null);
const reductionForm = reactive({
  feeYear: currentYear.value,
  requestType: 'percentage',
  requestValue: 50,
  reason: ''
});

const reductionRules = {
  feeYear: [{ required: true, message: '请选择减免年度', trigger: 'change' }],
  requestType: [{ required: true, message: '请选择减免类型', trigger: 'change' }],
  requestValue: [{ required: true, message: '请输入减免值', trigger: 'blur' }],
  reason: [{ required: true, message: '请输入减免原因', trigger: 'blur' }]
};

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

async function loadMemberLevels() {
  memberLevels.value = await request.get('/members/levels');
}

async function loadMembers() {
  loading.value = true;
  try {
    const params = {};
    if (filters.keyword) params.keyword = filters.keyword;
    if (filters.status) params.status = filters.status;
    if (filters.level) params.level = filters.level;
    if (filters.year) params.year = filters.year;
    
    const result = await request.get('/members', { params });
    tableData.value = result.data;
  } finally {
    loading.value = false;
  }
}

function resetFilters() {
  filters.keyword = '';
  filters.status = '';
  filters.level = '';
  filters.year = currentYear.value;
  loadMembers();
}

function viewDetail(row) {
  router.push(`/members/${row.id}`);
}

function openAddDialog() {
  isEdit.value = false;
  Object.assign(memberForm, {
    id: null,
    companyName: '',
    memberLevelId: memberLevels.value[0]?.id || '',
    legalPerson: '',
    contactPerson: '',
    contactPhone: '',
    address: '',
    industry: '',
    isSmallEnterprise: false,
    joinDate: dayjs().format('YYYY-MM-DD'),
    expiryDate: '',
    status: 'active',
    note: ''
  });
  memberDialogVisible.value = true;
}

function openEditDialog(row) {
  isEdit.value = true;
  Object.assign(memberForm, {
    id: row.id,
    companyName: row.companyName,
    memberLevelId: row.memberLevelId,
    legalPerson: row.legalPerson,
    contactPerson: row.contactPerson,
    contactPhone: row.contactPhone,
    address: row.address,
    industry: row.industry,
    isSmallEnterprise: !!row.isSmallEnterprise,
    joinDate: row.joinDate,
    expiryDate: row.expiryDate,
    status: row.status,
    note: row.note
  });
  memberDialogVisible.value = true;
}

async function saveMember() {
  if (!memberFormRef.value) return;
  
  try {
    await memberFormRef.value.validate();
    saving.value = true;
    
    const data = {
      companyName: memberForm.companyName,
      memberLevelId: memberForm.memberLevelId,
      legalPerson: memberForm.legalPerson,
      contactPerson: memberForm.contactPerson,
      contactPhone: memberForm.contactPhone,
      address: memberForm.address,
      industry: memberForm.industry,
      isSmallEnterprise: memberForm.isSmallEnterprise,
      joinDate: memberForm.joinDate,
      expiryDate: memberForm.expiryDate,
      status: memberForm.status,
      note: memberForm.note
    };
    
    if (isEdit.value) {
      await request.put(`/members/${memberForm.id}`, data);
      ElMessage.success('更新成功');
    } else {
      await request.post('/members', data);
      ElMessage.success('创建成功');
    }
    
    memberDialogVisible.value = false;
    loadMembers();
  } catch (error) {
    if (error?.errors) return;
  } finally {
    saving.value = false;
  }
}

function openPaymentDialog(row) {
  if (row.status === 'resigned') {
    ElMessage.warning('该会员已退会，无法缴费');
    return;
  }
  currentMember.value = row;
  Object.assign(paymentForm, {
    feeYear: currentYear.value,
    paidAmount: '',
    paymentMethod: '',
    paymentDate: dayjs().format('YYYY-MM-DD'),
    remark: ''
  });
  paymentDialogVisible.value = true;
}

async function savePayment() {
  if (!paymentFormRef.value) return;
  
  try {
    await paymentFormRef.value.validate();
    saving.value = true;
    
    await request.post('/payments', {
      memberId: currentMember.value.id,
      feeYear: paymentForm.feeYear,
      paidAmount: paymentForm.paidAmount,
      paymentMethod: paymentForm.paymentMethod,
      paymentDate: paymentForm.paymentDate,
      remark: paymentForm.remark
    });
    
    ElMessage.success('缴费录入成功');
    paymentDialogVisible.value = false;
    loadMembers();
  } catch (error) {
    if (error?.errors) return;
  } finally {
    saving.value = false;
  }
}

function openReductionDialog(row) {
  if (row.status === 'resigned') {
    ElMessage.warning('该会员已退会，无法申请减免');
    return;
  }
  currentMember.value = row;
  Object.assign(reductionForm, {
    feeYear: currentYear.value,
    requestType: 'percentage',
    requestValue: row.isSmallEnterprise ? 50 : 30,
    reason: ''
  });
  reductionDialogVisible.value = true;
}

async function saveReduction() {
  if (!reductionFormRef.value) return;
  
  try {
    await reductionFormRef.value.validate();
    saving.value = true;
    
    await request.post('/reductions', {
      memberId: currentMember.value.id,
      feeYear: reductionForm.feeYear,
      requestType: reductionForm.requestType,
      requestValue: reductionForm.requestValue,
      reason: reductionForm.reason
    });
    
    ElMessage.success('减免申请提交成功');
    reductionDialogVisible.value = false;
    loadMembers();
  } catch (error) {
    if (error?.errors) return;
  } finally {
    saving.value = false;
  }
}

function exportReport() {
  const token = localStorage.getItem('token');
  const url = `/api/reports/export/annual/${filters.year}?token=${token}`;
  window.open(url, '_blank');
}

onMounted(() => {
  loadMemberLevels();
  loadMembers();
});
</script>

<style scoped>
.members-page {
  padding: 0;
}

.filter-card {
  margin-bottom: 20px;
}

.action-bar {
  margin-top: 10px;
  padding-top: 15px;
  border-top: 1px solid #ebeef5;
}

.table-card {
  padding: 0;
}

:deep(.el-table th) {
  background-color: #fafafa !important;
}
</style>
