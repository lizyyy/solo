<template>
  <div class="audit-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <el-radio-group v-model="activeTab" @change="loadRequests">
            <el-radio-button label="PENDING">待审核 ({{ counts.PENDING || 0 }})</el-radio-button>
            <el-radio-button label="APPROVED">已通过 ({{ counts.APPROVED || 0 }})</el-radio-button>
            <el-radio-button label="FULFILLED">已补货 ({{ counts.FULFILLED || 0 }})</el-radio-button>
            <el-radio-button label="REJECTED">已拒绝 ({{ counts.REJECTED || 0 }})</el-radio-button>
          </el-radio-group>
        </div>
      </template>

      <el-table :data="requests" stripe>
        <el-table-column prop="request_no" label="申请单号" width="180" />
        <el-table-column prop="material_name" label="耗材" />
        <el-table-column label="申请数量" width="120">
          <template #default="{ row }">
            {{ row.requested_quantity }}{{ row.unit }}
          </template>
        </el-table-column>
        <el-table-column label="审核数量" width="120">
          <template #default="{ row }">
            {{ row.approved_quantity || '-' }}{{ row.approved_quantity ? row.unit : '' }}
          </template>
        </el-table-column>
        <el-table-column prop="department_name" label="科室" width="120" />
        <el-table-column prop="requester" label="申请人" width="100" />
        <el-table-column label="状态" width="120">
          <template #default="{ row }">
            <el-tag
              :style="{ backgroundColor: row.status_color + '20', color: row.status_color, borderColor: row.status_color }"
              size="small"
            >
              {{ row.status_label }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="申请时间" width="180" />
        <el-table-column label="操作" width="250">
          <template #default="{ row }">
            <el-button
              v-if="row.status === 'PENDING'"
              type="success"
              link
              size="small"
              @click="openApproveDialog(row)"
            >
              通过
            </el-button>
            <el-button
              v-if="row.status === 'PENDING'"
              type="danger"
              link
              size="small"
              @click="openRejectDialog(row)"
            >
              拒绝
            </el-button>
            <el-button
              v-if="row.status === 'APPROVED'"
              type="primary"
              link
              size="small"
              @click="openFulfillDialog(row)"
            >
              确认补货
            </el-button>
            <el-button
              type="primary"
              link
              size="small"
              @click="viewDetail(row)"
            >
              详情
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="approveDialogVisible" title="审核通过" width="500px">
      <el-form v-if="currentRequest" label-width="100px">
        <el-form-item label="耗材">
          <span>{{ currentRequest.material_name }}</span>
        </el-form-item>
        <el-form-item label="申请数量">
          <span>{{ currentRequest.requested_quantity }}{{ currentRequest.unit }}</span>
        </el-form-item>
        <el-form-item label="当前库存">
          <span :style="{ color: currentRequest.current_stock < currentRequest.min_stock ? '#f56c6c' : '' }">
            {{ currentRequest.current_stock }}{{ currentRequest.unit }}
          </span>
          <span style="margin-left: 10px; color: #909399;">
            (预警值: {{ currentRequest.min_stock }})
          </span>
        </el-form-item>
        <el-form-item label="审核数量">
          <el-input-number
            v-model="approveForm.approvedQuantity"
            :min="1"
            :max="currentRequest.requested_quantity"
          />
          <span style="margin-left: 10px; color: #909399;">{{ currentRequest.unit }}</span>
        </el-form-item>
        <el-form-item label="审核意见">
          <el-input
            v-model="approveForm.comments"
            type="textarea"
            :rows="2"
            placeholder="可选"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="approveDialogVisible = false">取消</el-button>
        <el-button type="success" @click="submitApprove" :loading="processing">确认通过</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="rejectDialogVisible" title="审核拒绝" width="450px">
      <el-form v-if="currentRequest" label-width="100px">
        <el-form-item label="耗材">
          <span>{{ currentRequest.material_name }}</span>
        </el-form-item>
        <el-form-item label="申请数量">
          <span>{{ currentRequest.requested_quantity }}{{ currentRequest.unit }}</span>
        </el-form-item>
        <el-form-item label="拒绝原因" required>
          <el-input
            v-model="rejectForm.comments"
            type="textarea"
            :rows="3"
            placeholder="请说明拒绝原因"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="rejectDialogVisible = false">取消</el-button>
        <el-button type="danger" @click="submitReject" :loading="processing">确认拒绝</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="fulfillDialogVisible" title="确认补货" width="450px">
      <el-form v-if="currentRequest" label-width="100px">
        <el-form-item label="耗材">
          <span>{{ currentRequest.material_name }}</span>
        </el-form-item>
        <el-form-item label="补货数量">
          <el-tag type="success" size="large">
            {{ currentRequest.approved_quantity || currentRequest.requested_quantity }}{{ currentRequest.unit }}
          </el-tag>
        </el-form-item>
        <el-form-item label="备注">
          <el-input
            v-model="fulfillForm.comments"
            type="textarea"
            :rows="2"
            placeholder="可选"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="fulfillDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitFulfill" :loading="processing">确认补货</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="detailDialogVisible" title="申请详情" width="700px">
      <div v-if="currentRequest">
        <el-steps :active="getCurrentStep(currentRequest.status)" simple style="margin-bottom: 20px;">
          <el-step title="待审核" :status="currentRequest.status === 'PENDING' ? 'process' : 'success'" />
          <el-step
            title="已审核"
            :status="['APPROVED', 'FULFILLED'].includes(currentRequest.status) ? 'success' : currentRequest.status === 'REJECTED' ? 'error' : ''"
          />
          <el-step
            title="已补货"
            :status="currentRequest.status === 'FULFILLED' ? 'success' : ''"
          />
        </el-steps>

        <el-descriptions :column="2" border style="margin-bottom: 20px;">
          <el-descriptions-item label="申请单号">{{ currentRequest.request_no }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag
              :style="{ backgroundColor: currentRequest.status_color + '20', color: currentRequest.status_color, borderColor: currentRequest.status_color }"
              size="small"
            >
              {{ currentRequest.status_label }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="耗材">{{ currentRequest.material_name }}</el-descriptions-item>
          <el-descriptions-item label="科室">{{ currentRequest.department_name }}</el-descriptions-item>
          <el-descriptions-item label="申请数量">{{ currentRequest.requested_quantity }}{{ currentRequest.unit }}</el-descriptions-item>
          <el-descriptions-item label="审核数量">
            {{ currentRequest.approved_quantity || '-' }}{{ currentRequest.approved_quantity ? currentRequest.unit : '' }}
          </el-descriptions-item>
        </el-descriptions>

        <el-divider content-position="left">审核历史</el-divider>
        <el-timeline>
          <el-timeline-item
            v-for="(h, idx) in currentRequest.audit_history"
            :key="idx"
            :timestamp="h.created_at"
            placement="top"
          >
            <el-card shadow="never" style="border: 1px solid #ebeef5;">
              <el-tag :type="h.action === 'REJECT' ? 'danger' : h.action === 'FULFILL' ? 'primary' : 'success'" size="small">
                {{ h.action_label }}
              </el-tag>
              <span style="margin-left: 10px;">{{ h.auditor }}</span>
              <div v-if="h.approved_quantity" style="margin-top: 5px;">
                数量: {{ h.approved_quantity }}{{ currentRequest.unit }}
              </div>
              <div v-if="h.comments" style="margin-top: 5px; color: #606266;">
                备注: {{ h.comments }}
              </div>
            </el-card>
          </el-timeline-item>
        </el-timeline>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { replenishmentApi } from '../api';

const props = defineProps(['operator']);

const activeTab = ref('PENDING');
const requests = ref([]);
const counts = ref({});
const currentRequest = ref(null);
const approveDialogVisible = ref(false);
const rejectDialogVisible = ref(false);
const fulfillDialogVisible = ref(false);
const detailDialogVisible = ref(false);
const processing = ref(false);

const approveForm = ref({ approvedQuantity: 0, comments: '' });
const rejectForm = ref({ comments: '' });
const fulfillForm = ref({ comments: '' });

function getCurrentStep(status) {
  const map = { PENDING: 0, APPROVED: 1, REJECTED: 1, FULFILLED: 2 };
  return map[status] || 0;
}

async function loadRequests() {
  try {
    const [reqRes, countRes] = await Promise.all([
      replenishmentApi.list({ status: activeTab.value }),
      replenishmentApi.getStatusCounts()
    ]);
    requests.value = reqRes.data;
    counts.value = countRes.data;
  } catch (error) {
    ElMessage.error(error.message);
  }
}

function openApproveDialog(row) {
  currentRequest.value = row;
  approveForm.value = {
    approvedQuantity: row.requested_quantity,
    comments: ''
  };
  approveDialogVisible.value = true;
}

function openRejectDialog(row) {
  currentRequest.value = row;
  rejectForm.value = { comments: '' };
  rejectDialogVisible.value = true;
}

function openFulfillDialog(row) {
  currentRequest.value = row;
  fulfillForm.value = { comments: '' };
  fulfillDialogVisible.value = true;
}

async function viewDetail(row) {
  try {
    const res = await replenishmentApi.get(row.id);
    currentRequest.value = res.data;
    detailDialogVisible.value = true;
  } catch (error) {
    ElMessage.error(error.message);
  }
}

async function submitApprove() {
  processing.value = true;
  try {
    const res = await replenishmentApi.approve(currentRequest.value.id, {
      auditor: props.operator,
      approvedQuantity: approveForm.value.approvedQuantity,
      comments: approveForm.value.comments
    });
    ElMessage.success(res.message || '审核通过');
    approveDialogVisible.value = false;
    loadRequests();
  } catch (error) {
    ElMessage.error(error.message);
  } finally {
    processing.value = false;
  }
}

async function submitReject() {
  if (!rejectForm.value.comments.trim()) {
    ElMessage.warning('请填写拒绝原因');
    return;
  }
  
  processing.value = true;
  try {
    const res = await replenishmentApi.reject(currentRequest.value.id, {
      auditor: props.operator,
      comments: rejectForm.value.comments
    });
    ElMessage.success(res.message || '已拒绝');
    rejectDialogVisible.value = false;
    loadRequests();
  } catch (error) {
    ElMessage.error(error.message);
  } finally {
    processing.value = false;
  }
}

async function submitFulfill() {
  processing.value = true;
  try {
    const res = await replenishmentApi.fulfill(currentRequest.value.id, {
      operator: props.operator,
      comments: fulfillForm.value.comments
    });
    ElMessage.success(res.message || '补货完成');
    fulfillDialogVisible.value = false;
    loadRequests();
  } catch (error) {
    ElMessage.error(error.message);
  } finally {
    processing.value = false;
  }
}

onMounted(() => {
  loadRequests();
});
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
