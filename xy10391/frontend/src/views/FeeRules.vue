<template>
  <div class="fee-rules-page">
    <el-card class="filter-card" shadow="never">
      <el-form :inline="true" :model="filters" size="default">
        <el-form-item label="年度">
          <el-select v-model="filters.year" placeholder="全部年度" clearable style="width: 150px;">
            <el-option :label="(currentYear - 1) + '年度'" :value="currentYear - 1" />
            <el-option :label="currentYear + '年度'" :value="currentYear" />
            <el-option :label="(currentYear + 1) + '年度'" :value="currentYear + 1" />
          </el-select>
        </el-form-item>
        <el-form-item label="等级">
          <el-select v-model="filters.levelId" placeholder="全部等级" clearable style="width: 150px;">
            <el-option 
              v-for="level in memberLevels" 
              :key="level.id" 
              :label="level.level_name" 
              :value="level.id" 
            />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadRules">
            <el-icon><Search /></el-icon> 查询
          </el-button>
          <el-button @click="resetFilters">重置</el-button>
        </el-form-item>
        <el-button type="success" @click="openAddDialog">
          <el-icon><Plus /></el-icon> 新增规则
        </el-button>
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
        <el-table-column prop="effective_year" label="年度" width="120" align="center" />
        <el-table-column prop="level_name" label="会员等级" width="150" />
        <el-table-column prop="rule_name" label="规则名称" min-width="200" show-overflow-tooltip />
        <el-table-column prop="fee_amount" label="会费金额" width="150" align="right">
          <template #default="{ row }">
            <span class="text-primary" style="font-weight: 600;">¥{{ formatNumber(row.fee_amount) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="description" label="说明" min-width="200" show-overflow-tooltip />
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button size="small" type="primary" link @click="openEditDialog(row)">
              编辑
            </el-button>
            <el-button size="small" type="danger" link @click="handleDelete(row)">
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
    
    <el-dialog 
      v-model="dialogVisible" 
      :title="isEdit ? '编辑会费规则' : '新增会费规则'" 
      width="500px"
    >
      <el-form :model="ruleForm" :rules="formRules" ref="ruleFormRef" label-width="100px">
        <el-form-item label="规则名称" prop="ruleName">
          <el-input v-model="ruleForm.ruleName" />
        </el-form-item>
        <el-form-item label="会员等级" prop="memberLevelId">
          <el-select v-model="ruleForm.memberLevelId" style="width: 100%;">
            <el-option 
              v-for="level in memberLevels" 
              :key="level.id" 
              :label="level.level_name" 
              :value="level.id" 
            />
          </el-select>
        </el-form-item>
        <el-form-item label="生效年度" prop="effectiveYear">
          <el-select v-model="ruleForm.effectiveYear" style="width: 100%;">
            <el-option :label="(currentYear - 1) + '年度'" :value="currentYear - 1" />
            <el-option :label="currentYear + '年度'" :value="currentYear" />
            <el-option :label="(currentYear + 1) + '年度'" :value="currentYear + 1" />
          </el-select>
        </el-form-item>
        <el-form-item label="会费金额" prop="feeAmount">
          <el-input-number 
            v-model="ruleForm.feeAmount" 
            :min="0" 
            :precision="2" 
            :controls="false"
            style="width: 100%;"
          />
        </el-form-item>
        <el-form-item label="说明">
          <el-input v-model="ruleForm.description" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveRule" :loading="saving">保存</el-button>
      </template>
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
const saving = ref(false);
const tableData = ref([]);
const memberLevels = ref([]);

const filters = reactive({
  year: '',
  levelId: ''
});

const dialogVisible = ref(false);
const isEdit = ref(false);
const ruleFormRef = ref(null);
const ruleForm = reactive({
  id: null,
  ruleName: '',
  memberLevelId: '',
  effectiveYear: currentYear.value,
  feeAmount: '',
  description: ''
});

const formRules = {
  ruleName: [{ required: true, message: '请输入规则名称', trigger: 'blur' }],
  memberLevelId: [{ required: true, message: '请选择会员等级', trigger: 'change' }],
  effectiveYear: [{ required: true, message: '请选择生效年度', trigger: 'change' }],
  feeAmount: [{ required: true, message: '请输入会费金额', trigger: 'blur' }]
};

function formatNumber(num) {
  if (num == null) return '0.00';
  return parseFloat(num).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function loadMemberLevels() {
  memberLevels.value = await request.get('/members/levels');
}

async function loadRules() {
  loading.value = true;
  try {
    const params = {};
    if (filters.year) params.year = filters.year;
    if (filters.levelId) params.levelId = filters.levelId;
    
    const result = await request.get('/fee-rules', { params });
    tableData.value = result.data;
  } finally {
    loading.value = false;
  }
}

function resetFilters() {
  filters.year = '';
  filters.levelId = '';
  loadRules();
}

function openAddDialog() {
  isEdit.value = false;
  Object.assign(ruleForm, {
    id: null,
    ruleName: '',
    memberLevelId: memberLevels.value[0]?.id || '',
    effectiveYear: currentYear.value,
    feeAmount: '',
    description: ''
  });
  dialogVisible.value = true;
}

function openEditDialog(row) {
  isEdit.value = true;
  Object.assign(ruleForm, {
    id: row.id,
    ruleName: row.rule_name,
    memberLevelId: row.member_level_id,
    effectiveYear: row.effective_year,
    feeAmount: row.fee_amount,
    description: row.description
  });
  dialogVisible.value = true;
}

async function saveRule() {
  if (!ruleFormRef.value) return;
  
  try {
    await ruleFormRef.value.validate();
    saving.value = true;
    
    const data = {
      ruleName: ruleForm.ruleName,
      memberLevelId: ruleForm.memberLevelId,
      effectiveYear: ruleForm.effectiveYear,
      feeAmount: ruleForm.feeAmount,
      description: ruleForm.description
    };
    
    if (isEdit.value) {
      await request.put(`/fee-rules/${ruleForm.id}`, data);
      ElMessage.success('更新成功');
    } else {
      await request.post('/fee-rules', data);
      ElMessage.success('创建成功');
    }
    
    dialogVisible.value = false;
    loadRules();
  } catch (error) {
    if (error?.errors) return;
  } finally {
    saving.value = false;
  }
}

function handleDelete(row) {
  ElMessageBox.confirm(`确定要删除规则"${row.rule_name}"吗？`, '确认删除', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(async () => {
    await request.delete(`/fee-rules/${row.id}`);
    ElMessage.success('删除成功');
    loadRules();
  }).catch(() => {});
}

onMounted(() => {
  loadMemberLevels();
  loadRules();
});
</script>

<style scoped>
.fee-rules-page {
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
