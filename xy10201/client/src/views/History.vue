<template>
  <div class="history-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <el-radio-group v-model="activeTab">
            <el-radio-button label="consumption">消耗记录</el-radio-button>
            <el-radio-button label="replenishment">补货申请</el-radio-button>
            <el-radio-button label="logs">操作日志</el-radio-button>
          </el-radio-group>
        </div>
      </template>

      <el-table v-if="activeTab === 'consumption'" :data="consumptionRecords" stripe>
        <el-table-column label="类型" width="100">
          <template #default="{ row }">
            <el-tag :type="row.consumption_type === 'TREATMENT' ? 'primary' : 'info'" size="small">
              {{ row.consumption_type === 'TREATMENT' ? '诊疗消耗' : '手动消耗' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="department_name" label="科室" width="100" />
        <el-table-column prop="treatment_name" label="诊疗项目" width="120">
          <template #default="{ row }">{{ row.treatment_name || '-' }}</template>
        </el-table-column>
        <el-table-column prop="material_name" label="耗材" />
        <el-table-column label="数量" width="100">
          <template #default="{ row }">
            <span style="color: #f56c6c;">-{{ row.quantity }}{{ row.unit }}</span>
          </template>
        </el-table-column>
        <el-table-column label="金额" width="100">
          <template #default="{ row }">¥{{ row.total_amount.toFixed(2) }}</template>
        </el-table-column>
        <el-table-column prop="patient_name" label="患者" width="100">
          <template #default="{ row }">{{ row.patient_name || '-' }}</template>
        </el-table-column>
        <el-table-column prop="operator" label="操作人" width="100" />
        <el-table-column prop="created_at" label="时间" width="180" />
      </el-table>

      <el-table v-if="activeTab === 'replenishment'" :data="replenishmentRecords" stripe>
        <el-table-column prop="request_no" label="申请单号" width="180" />
        <el-table-column prop="material_name" label="耗材" />
        <el-table-column label="申请数量" width="120">
          <template #default="{ row }">{{ row.requested_quantity }}{{ row.unit }}</template>
        </el-table-column>
        <el-table-column label="审核数量" width="120">
          <template #default="{ row }">
            {{ row.approved_quantity || '-' }}{{ row.approved_quantity ? row.unit : '' }}
          </template>
        </el-table-column>
        <el-table-column prop="department_name" label="科室" width="100" />
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
      </el-table>

      <el-table v-if="activeTab === 'logs'" :data="operationLogs" stripe>
        <el-table-column prop="module" label="模块" width="120">
          <template #default="{ row }">
            <el-tag size="small">{{ getModuleLabel(row.module) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="action" label="操作" width="100" />
        <el-table-column prop="target_type" label="目标类型" width="120" />
        <el-table-column prop="target_id" label="目标ID" width="80" />
        <el-table-column label="变更前" min-width="200">
          <template #default="{ row }">
            <el-tooltip v-if="row.before_data" :content="JSON.stringify(JSON.parse(row.before_data), null, 2)" placement="top">
              <code class="json-preview">{{ truncateJson(row.before_data) }}</code>
            </el-tooltip>
            <span v-else style="color: #909399;">-</span>
          </template>
        </el-table-column>
        <el-table-column label="变更后" min-width="200">
          <template #default="{ row }">
            <el-tooltip v-if="row.after_data" :content="JSON.stringify(JSON.parse(row.after_data), null, 2)" placement="top">
              <code class="json-preview">{{ truncateJson(row.after_data) }}</code>
            </el-tooltip>
            <span v-else style="color: #909399;">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="operator" label="操作人" width="100" />
        <el-table-column prop="created_at" label="时间" width="180" />
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { consumptionApi, replenishmentApi, dashboardApi } from '../api';

const activeTab = ref('consumption');
const consumptionRecords = ref([]);
const replenishmentRecords = ref([]);
const operationLogs = ref([]);

function getModuleLabel(module) {
  const map = {
    MATERIAL: '耗材管理',
    TREATMENT: '诊疗项目',
    CONSUMPTION: '耗材消耗',
    REPLENISHMENT: '补货申请',
    INVENTORY: '库存调整'
  };
  return map[module] || module;
}

function truncateJson(jsonStr) {
  try {
    const obj = JSON.parse(jsonStr);
    return JSON.stringify(obj).slice(0, 50) + '...';
  } catch {
    return jsonStr;
  }
}

async function loadConsumption() {
  try {
    const res = await consumptionApi.getRecords({ limit: 50 });
    consumptionRecords.value = res.data;
  } catch (error) {
    ElMessage.error(error.message);
  }
}

async function loadReplenishment() {
  try {
    const res = await replenishmentApi.list({ limit: 50 });
    replenishmentRecords.value = res.data;
  } catch (error) {
    ElMessage.error(error.message);
  }
}

async function loadLogs() {
  try {
    const res = await dashboardApi.getLogs({ limit: 50 });
    operationLogs.value = res.data;
  } catch (error) {
    ElMessage.error(error.message);
  }
}

watch(activeTab, (tab) => {
  if (tab === 'consumption' && consumptionRecords.value.length === 0) loadConsumption();
  if (tab === 'replenishment' && replenishmentRecords.value.length === 0) loadReplenishment();
  if (tab === 'logs' && operationLogs.value.length === 0) loadLogs();
});

onMounted(() => {
  loadConsumption();
});
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: flex-start;
  align-items: center;
}

.json-preview {
  font-size: 12px;
  color: #606266;
  background: #f5f7fa;
  padding: 2px 6px;
  border-radius: 4px;
  cursor: pointer;
}
</style>
