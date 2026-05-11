<template>
  <div class="electricity-page">
    <el-card>
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center">
          <div style="display: flex; gap: 16px; align-items: center">
            <el-select v-model="filters.status" placeholder="审批状态" style="width: 140px" clearable @change="loadData">
              <el-option label="待审批" value="pending" />
              <el-option label="已通过" value="approved" />
              <el-option label="已拒绝" value="rejected" />
              <el-option label="部分通过" value="partially_approved" />
            </el-select>
            <el-button @click="loadData">
              <el-icon><Search /></el-icon>
              查询
            </el-button>
          </div>
          <el-tag type="danger" v-if="riskSummary.highRisk > 0">
            高风险用电申请：{{ riskSummary.highRisk }} 项
          </el-tag>
        </div>
      </template>
      
      <el-alert
        v-if="riskSummary.total > 0"
        :title="`共有 ${riskSummary.total} 项用电需要关注，其中高风险 ${riskSummary.highRisk} 项，待审批 ${riskSummary.pendingApproval} 项`"
        type="warning"
        show-icon
        :closable="false"
        style="margin-bottom: 16px"
      />
      
      <el-table :data="approvals" v-loading="loading" stripe>
        <el-table-column prop="approvalNo" label="审批编号" width="160" />
        <el-table-column label="摊位" width="180">
          <template #default="{ row }">
            <el-tag>{{ row.boothId?.code }}</el-tag>
            <span style="margin-left: 8px">{{ row.boothId?.name }}</span>
          </template>
        </el-table-column>
        <el-table-column label="商户" width="140">
          <template #default="{ row }">{{ row.merchantId?.name }}</template>
        </el-table-column>
        <el-table-column label="用电情况" width="220">
          <template #default="{ row }">
            <div>
              标准: <el-tag size="small">{{ row.standardElectricity }}kW</el-tag>
              申请: <el-tag size="small" :type="row.exceedsStandard ? 'danger' : 'success'">{{ row.requestedElectricity }}kW</el-tag>
            </div>
            <div v-if="row.exceedsStandard" style="margin-top: 4px; color: #f5222d; font-size: 12px">
              超出: +{{ (row.requestedElectricity - row.standardElectricity).toFixed(1) }}kW
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="approvedElectricity" label="审批通过" width="100">
          <template #default="{ row }">{{ row.approvedElectricity ? row.approvedElectricity + 'kW' : '-' }}</template>
        </el-table-column>
        <el-table-column label="风险等级" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.exceedsStandard" :type="getRiskTagType(row)">
              {{ getRiskLabel(row) }}
            </el-tag>
            <el-tag v-else type="success">正常</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusTagType(row.status)">{{ getStatusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="设备清单" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">
            <template v-if="row.equipmentList?.length > 0">
              <el-tag v-for="(eq, idx) in row.equipmentList" :key="idx" size="small" class="mr-5">
                {{ eq.name }}({{ eq.power }}kW×{{ eq.quantity }})
              </el-tag>
            </template>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column prop="approvedBy" label="审批人" width="100" />
        <el-table-column prop="createdAt" label="申请时间" width="160">
          <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <template v-if="row.status === 'pending'">
              <el-button size="small" type="success" @click="handleApprove(row)">通过</el-button>
              <el-button size="small" type="danger" @click="handleReject(row)">拒绝</el-button>
            </template>
            <el-button size="small" @click="viewDetail(row)">详情</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="detailVisible" title="用电审批详情" width="600px">
      <div v-if="currentApproval">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="审批编号">{{ currentApproval.approvalNo }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="getStatusTagType(currentApproval.status)">{{ getStatusLabel(currentApproval.status) }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="摊位">{{ currentApproval.boothId?.name }}</el-descriptions-item>
          <el-descriptions-item label="商户">{{ currentApproval.merchantId?.name }}</el-descriptions-item>
          <el-descriptions-item label="标准用电">{{ currentApproval.standardElectricity }} kW</el-descriptions-item>
          <el-descriptions-item label="申请用电">{{ currentApproval.requestedElectricity }} kW</el-descriptions-item>
          <el-descriptions-item label="是否超标">
            <el-tag :type="currentApproval.exceedsStandard ? 'danger' : 'success'">
              {{ currentApproval.exceedsStandard ? '是' : '否' }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="审批通过">
            {{ currentApproval.approvedElectricity ? currentApproval.approvedElectricity + ' kW' : '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="审批理由" :span="2">{{ currentApproval.reason || '-' }}</el-descriptions-item>
          <el-descriptions-item label="安全检查">
            <el-tag :type="currentApproval.safetyCheck ? 'success' : 'danger'">
              {{ currentApproval.safetyCheck ? '通过' : '未检查' }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="审批人">{{ currentApproval.approvedBy || '-' }}</el-descriptions-item>
        </el-descriptions>
      </div>
      <template #footer>
        <el-button @click="detailVisible = false">关闭</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="approveVisible" title="审批用电申请" width="500px">
      <el-form :model="approveForm" label-width="100px">
        <el-form-item label="标准用电">
          <el-tag>{{ currentApproval?.standardElectricity }} kW</el-tag>
        </el-form-item>
        <el-form-item label="申请用电">
          <el-tag :type="currentApproval?.exceedsStandard ? 'danger' : 'success'">{{ currentApproval?.requestedElectricity }} kW</el-tag>
        </el-form-item>
        <el-form-item label="批准用电" prop="approvedElectricity">
          <el-input-number v-model="approveForm.approvedElectricity" :min="0" :precision="1" style="width: 100%">
            <template #suffix>kW</template>
          </el-input-number>
        </el-form-item>
        <el-form-item label="安全检查">
          <el-switch v-model="approveForm.safetyCheck" />
        </el-form-item>
        <el-form-item label="审批理由">
          <el-input v-model="approveForm.reason" type="textarea" :rows="2" placeholder="请输入审批理由" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="approveVisible = false">取消</el-button>
        <el-button type="primary" @click="submitApprove">确认通过</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { electricityApi } from '@/api';
import { formatDateTime } from '@/utils/format';

const loading = ref(false);
const approvals = ref([]);
const detailVisible = ref(false);
const approveVisible = ref(false);
const currentApproval = ref(null);

const filters = reactive({
  status: ''
});

const riskSummary = reactive({
  total: 0,
  highRisk: 0,
  mediumRisk: 0,
  lowRisk: 0,
  pendingApproval: 0
});

const approveForm = reactive({
  approvedElectricity: 0,
  safetyCheck: true,
  reason: '',
  approvedBy: '系统管理员'
});

const getStatusTagType = (status) => {
  const map = { pending: 'warning', approved: 'success', rejected: 'danger', partially_approved: 'warning' };
  return map[status] || 'info';
};

const getStatusLabel = (status) => {
  const map = { pending: '待审批', approved: '已通过', rejected: '已拒绝', partially_approved: '部分通过' };
  return map[status] || status;
};

const getRiskTagType = (row) => {
  if (!row.exceedsStandard) return 'success';
  const excess = row.requestedElectricity - row.standardElectricity;
  if (excess > 10) return 'danger';
  if (excess > 5) return 'warning';
  return 'warning';
};

const getRiskLabel = (row) => {
  if (!row.exceedsStandard) return '正常';
  const excess = row.requestedElectricity - row.standardElectricity;
  if (excess > 10) return '高风险';
  if (excess > 5) return '中风险';
  return '低风险';
};

const loadData = async () => {
  loading.value = true;
  try {
    const [approvalsRes, riskRes] = await Promise.all([
      electricityApi.getAll(filters),
      electricityApi.getRisky()
    ]);
    approvals.value = approvalsRes.data;
    
    riskSummary.total = riskRes.data?.length || 0;
    riskSummary.highRisk = riskRes.data?.filter(r => r.riskLevel === 'high').length || 0;
    riskSummary.mediumRisk = riskRes.data?.filter(r => r.riskLevel === 'medium').length || 0;
    riskSummary.lowRisk = riskRes.data?.filter(r => r.riskLevel === 'low').length || 0;
    riskSummary.pendingApproval = riskRes.data?.filter(r => r.status === 'pending').length || 0;
  } catch (error) {
    console.error('加载数据失败:', error);
  } finally {
    loading.value = false;
  }
};

const viewDetail = async (row) => {
  try {
    const res = await electricityApi.getById(row._id);
    currentApproval.value = res.data;
    detailVisible.value = true;
  } catch (error) {
    console.error('获取详情失败:', error);
  }
};

const handleApprove = (row) => {
  currentApproval.value = row;
  approveForm.approvedElectricity = row.requestedElectricity;
  approveForm.safetyCheck = true;
  approveForm.reason = '人工审批通过';
  approveVisible.value = true;
};

const submitApprove = async () => {
  try {
    await electricityApi.approve(currentApproval.value._id, approveForm);
    ElMessage.success('审批通过');
    approveVisible.value = false;
    loadData();
  } catch (error) {
    console.error('审批失败:', error);
  }
};

const handleReject = async (row) => {
  try {
    const { value } = await ElMessageBox.prompt('请输入拒绝理由', '拒绝用电申请', {
      inputType: 'textarea',
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      inputPattern: /\S/,
      inputErrorMessage: '请输入拒绝理由'
    });
    
    await electricityApi.reject(row._id, { 
      reason: value, 
      approvedBy: '系统管理员' 
    });
    ElMessage.success('已拒绝');
    loadData();
  } catch (error) {
    if (error !== 'cancel') {
      console.error('操作失败:', error);
    }
  }
};

onMounted(() => {
  loadData();
});
</script>

<style scoped>
.electricity-page {
  height: 100%;
}
.mr-5 {
  margin-right: 5px;
}
</style>