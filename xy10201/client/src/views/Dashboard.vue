<template>
  <div class="dashboard">
    <el-row :gutter="20" class="stats-row">
      <el-col :span="6" v-for="stat in statsCards" :key="stat.key">
        <el-card class="stat-card" :body-style="{ padding: '20px' }">
          <div class="stat-content">
            <div class="stat-info">
              <div class="stat-label">{{ stat.label }}</div>
              <div class="stat-value" :style="{ color: stat.color }">{{ stat.value }}</div>
            </div>
            <el-icon :size="40" :color="stat.color">
              <component :is="stat.icon" />
            </el-icon>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20">
      <el-col :span="24">
        <el-card class="flow-card">
          <template #header>
            <div class="card-header">
              <span><el-icon><Odometer /></el-icon> 业务流程状态</span>
              <el-tag :type="flowStatusTagType" size="small">
                {{ overallStatusLabel }}
              </el-tag>
            </div>
          </template>
          <el-steps :active="currentStep" finish-status="success" simple>
            <el-step
              v-for="(stage, index) in flowStages"
              :key="stage.stage"
              :title="stage.name"
              :description="stage.message"
              :status="getStepStatus(stage.status)"
            />
          </el-steps>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" style="margin-top: 20px;">
      <el-col :span="12">
        <el-card>
          <template #header>
            <div class="card-header">
              <span><el-icon><Warning /></el-icon> 当前卡点</span>
              <el-badge :value="blockages.length" class="item" :max="99" />
            </div>
          </template>
          <el-empty v-if="blockages.length === 0" description="暂无卡点，业务流程顺畅" />
          <el-timeline v-else>
            <el-timeline-item
              v-for="b in blockages"
              :key="b.id"
              :timestamp="b.created_at"
              placement="top"
              :type="getBlockageType(b.severity)"
              :hollow="true"
            >
              <el-card shadow="hover" class="blockage-card">
                <div class="blockage-header">
                  <el-tag :type="getSeverityTagType(b.severity)" size="small">
                    {{ b.type_label }}
                  </el-tag>
                  <span class="blockage-title">{{ b.title }}</span>
                </div>
                <p class="blockage-desc">{{ b.description }}</p>
                <div class="blockage-actions">
                  <el-button
                    v-if="b.type === 'STOCK_SHORTAGE'"
                    type="primary"
                    size="small"
                    @click="goToReplenishment(b.context.material_id)"
                  >
                    申请补货
                  </el-button>
                  <el-button
                    v-if="b.type === 'AUDIT_PENDING'"
                    type="primary"
                    size="small"
                    @click="$router.push('/audit')"
                  >
                    去审核
                  </el-button>
                </div>
              </el-card>
            </el-timeline-item>
          </el-timeline>
        </el-card>
      </el-col>

      <el-col :span="12">
        <el-card>
          <template #header>
            <div class="card-header">
              <span><el-icon><Lightbulb /></el-icon> 处理建议</span>
            </div>
          </template>
          <el-empty v-if="suggestions.length === 0" description="暂无建议" />
          <div v-else class="suggestion-list">
            <el-alert
              v-for="(s, idx) in suggestions"
              :key="idx"
              :title="s.title"
              :type="getSuggestionType(s.priority)"
              :closable="false"
              show-icon
            >
              <template #default>
                {{ s.message }}
                <div v-if="s.details" class="suggestion-details">
                  <el-tag
                    v-for="d in s.details.slice(0, 3)"
                    :key="d.material_id"
                    size="small"
                    type="info"
                    style="margin-right: 5px;"
                  >
                    {{ d.material_name }} 缺{{ d.shortage }}
                  </el-tag>
                </div>
              </template>
            </el-alert>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" style="margin-top: 20px;">
      <el-col :span="24">
        <el-card>
          <template #header>
            <div class="card-header">
              <span><el-icon><Clock /></el-icon> 最近操作历史</span>
              <el-button text @click="$router.push('/history')">查看全部</el-button>
            </div>
          </template>
          <el-table :data="history" stripe style="width: 100%">
            <el-table-column prop="type_label" label="类型" width="100">
              <template #default="{ row }">
                <el-tag :type="row.type === 'CONSUMPTION' ? 'warning' : 'primary'" size="small">
                  {{ row.type_label }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="title" label="内容" />
            <el-table-column prop="subtitle" label="关联" width="200" />
            <el-table-column prop="operator" label="操作人" width="100" />
            <el-table-column prop="detail" label="详情" />
            <el-table-column label="状态" width="120" v-if="history.some(h => h.status)">
              <template #default="{ row }">
                <el-tag
                  v-if="row.status_label"
                  :style="{ backgroundColor: row.status_color + '20', color: row.status_color, borderColor: row.status_color }"
                  size="small"
                >
                  {{ row.status_label }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="created_at" label="时间" width="180" />
          </el-table>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { dashboardApi } from '../api';

const props = defineProps(['operator']);

const stats = ref({});
const flowStatus = ref(null);
const blockages = ref([]);
const suggestions = ref([]);
const history = ref([]);

const statsCards = computed(() => [
  {
    key: 'total_materials',
    label: '耗材总数',
    value: stats.value.total_materials || 0,
    icon: 'Box',
    color: '#409eff'
  },
  {
    key: 'low_stock',
    label: '库存不足',
    value: `${stats.value.low_stock_count || 0}/${stats.value.out_of_stock_count || 0}`,
    icon: 'Warning',
    color: '#f56c6c'
  },
  {
    key: 'treatments',
    label: '活跃诊疗项目',
    value: stats.value.total_treatments || 0,
    icon: 'List',
    color: '#67c23a'
  },
  {
    key: 'pending',
    label: '待处理申请',
    value: stats.value.pending_requests || 0,
    icon: 'Document',
    color: '#e6a23c'
  }
]);

const overallStatusLabel = computed(() => {
  const map = { NORMAL: '正常', WARNING: '警告', CRITICAL: '严重' };
  return map[flowStatus.value?.overall_status] || '正常';
});

const flowStatusTagType = computed(() => {
  const map = { NORMAL: 'success', WARNING: 'warning', CRITICAL: 'danger' };
  return map[flowStatus.value?.overall_status] || 'info';
});

const flowStages = computed(() => flowStatus.value?.stages || []);

const currentStep = computed(() => {
  const stages = flowStages.value;
  for (let i = stages.length - 1; i >= 0; i--) {
    if (stages[i].status === 'NORMAL') return i;
  }
  return 0;
});

function getStepStatus(status) {
  const map = { NORMAL: 'success', WARNING: 'process', CRITICAL: 'error' };
  return map[status] || '';
}

function getBlockageType(severity) {
  const map = { CRITICAL: 'danger', WARNING: 'warning', MEDIUM: 'primary' };
  return map[severity] || 'info';
}

function getSeverityTagType(severity) {
  const map = { CRITICAL: 'danger', WARNING: 'warning', MEDIUM: 'info' };
  return map[severity] || 'info';
}

function getSuggestionType(priority) {
  const map = { HIGH: 'error', MEDIUM: 'warning', LOW: 'info' };
  return map[priority] || 'info';
}

function goToReplenishment(materialId) {
  if (materialId) {
    localStorage.setItem('preSelectMaterial', materialId);
  }
  props.$router?.push('/replenishment');
}

async function loadData() {
  try {
    const [statsRes, flowRes, historyRes] = await Promise.all([
      dashboardApi.getStats(),
      dashboardApi.getFlowStatus(),
      dashboardApi.getHistory(15)
    ]);
    stats.value = statsRes.data;
    flowStatus.value = flowRes.data;
    blockages.value = flowRes.data.blockages || [];
    suggestions.value = flowRes.data.suggestions || [];
    history.value = historyRes.data;
  } catch (error) {
    ElMessage.error(error.message);
  }
}

onMounted(() => {
  loadData();
});
</script>

<style scoped>
.stats-row {
  margin-bottom: 20px;
}

.stat-card {
  border: none;
  border-radius: 8px;
}

.stat-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.stat-label {
  color: #909399;
  font-size: 14px;
  margin-bottom: 8px;
}

.stat-value {
  font-size: 32px;
  font-weight: 600;
}

.flow-card {
  border: none;
  border-radius: 8px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 600;
}

.blockage-card {
  margin-bottom: 10px;
}

.blockage-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}

.blockage-title {
  font-weight: 600;
}

.blockage-desc {
  color: #606266;
  margin: 0 0 10px 0;
  font-size: 13px;
}

.blockage-actions {
  text-align: right;
}

.suggestion-list :deep(.el-alert) {
  margin-bottom: 10px;
}

.suggestion-details {
  margin-top: 8px;
}
</style>
