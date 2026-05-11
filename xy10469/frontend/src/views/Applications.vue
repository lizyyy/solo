<template>
  <div class="applications-page">
    <el-card>
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center">
          <div style="display: flex; gap: 16px; align-items: center">
            <el-input 
              v-model="filters.keyword" 
              placeholder="搜索申请编号/商户" 
              style="width: 220px"
              clearable
              @clear="loadData"
            />
            <el-select v-model="filters.status" placeholder="申请状态" style="width: 120px" clearable @change="loadData">
              <el-option v-for="(item, key) in applicationStatusMap" :key="key" :label="item.label" :value="key" />
            </el-select>
            <el-button @click="loadData">
              <el-icon><Search /></el-icon>
              查询
            </el-button>
          </div>
          <el-button type="primary" @click="openDialog()">
            <el-icon><Plus /></el-icon>
            新建申请
          </el-button>
        </div>
      </template>
      
      <el-table :data="applications" v-loading="loading" stripe>
        <el-table-column prop="applicationNo" label="申请编号" width="160" />
        <el-table-column label="商户" width="150">
          <template #default="{ row }">{{ row.merchantId?.name }}</template>
        </el-table-column>
        <el-table-column label="摊位" width="160">
          <template #default="{ row }">
            <el-tag>{{ row.boothId?.code }}</el-tag>
            <span style="margin-left: 8px">{{ row.boothId?.name }}</span>
          </template>
        </el-table-column>
        <el-table-column label="档期" width="160">
          <template #default="{ row }">{{ row.scheduleId?.name }}</template>
        </el-table-column>
        <el-table-column label="申请时间" width="110">
          <template #default="{ row }">{{ formatDate(row.applicationDate) }}</template>
        </el-table-column>
        <el-table-column label="使用时间" width="220">
          <template #default="{ row }">
            {{ formatDate(row.startDate) }} 至 {{ formatDate(row.endDate) }}
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="applicationStatusMap[row.status]?.type">{{ applicationStatusMap[row.status]?.label }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="进度" width="180">
          <template #default="{ row }">
            <el-tag v-if="row.depositPaid" type="success" size="small">已缴押金</el-tag>
            <el-tag v-else type="warning" size="small">未缴押金</el-tag>
            <el-tag v-if="row.electricityApproved" type="success" size="small" style="margin-left: 4px">用电通过</el-tag>
            <el-tag v-else type="warning" size="small" style="margin-left: 4px">待用电审批</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="280" fixed="right">
          <template #default="{ row }">
            <template v-if="row.status === 'pending'">
              <el-button size="small" type="success" @click="handleApprove(row)">审批通过</el-button>
              <el-button size="small" type="danger" @click="handleReject(row)">拒绝</el-button>
            </template>
            <template v-else-if="row.status === 'approved' && row.depositPaid && row.electricityApproved">
              <el-button size="small" type="primary" @click="handleAdmission(row)">确认入场</el-button>
            </template>
            <template v-else-if="row.status === 'approved' && (!row.depositPaid || !row.electricityApproved)">
              <el-tooltip content="需缴纳押金并通过用电审批后才能入场" placement="top">
                <el-button size="small" type="primary" disabled>确认入场</el-button>
              </el-tooltip>
            </template>
            <el-button size="small" @click="viewDetail(row)">详情</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="800px">
      <el-form :model="form" :rules="rules" ref="formRef" label-width="100px">
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="选择商户" prop="merchantId">
              <el-select v-model="form.merchantId" placeholder="请选择商户" filterable style="width: 100%">
                <el-option 
                  v-for="m in merchantList" 
                  :key="m._id" 
                  :label="m.name" 
                  :value="m._id"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="选择档期" prop="scheduleId">
              <el-select v-model="form.scheduleId" placeholder="请选择档期" filterable style="width: 100%">
                <el-option 
                  v-for="s in scheduleList" 
                  :key="s._id" 
                  :label="s.name" 
                  :value="s._id"
                />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="选择摊位" prop="boothId">
              <el-select v-model="form.boothId" placeholder="请选择摊位" filterable style="width: 100%" @change="checkAvailability">
                <el-option 
                  v-for="b in boothList" 
                  :key="b._id" 
                  :label="`${b.code} - ${b.name} (${boothTypeMap[b.type]})`" 
                  :value="b._id"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="经营类型" prop="businessType">
              <el-input v-model="form.businessType" placeholder="请输入经营类型" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="使用时间" prop="dateRange">
          <el-date-picker
            v-model="form.dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            style="width: 100%"
            @change="checkAvailability"
          />
        </el-form-item>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="用电需求(kW)" prop="requiredElectricity">
              <el-input-number v-model="form.requiredElectricity" :min="0" :precision="1" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="预计营收">
              <el-input-number v-model="form.expectedRevenue" :min="0" :precision="2" style="width: 100%">
                <template #prefix>¥</template>
              </el-input-number>
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="特殊需求">
          <el-input v-model="form.specialRequirements" type="textarea" :rows="2" placeholder="请输入特殊需求" />
        </el-form-item>
        <el-alert 
          v-if="availabilityCheck.conflict" 
          :title="availabilityCheck.message" 
          type="warning" 
          :closable="false"
          show-icon
        />
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit" :disabled="availabilityCheck.conflict">确定</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="detailVisible" title="申请详情" width="700px">
      <div v-if="currentApp">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="申请编号">{{ currentApp.applicationNo }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="applicationStatusMap[currentApp.status]?.type">{{ applicationStatusMap[currentApp.status]?.label }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="商户">{{ currentApp.merchantId?.name }}</el-descriptions-item>
          <el-descriptions-item label="摊位">{{ currentApp.boothId?.name }}</el-descriptions-item>
          <el-descriptions-item label="档期">{{ currentApp.scheduleId?.name }}</el-descriptions-item>
          <el-descriptions-item label="经营类型">{{ currentApp.businessType }}</el-descriptions-item>
          <el-descriptions-item label="用电需求">{{ currentApp.requiredElectricity }} kW</el-descriptions-item>
          <el-descriptions-item label="使用时间">
            {{ formatDate(currentApp.startDate) }} 至 {{ formatDate(currentApp.endDate) }}
          </el-descriptions-item>
          <el-descriptions-item label="押金状态">
            <el-tag :type="currentApp.depositPaid ? 'success' : 'warning'">
              {{ currentApp.depositPaid ? '已缴纳' : '未缴纳' }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="用电审批">
            <el-tag :type="currentApp.electricityApproved ? 'success' : 'warning'">
              {{ currentApp.electricityApproved ? '已通过' : '待审批' }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="入场状态">
            <el-tag :type="currentApp.admissionConfirmed ? 'success' : 'warning'">
              {{ currentApp.admissionConfirmed ? '已确认' : '待入场' }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="特殊需求" :span="2">
            {{ currentApp.specialRequirements || '无' }}
          </el-descriptions-item>
        </el-descriptions>
        
        <el-divider content-position="left">可入场检查</el-divider>
        <el-row :gutter="20">
          <el-col :span="8">
            <el-statistic title="押金缴纳">
              <template #default>
                <el-tag :type="currentApp.depositPaid ? 'success' : 'danger'">
                  {{ currentApp.depositPaid ? '✓ 已完成' : '✗ 未完成' }}
                </el-tag>
              </template>
            </el-statistic>
          </el-col>
          <el-col :span="8">
            <el-statistic title="用电审批">
              <template #default>
                <el-tag :type="currentApp.electricityApproved ? 'success' : 'danger'">
                  {{ currentApp.electricityApproved ? '✓ 已完成' : '✗ 未完成' }}
                </el-tag>
              </template>
            </el-statistic>
          </el-col>
          <el-col :span="8">
            <el-statistic title="申请状态">
              <template #default>
                <el-tag :type="currentApp.status === 'approved' ? 'success' : 'warning'">
                  {{ currentApp.status === 'approved' ? '✓ 已通过' : '待审批' }}
                </el-tag>
              </template>
            </el-statistic>
          </el-col>
        </el-row>
      </div>
      <template #footer>
        <el-button @click="detailVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { applicationApi, merchantApi, boothApi, scheduleApi } from '@/api';
import { formatDate, applicationStatusMap, boothTypeMap } from '@/utils/format';

const loading = ref(false);
const applications = ref([]);
const merchantList = ref([]);
const boothList = ref([]);
const scheduleList = ref([]);
const dialogVisible = ref(false);
const detailVisible = ref(false);
const formRef = ref(null);
const isEdit = ref(false);
const currentApp = ref(null);

const filters = reactive({
  keyword: '',
  status: ''
});

const form = reactive({
  _id: '',
  merchantId: '',
  boothId: '',
  scheduleId: '',
  businessType: '',
  requiredElectricity: 3,
  expectedRevenue: 0,
  specialRequirements: '',
  dateRange: [],
  startDate: '',
  endDate: ''
});

const availabilityCheck = reactive({
  conflict: false,
  message: ''
});

const rules = {
  merchantId: [{ required: true, message: '请选择商户', trigger: 'change' }],
  boothId: [{ required: true, message: '请选择摊位', trigger: 'change' }],
  scheduleId: [{ required: true, message: '请选择档期', trigger: 'change' }],
  businessType: [{ required: true, message: '请输入经营类型', trigger: 'blur' }],
  dateRange: [{ required: true, message: '请选择使用时间', trigger: 'change' }],
  requiredElectricity: [{ required: true, message: '请输入用电需求', trigger: 'blur' }]
};

const dialogTitle = ref('新建申请');

const loadData = async () => {
  loading.value = true;
  try {
    const [appRes, merchRes, boothRes, scheduleRes] = await Promise.all([
      applicationApi.getAll(filters),
      merchantApi.getAll({ status: 'active' }),
      boothApi.getAll({ status: 'available' }),
      scheduleApi.getAll()
    ]);
    applications.value = appRes.data;
    merchantList.value = merchRes.data;
    boothList.value = boothRes.data;
    scheduleList.value = scheduleRes.data;
  } catch (error) {
    console.error('加载数据失败:', error);
  } finally {
    loading.value = false;
  }
};

const checkAvailability = async () => {
  if (!form.boothId || !form.dateRange || form.dateRange.length !== 2) {
    availabilityCheck.conflict = false;
    return;
  }
  
  try {
    const res = await boothApi.checkAvailability({
      boothId: form.boothId,
      startDate: form.dateRange[0],
      endDate: form.dateRange[1]
    });
    
    if (res.data.hasConflict) {
      availabilityCheck.conflict = true;
      availabilityCheck.message = '档期冲突：该摊位在申请时间段内已被占用';
    } else {
      availabilityCheck.conflict = false;
      availabilityCheck.message = '';
    }
  } catch (error) {
    availabilityCheck.conflict = false;
  }
};

const openDialog = (row = null) => {
  isEdit.value = !!row;
  dialogTitle.value = row ? '编辑申请' : '新建申请';
  
  if (row) {
    Object.assign(form, row);
    form.dateRange = [row.startDate, row.endDate];
  } else {
    Object.assign(form, {
      _id: '',
      merchantId: '',
      boothId: '',
      scheduleId: '',
      businessType: '',
      requiredElectricity: 3,
      expectedRevenue: 0,
      specialRequirements: '',
      dateRange: [],
      startDate: '',
      endDate: ''
    });
  }
  availabilityCheck.conflict = false;
  dialogVisible.value = true;
};

const handleSubmit = async () => {
  try {
    await formRef.value.validate();
    
    const submitData = { ...form };
    if (form.dateRange && form.dateRange.length === 2) {
      submitData.startDate = form.dateRange[0];
      submitData.endDate = form.dateRange[1];
    }
    
    await applicationApi.create(submitData);
    ElMessage.success('申请创建成功，等待审批');
    
    dialogVisible.value = false;
    loadData();
  } catch (error) {
    if (error !== 'validate') {
      console.error('保存失败:', error);
    }
  }
};

const handleApprove = async (row) => {
  try {
    await ElMessageBox.confirm(`确定通过商户 ${row.merchantId?.name} 的申请吗？`, '审批通过', {
      type: 'success'
    });
    
    await applicationApi.approve(row._id, { reviewedBy: '系统管理员' });
    ElMessage.success('审批通过，已生成押金和租金待支付记录');
    loadData();
  } catch (error) {
    if (error !== 'cancel') {
      console.error('审批失败:', error);
    }
  }
};

const handleReject = async (row) => {
  try {
    const { value } = await ElMessageBox.prompt('请输入拒绝原因', '拒绝申请', {
      inputType: 'textarea',
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      inputPattern: /\S/,
      inputErrorMessage: '请输入拒绝原因'
    });
    
    await applicationApi.reject(row._id, { 
      reviewedBy: '系统管理员', 
      reviewNote: value 
    });
    ElMessage.success('申请已拒绝');
    loadData();
  } catch (error) {
    if (error !== 'cancel') {
      console.error('操作失败:', error);
    }
  }
};

const handleAdmission = async (row) => {
  try {
    await ElMessageBox.confirm(`确认商户 ${row.merchantId?.name} 入场吗？`, '入场确认', {
      type: 'info'
    });
    
    await applicationApi.confirmAdmission(row._id);
    ElMessage.success('入场确认成功');
    loadData();
  } catch (error) {
    if (error !== 'cancel') {
      console.error('入场确认失败:', error);
    }
  }
};

const viewDetail = async (row) => {
  try {
    const res = await applicationApi.getById(row._id);
    currentApp.value = res.data;
    detailVisible.value = true;
  } catch (error) {
    console.error('获取详情失败:', error);
  }
};

onMounted(() => {
  loadData();
});
</script>

<style scoped>
.applications-page {
  height: 100%;
}
</style>