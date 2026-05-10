<template>
  <div class="replenishment-page">
    <el-row :gutter="20">
      <el-col :span="10">
        <el-card>
          <template #header>
            <span>新建补货申请</span>
          </template>
          
          <el-form :model="form" label-width="100px">
            <el-form-item label="申请科室">
              <el-select v-model="form.departmentId" placeholder="请选择科室" style="width: 100%;">
                <el-option v-for="d in departments" :key="d.id" :label="d.name" :value="d.id" />
              </el-select>
            </el-form-item>
            
            <el-form-item label="选择耗材">
              <el-select
                v-model="form.materialId"
                placeholder="请选择耗材"
                style="width: 100%;"
                filterable
                @change="onMaterialChange"
              >
                <el-option-group
                  v-for="group in materialGroups"
                  :key="group.label"
                  :label="group.label"
                >
                  <el-option
                    v-for="m in group.options"
                    :key="m.id"
                    :label="`${m.name} (库存:${m.current_stock}${m.unit})`"
                    :value="m.id"
                    :disabled="m.current_stock >= m.min_stock"
                  />
                </el-option-group>
              </el-select>
            </el-form-item>

            <el-alert
              v-if="selectedMaterial"
              :title="selectedMaterial.current_stock < selectedMaterial.min_stock ? '该耗材库存不足，建议补货' : '该耗材库存充足'"
              :type="selectedMaterial.current_stock < selectedMaterial.min_stock ? 'warning' : 'info'"
              show-icon
              :closable="false"
              style="margin-bottom: 15px;"
            />
            
            <el-form-item label="申请数量">
              <el-input-number
                v-model="form.requestedQuantity"
                :min="1"
                :max="9999"
              />
              <span style="margin-left: 10px; color: #909399;">{{ selectedMaterial?.unit || '' }}</span>
            </el-form-item>
            
            <el-form-item label="申请原因">
              <el-input
                v-model="form.reason"
                type="textarea"
                :rows="3"
                placeholder="请说明补货原因"
              />
            </el-form-item>
            
            <el-form-item>
              <el-button
                type="primary"
                @click="submitRequest"
                :loading="submitting"
              >
                提交申请
              </el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </el-col>

      <el-col :span="14">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>我的申请</span>
              <div>
                <el-tag
                  v-for="(count, status) in statusCounts"
                  :key="status"
                  :type="getStatusTagType(status)"
                  style="margin-left: 10px;"
                  size="small"
                >
                  {{ getStatusLabel(status) }}: {{ count }}
                </el-tag>
              </div>
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
            <el-table-column label="操作" width="100">
              <template #default="{ row }">
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
      </el-col>
    </el-row>

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
          <el-descriptions-item label="耗材">
            {{ currentRequest.material_name }} ({{ currentRequest.material_code }})
          </el-descriptions-item>
          <el-descriptions-item label="科室">{{ currentRequest.department_name }}</el-descriptions-item>
          <el-descriptions-item label="申请人">{{ currentRequest.requester }}</el-descriptions-item>
          <el-descriptions-item label="申请数量">{{ currentRequest.requested_quantity }}{{ currentRequest.unit }}</el-descriptions-item>
          <el-descriptions-item label="审核数量">
            {{ currentRequest.approved_quantity || '-' }}{{ currentRequest.approved_quantity ? currentRequest.unit : '' }}
          </el-descriptions-item>
          <el-descriptions-item label="当前库存">{{ currentRequest.current_stock }}{{ currentRequest.unit }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag
              :style="{ backgroundColor: currentRequest.status_color + '20', color: currentRequest.status_color, borderColor: currentRequest.status_color }"
              size="small"
            >
              {{ currentRequest.status_label }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="申请原因" :span="2">{{ currentRequest.reason || '-' }}</el-descriptions-item>
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
              <el-tag :type="h.action === 'REJECT' ? 'danger' : 'success'" size="small">
                {{ h.action_label }}
              </el-tag>
              <span style="margin-left: 10px;">{{ h.auditor }}</span>
              <div v-if="h.approved_quantity" style="margin-top: 5px;">
                审核数量: {{ h.approved_quantity }}{{ currentRequest.unit }}
              </div>
              <div v-if="h.comments" style="margin-top: 5px; color: #606266;">
                备注: {{ h.comments }}
              </div>
            </el-card>
          </el-timeline-item>
          <el-timeline-item :timestamp="currentRequest.created_at" placement="top" type="primary">
            <el-card shadow="never" style="border: 1px solid #ebeef5;">
              <el-tag type="info" size="small">创建申请</el-tag>
              <span style="margin-left: 10px;">{{ currentRequest.requester }}</span>
            </el-card>
          </el-timeline-item>
        </el-timeline>

        <el-divider content-position="left" v-if="currentRequest.stock_history?.length">库存变动</el-divider>
        <el-table
          v-if="currentRequest.stock_history?.length"
          :data="currentRequest.stock_history"
          stripe
          size="small"
        >
          <el-table-column label="类型" width="120">
            <template #default="{ row }">
              <el-tag :type="row.change_quantity > 0 ? 'success' : 'danger'" size="small">
                {{ row.change_quantity > 0 ? '入库' : '出库' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="变更" width="100">
            <template #default="{ row }">
              <span :style="{ color: row.change_quantity > 0 ? '#67c23a' : '#f56c6c' }">
                {{ row.change_quantity > 0 ? '+' : '' }}{{ row.change_quantity }}
              </span>
            </template>
          </el-table-column>
          <el-table-column label="变更后" width="100">
            <template #default="{ row }">{{ row.after_quantity }}</template>
          </el-table-column>
          <el-table-column prop="operator" label="操作人" width="100" />
          <el-table-column prop="created_at" label="时间" width="180" />
        </el-table>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { replenishmentApi, departmentApi, materialApi } from '../api';

const props = defineProps(['operator']);

const departments = ref([]);
const materials = ref([]);
const requests = ref([]);
const statusCounts = ref({});
const selectedMaterial = ref(null);
const currentRequest = ref(null);
const detailDialogVisible = ref(false);
const submitting = ref(false);

const form = ref({
  departmentId: null,
  materialId: null,
  requestedQuantity: 10,
  reason: ''
});

const materialGroups = computed(() => {
  const lowStock = [];
  const normal = [];
  
  materials.value.forEach(m => {
    if (m.current_stock < m.min_stock) {
      lowStock.push(m);
    } else {
      normal.push(m);
    }
  });
  
  return [
    { label: '库存不足（建议优先）', options: lowStock },
    { label: '库存正常', options: normal }
  ];
});

function getStatusTagType(status) {
  const map = { PENDING: 'warning', APPROVED: 'success', REJECTED: 'danger', FULFILLED: 'primary' };
  return map[status] || 'info';
}

function getStatusLabel(status) {
  const map = { PENDING: '待审核', APPROVED: '已通过', REJECTED: '已拒绝', FULFILLED: '已补货' };
  return map[status] || status;
}

function getCurrentStep(status) {
  const map = { PENDING: 0, APPROVED: 1, REJECTED: 1, FULFILLED: 2 };
  return map[status] || 0;
}

async function loadDepartments() {
  try {
    const res = await departmentApi.list();
    departments.value = res.data;
    if (departments.value.length > 0) {
      form.value.departmentId = departments.value[0].id;
    }
  } catch (error) {
    ElMessage.error(error.message);
  }
}

async function loadMaterials() {
  try {
    const res = await materialApi.list();
    materials.value = res.data;
  } catch (error) {
    ElMessage.error(error.message);
  }
}

async function loadRequests() {
  try {
    const [reqRes, countRes] = await Promise.all([
      replenishmentApi.list(),
      replenishmentApi.getStatusCounts()
    ]);
    requests.value = reqRes.data;
    statusCounts.value = countRes.data;
  } catch (error) {
    ElMessage.error(error.message);
  }
}

function onMaterialChange(materialId) {
  if (materialId) {
    selectedMaterial.value = materials.value.find(m => m.id === materialId);
    if (selectedMaterial.value) {
      const suggestedQty = Math.max(
        selectedMaterial.value.min_stock - selectedMaterial.value.current_stock,
        10
      );
      form.value.requestedQuantity = suggestedQty;
      if (selectedMaterial.value.current_stock < selectedMaterial.value.min_stock) {
        form.value.reason = `库存不足，当前${selectedMaterial.value.current_stock}${selectedMaterial.value.unit}，预警值${selectedMaterial.value.min_stock}${selectedMaterial.value.unit}`;
      }
    }
  } else {
    selectedMaterial.value = null;
  }
}

async function submitRequest() {
  if (!form.value.departmentId || !form.value.materialId || !form.value.requestedQuantity) {
    ElMessage.warning('请完善申请信息');
    return;
  }
  
  submitting.value = true;
  try {
    const res = await replenishmentApi.create({
      ...form.value,
      requester: props.operator
    });
    ElMessage.success(res.message || '申请已提交');
    loadRequests();
    form.value.requestedQuantity = 10;
    form.value.reason = '';
    form.value.materialId = null;
    selectedMaterial.value = null;
  } catch (error) {
    ElMessage.error(error.message);
  } finally {
    submitting.value = false;
  }
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

onMounted(() => {
  loadDepartments();
  loadMaterials();
  loadRequests();
  
  const preMaterial = localStorage.getItem('preSelectMaterial');
  const preQuantity = localStorage.getItem('preQuantity');
  if (preMaterial) {
    form.value.materialId = parseInt(preMaterial);
    if (preQuantity) form.value.requestedQuantity = parseInt(preQuantity);
    localStorage.removeItem('preSelectMaterial');
    localStorage.removeItem('preQuantity');
  }
});

watch(() => form.value.materialId, onMaterialChange);
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
