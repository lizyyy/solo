<template>
  <div class="acceptance-page">
    <el-tabs v-model="activeTab" @tab-change="loadData">
      <el-tab-pane label="入场验收" name="admission">
        <el-card>
          <template #header>
            <div style="display: flex; justify-content: space-between; align-items: center">
              <span>入场验收记录</span>
              <el-button type="primary" @click="openAdmissionDialog()">
                <el-icon><Plus /></el-icon>
                新增入场验收
              </el-button>
            </div>
          </template>
          
          <el-table :data="admissionList" v-loading="loading" stripe>
            <el-table-column prop="acceptanceNo" label="验收编号" width="160" />
            <el-table-column label="商户" width="140">
              <template #default="{ row }">{{ row.merchantId?.name }}</template>
            </el-table-column>
            <el-table-column label="摊位" width="180">
              <template #default="{ row }">
                <el-tag>{{ row.boothId?.code }}</el-tag>
                <span style="margin-left: 8px">{{ row.boothId?.name }}</span>
              </template>
            </el-table-column>
            <el-table-column label="验收项" width="150">
              <template #default="{ row }">
                <span>{{ row.items?.length || 0 }} 项</span>
                <el-tag v-if="getFailedCount(row) > 0" type="danger" size="small" style="margin-left: 8px">
                  {{ getFailedCount(row) }} 项未通过
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="overallStatus" label="验收结果" width="100">
              <template #default="{ row }">
                <el-tag :type="acceptanceStatusMap[row.overallStatus]?.type">
                  {{ acceptanceStatusMap[row.overallStatus]?.label }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="inspector" label="检查人" width="100" />
            <el-table-column prop="inspectionDate" label="检查时间" width="170">
              <template #default="{ row }">{{ formatDateTime(row.inspectionDate) }}</template>
            </el-table-column>
            <el-table-column label="操作" width="120">
              <template #default="{ row }">
                <el-button size="small" @click="viewDetail(row)">详情</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-tab-pane>
      
      <el-tab-pane label="撤场验收" name="withdrawal">
        <el-card>
          <template #header>
            <div style="display: flex; justify-content: space-between; align-items: center">
              <span>撤场验收记录</span>
              <el-button type="primary" @click="openWithdrawalDialog()">
                <el-icon><Plus /></el-icon>
                新增撤场验收
              </el-button>
            </div>
          </template>
          
          <el-table :data="withdrawalList" v-loading="loading" stripe>
            <el-table-column prop="acceptanceNo" label="验收编号" width="160" />
            <el-table-column label="商户" width="140">
              <template #default="{ row }">{{ row.merchantId?.name }}</template>
            </el-table-column>
            <el-table-column label="摊位" width="180">
              <template #default="{ row }">
                <el-tag>{{ row.boothId?.code }}</el-tag>
                <span style="margin-left: 8px">{{ row.boothId?.name }}</span>
              </template>
            </el-table-column>
            <el-table-column label="验收项" width="180">
              <template #default="{ row }">
                <span>{{ row.items?.length || 0 }} 项</span>
                <el-tag v-if="getFailedCount(row) > 0" type="danger" size="small" style="margin-left: 8px">
                  {{ getFailedCount(row) }} 项未通过
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="totalDeduction" label="扣款金额" width="120">
              <template #default="{ row }">
                <span v-if="row.totalDeduction > 0" style="color: #f5222d">
                  {{ formatCurrency(row.totalDeduction) }}
                </span>
                <span v-else>-</span>
              </template>
            </el-table-column>
            <el-table-column label="是否可退押金" width="120">
              <template #default="{ row }">
                <el-tag :type="row.canRefundDeposit ? 'success' : 'danger'">
                  {{ row.canRefundDeposit ? '是' : '否' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="overallStatus" label="验收结果" width="100">
              <template #default="{ row }">
                <el-tag :type="acceptanceStatusMap[row.overallStatus]?.type">
                  {{ acceptanceStatusMap[row.overallStatus]?.label }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="inspector" label="检查人" width="100" />
            <el-table-column label="操作" width="200">
              <template #default="{ row }">
                <el-button size="small" @click="viewDetail(row)">详情</el-button>
                <el-button 
                  v-if="row.overallStatus !== 'pending'" 
                  size="small" 
                  type="success" 
                  @click="handleRefund(row)"
                >
                  办理退押
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-tab-pane>
    </el-tabs>

    <el-dialog v-model="acceptanceDialogVisible" :title="acceptanceDialogTitle" width="800px">
      <el-form :model="acceptanceForm" label-width="100px">
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="选择申请">
              <el-select 
                v-model="acceptanceForm.applicationId" 
                placeholder="请选择申请" 
                filterable 
                style="width: 100%"
                @change="onApplicationChange"
              >
                <el-option 
                  v-for="app in availableApplications" 
                  :key="app._id" 
                  :label="`${app.merchantId?.name} - ${app.boothId?.code}`" 
                  :value="app._id"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="检查人">
              <el-input v-model="acceptanceForm.inspector" placeholder="请输入检查人姓名" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-divider content-position="left">验收项目</el-divider>
        <el-table :data="acceptanceForm.items" style="margin-bottom: 16px">
          <el-table-column prop="itemName" label="验收项" width="200" />
          <el-table-column prop="category" label="分类" width="120">
            <template #default="{ row }">{{ acceptanceCategoryMap[row.category] }}</template>
          </el-table-column>
          <el-table-column label="验收结果" width="180">
            <template #default="{ row, $index }">
              <el-radio-group v-model="acceptanceForm.items[$index].status">
                <el-radio-button value="pass">通过</el-radio-button>
                <el-radio-button value="fail">未通过</el-radio-button>
                <el-radio-button value="na">不适用</el-radio-button>
              </el-radio-group>
            </template>
          </el-table-column>
          <el-table-column label="扣款金额" width="150">
            <template #default="{ row, $index }">
              <el-input-number 
                v-model="acceptanceForm.items[$index].deductionAmount" 
                :min="0" 
                :precision="2"
                :disabled="row.status !== 'fail'"
                style="width: 100%"
              >
                <template #prefix>¥</template>
              </el-input-number>
            </template>
          </el-table-column>
          <el-table-column label="备注/扣款原因">
            <template #default="{ row, $index }">
              <el-input 
                v-model="acceptanceForm.items[$index].deductionReason" 
                placeholder="请输入备注"
                :disabled="row.status !== 'fail'"
              />
            </template>
          </el-table-column>
        </el-table>
        <el-form-item label="验收结论">
          <el-input v-model="acceptanceForm.conclusion" type="textarea" :rows="2" placeholder="请输入验收结论" />
        </el-form-item>
        <el-alert
          :title="`预计扣款总金额：${formatCurrency(calculateTotalDeduction)}`"
          :type="calculateTotalDeduction > 0 ? 'warning' : 'success'"
          show-icon
          :closable="false"
        />
      </el-form>
      <template #footer>
        <el-button @click="acceptanceDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitAcceptance">提交验收</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="detailVisible" title="验收详情" width="700px">
      <div v-if="currentAcceptance">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="验收编号">{{ currentAcceptance.acceptanceNo }}</el-descriptions-item>
          <el-descriptions-item label="类型">
            {{ currentAcceptance.type === 'admission' ? '入场验收' : '撤场验收' }}
          </el-descriptions-item>
          <el-descriptions-item label="商户">{{ currentAcceptance.merchantId?.name }}</el-descriptions-item>
          <el-descriptions-item label="摊位">{{ currentAcceptance.boothId?.name }}</el-descriptions-item>
          <el-descriptions-item label="验收结果">
            <el-tag :type="acceptanceStatusMap[currentAcceptance.overallStatus]?.type">
              {{ acceptanceStatusMap[currentAcceptance.overallStatus]?.label }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="是否可退押金">
            <el-tag :type="currentAcceptance.canRefundDeposit ? 'success' : 'danger'">
              {{ currentAcceptance.canRefundDeposit ? '是' : '否' }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="扣款总金额">
            <span style="color: #f5222d; font-weight: 600">{{ formatCurrency(currentAcceptance.totalDeduction) }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="检查人">{{ currentAcceptance.inspector }}</el-descriptions-item>
          <el-descriptions-item label="验收结论" :span="2">{{ currentAcceptance.conclusion }}</el-descriptions-item>
        </el-descriptions>
        
        <el-divider content-position="left">验收项目明细</el-divider>
        <el-table :data="currentAcceptance.items" stripe>
          <el-table-column prop="itemName" label="验收项" />
          <el-table-column prop="category" label="分类" width="100">
            <template #default="{ row }">{{ acceptanceCategoryMap[row.category] }}</template>
          </el-table-column>
          <el-table-column prop="status" label="结果" width="100">
            <template #default="{ row }">
              <el-tag :type="itemStatusMap[row.status]?.type">{{ itemStatusMap[row.status]?.label }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="deductionAmount" label="扣款金额" width="120">
            <template #default="{ row }">
              <span v-if="row.deductionAmount > 0" style="color: #f5222d">{{ formatCurrency(row.deductionAmount) }}</span>
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column prop="deductionReason" label="扣款原因" show-overflow-tooltip />
        </el-table>
      </div>
      <template #footer>
        <el-button @click="detailVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { acceptanceApi, applicationApi } from '@/api';
import { 
  formatCurrency, 
  formatDateTime, 
  acceptanceStatusMap, 
  acceptanceCategoryMap,
  itemStatusMap 
} from '@/utils/format';

const activeTab = ref('admission');
const loading = ref(false);
const admissionList = ref([]);
const withdrawalList = ref([]);
const availableApplications = ref([]);
const acceptanceDialogVisible = ref(false);
const detailVisible = ref(false);
const currentAcceptance = ref(null);
const acceptanceType = ref('admission');

const acceptanceDialogTitle = computed(() => {
  return acceptanceType.value === 'admission' ? '新增入场验收' : '新增撤场验收';
});

const calculateTotalDeduction = computed(() => {
  return acceptanceForm.items
    .filter(item => item.status === 'fail')
    .reduce((sum, item) => sum + (item.deductionAmount || 0), 0);
});

const defaultAdmissionItems = [
  { itemName: '摊位设备完好', category: 'equipment', status: 'pass', deductionAmount: 0, deductionReason: '' },
  { itemName: '场地清洁', category: 'cleanliness', status: 'pass', deductionAmount: 0, deductionReason: '' },
  { itemName: '用电设备正常', category: 'electricity', status: 'pass', deductionAmount: 0, deductionReason: '' },
  { itemName: '结构安全', category: 'structure', status: 'pass', deductionAmount: 0, deductionReason: '' }
];

const defaultWithdrawalItems = [
  { itemName: '摊位设备归还完好', category: 'equipment', status: 'pass', deductionAmount: 0, deductionReason: '' },
  { itemName: '场地清洁恢复', category: 'cleanliness', status: 'pass', deductionAmount: 0, deductionReason: '' },
  { itemName: '用电设备拆除完好', category: 'electricity', status: 'pass', deductionAmount: 0, deductionReason: '' },
  { itemName: '结构安全检查', category: 'structure', status: 'pass', deductionAmount: 0, deductionReason: '' }
];

const acceptanceForm = reactive({
  applicationId: '',
  inspector: '',
  conclusion: '',
  items: []
});

const getFailedCount = (row) => {
  return row.items?.filter(item => item.status === 'fail').length || 0;
};

const loadData = async () => {
  loading.value = true;
  try {
    const [admissionRes, withdrawalRes, appRes] = await Promise.all([
      acceptanceApi.getAll({ type: 'admission' }),
      acceptanceApi.getAll({ type: 'withdrawal' }),
      applicationApi.getAll({ status: activeTab.value === 'admission' ? 'in_progress' : 'in_progress' })
    ]);
    admissionList.value = admissionRes.data;
    withdrawalList.value = withdrawalRes.data;
    availableApplications.value = appRes.data;
  } catch (error) {
    console.error('加载数据失败:', error);
  } finally {
    loading.value = false;
  }
};

const onApplicationChange = () => {
};

const openAdmissionDialog = () => {
  acceptanceType.value = 'admission';
  acceptanceForm.applicationId = '';
  acceptanceForm.inspector = '';
  acceptanceForm.conclusion = '';
  acceptanceForm.items = JSON.parse(JSON.stringify(defaultAdmissionItems));
  acceptanceDialogVisible.value = true;
};

const openWithdrawalDialog = () => {
  acceptanceType.value = 'withdrawal';
  acceptanceForm.applicationId = '';
  acceptanceForm.inspector = '';
  acceptanceForm.conclusion = '';
  acceptanceForm.items = JSON.parse(JSON.stringify(defaultWithdrawalItems));
  acceptanceDialogVisible.value = true;
};

const submitAcceptance = async () => {
  try {
    if (!acceptanceForm.applicationId) {
      ElMessage.warning('请选择申请');
      return;
    }
    
    const failedItems = acceptanceForm.items.filter(item => item.status === 'fail');
    const totalDeduction = failedItems.reduce((sum, item) => sum + (item.deductionAmount || 0), 0);
    
    const submitData = {
      applicationId: acceptanceForm.applicationId,
      inspector: acceptanceForm.inspector || '系统管理员',
      conclusion: acceptanceForm.conclusion,
      items: acceptanceForm.items
    };
    
    let res;
    if (acceptanceType.value === 'admission') {
      res = await acceptanceApi.createAdmission(submitData);
    } else {
      res = await acceptanceApi.createWithdrawal(submitData);
    }
    
    ElMessage.success(res.message);
    acceptanceDialogVisible.value = false;
    loadData();
  } catch (error) {
    console.error('提交失败:', error);
  }
};

const viewDetail = async (row) => {
  try {
    const res = await acceptanceApi.getById(row._id);
    currentAcceptance.value = res.data;
    detailVisible.value = true;
  } catch (error) {
    console.error('获取详情失败:', error);
  }
};

const handleRefund = async (row) => {
  try {
    await ElMessageBox.confirm(
      `确定为商户办理押金退还吗？\n\n预计扣款: ${formatCurrency(row.totalDeduction)} 元`,
      '办理押金退还',
      {
        type: 'warning',
        confirmButtonText: '确认退押',
        cancelButtonText: '取消'
      }
    );
    
    const res = await acceptanceApi.refundDeposit({
      acceptanceId: row._id,
      operator: '系统管理员'
    });
    
    ElMessage.success(res.message);
    loadData();
  } catch (error) {
    if (error !== 'cancel') {
      console.error('退押失败:', error);
    }
  }
};

onMounted(() => {
  loadData();
});
</script>

<style scoped>
.acceptance-page {
  height: 100%;
}
</style>