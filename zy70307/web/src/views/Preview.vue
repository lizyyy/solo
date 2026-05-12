<template>
  <div>
    <div class="page-header">
      <h2>策略预演</h2>
      <div class="page-actions">
        <el-button @click="loadSampleRequests">
          <el-icon><DocumentCopy /></el-icon>
          加载样本请求
        </el-button>
        <el-button type="primary" @click="runPreview" :loading="previewLoading">
          <el-icon><VideoPlay /></el-icon>
          执行预演
        </el-button>
      </div>
    </div>

    <el-row :gutter="20">
      <el-col :span="8">
        <div class="page-card">
          <h3 style="margin-bottom: 16px;">选择规则</h3>
          <div style="max-height: 400px; overflow-y: auto;">
            <div v-if="allRules.length === 0" style="text-align: center; padding: 40px; color: #909399;">
              暂无可用规则
            </div>
            <div
              v-for="rule in allRules"
              :key="rule.id"
              class="rule-card"
              :class="{ 'is-selected': selectedRuleIds.includes(rule.id) }"
              @click="toggleRule(rule.id)"
              style="cursor: pointer;"
            >
              <div class="rule-header">
                <div style="display: flex; align-items: center;">
                  <el-checkbox
                    :model-value="selectedRuleIds.includes(rule.id)"
                    :label="rule.id"
                    @click.stop
                    @change="toggleRule(rule.id)"
                  />
                  <span class="rule-name" style="margin-left: 8px;">{{ rule.name }}</span>
                </div>
                <el-tag size="small">{{ rule.priority }}</el-tag>
              </div>
              <div class="rule-meta">
                <span>{{ rule.type === 'GLOBAL' ? '全局' : '租户级' }}</span>
                <span v-if="rule.vipExempt"><el-tag type="warning" size="small">VIP豁免</el-tag></span>
              </div>
              <div class="rule-meta" style="color: #909399;">
                {{ rule.limitType === 'QPS' ? 'QPS' : '总量' }}: {{ rule.limitValue }} / {{ rule.windowSeconds }}s
              </div>
            </div>
          </div>
          <div v-if="allRules.length > 0" style="margin-top: 16px;">
            <el-checkbox
              v-model="selectAllRules"
              @change="handleSelectAllChange"
            >
              全选 ({{ selectedRuleIds.length }}/{{ allRules.length }})
            </el-checkbox>
          </div>
        </div>
      </el-col>

      <el-col :span="16">
        <div class="page-card" style="margin-bottom: 20px;">
          <h3 style="margin-bottom: 16px;">
            请求样本 ({{ previewRequests.length }})
            <el-tag v-if="previewRequests.length > 0" type="info" size="small" style="margin-left: 8px;">
              可编辑请求数据
            </el-tag>
          </h3>
          <el-table :data="previewRequests" v-loading="false" size="small" max-height="300">
            <el-table-column prop="id" label="ID" width="80" />
            <el-table-column prop="tenantId" label="租户" width="120">
              <template #default="{ row }">
                <el-select v-model="row.tenantId" size="small" style="width: 100%;">
                  <el-option
                    v-for="tenant in tenants"
                    :key="tenant.id"
                    :label="tenant.name"
                    :value="tenant.id"
                  />
                </el-select>
              </template>
            </el-table-column>
            <el-table-column prop="regionCode" label="地区" width="130">
              <template #default="{ row }">
                <el-select v-model="row.regionCode" size="small" style="width: 100%;">
                  <el-option
                    v-for="region in regions"
                    :key="region.code"
                    :label="region.name"
                    :value="region.code"
                  />
                </el-select>
              </template>
            </el-table-column>
            <el-table-column prop="path" label="接口路径">
              <template #default="{ row }">
                <el-input v-model="row.path" size="small" placeholder="/api/xxx" />
              </template>
            </el-table-column>
            <el-table-column label="操作" width="80">
              <template #default="{ $index }">
                <el-button type="danger" link size="small" @click="removeRequest($index)">
                  删除
                </el-button>
              </template>
            </el-table-column>
          </el-table>
          <div style="margin-top: 12px;">
            <el-button @click="addEmptyRequest" size="small">
              <el-icon><Plus /></el-icon>
              添加请求
            </el-button>
            <el-button @click="clearRequests" size="small" type="danger">
              清空
            </el-button>
          </div>
        </div>
      </el-col>
    </el-row>

    <div v-if="previewResults" class="page-card">
      <h3 style="margin-bottom: 16px;">
        预演结果
      </h3>

      <el-row :gutter="20" style="margin-bottom: 20px;">
        <el-col :span="6">
          <div class="stat-card">
            <div class="stat-value">{{ previewResults.stats.total }}</div>
            <div class="stat-label">总请求数</div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="stat-card green">
            <div class="stat-value">{{ previewResults.stats.allowed }}</div>
            <div class="stat-label">放行</div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="stat-card orange">
            <div class="stat-value">{{ previewResults.stats.rateLimited + previewResults.stats.rejected }}</div>
            <div class="stat-label">被限制</div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="stat-card blue">
            <div class="stat-value">{{ previewResults.stats.vipExempted }}</div>
            <div class="stat-label">VIP豁免</div>
          </div>
        </el-col>
      </el-row>

      <el-tabs v-model="activeTab">
        <el-tab-pane label="详细结果" name="detail">
          <el-table :data="previewResults.results" v-loading="false" size="small">
            <el-table-column type="expand">
              <template #default="{ row }">
                <div class="expand-detail">
                  <h4 style="margin-bottom: 8px;">评估详情：</h4>
                  <p v-for="(exp, idx) in row.explanations" :key="idx">
                    {{ idx + 1 }}. {{ exp }}
                  </p>
                  <h4 style="margin: 12px 0 8px;">请求信息：</h4>
                  <p>租户: {{ getTenantName(row.request.tenantId) }}</p>
                  <p>地区: {{ getRegionName(row.request.regionCode) }}</p>
                  <p>路径: {{ row.request.path }}</p>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="#" width="60">
              <template #default="{ $index }">
                {{ $index + 1 }}
              </template>
            </el-table-column>
            <el-table-column label="租户" width="140">
              <template #default="{ row }">
                {{ getTenantName(row.request.tenantId) }}
                <el-tag v-if="row.vipExempted" type="success" size="small" style="margin-left: 4px;">VIP</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="地区" width="100">
              <template #default="{ row }">
                {{ getRegionName(row.request.regionCode) }}
              </template>
            </el-table-column>
            <el-table-column label="接口路径" prop="request.path" />
            <el-table-column label="决策" width="100">
              <template #default="{ row }">
                <span :class="['status-tag', getDecisionTagClass(row.decision)]">
                  {{ getDecisionLabel(row.decision) }}
                </span>
              </template>
            </el-table-column>
            <el-table-column label="命中规则" width="200">
              <template #default="{ row }">
                <template v-if="row.matchedRules.length > 0">
                  <div v-for="rule in row.matchedRules" :key="rule.ruleId" style="margin: 2px 0;">
                    <el-tag size="small">{{ rule.ruleName }}</el-tag>
                    <span style="margin-left: 4px; color: #909399; font-size: 12px;">
                      P{{ rule.priority }}
                    </span>
                  </div>
                </template>
                <span v-else style="color: #909399;">无</span>
              </template>
            </el-table-column>
            <el-table-column label="有效地区" width="100">
              <template #default="{ row }">
                {{ row.effectiveRegion || '-' }}
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <el-tab-pane label="规则优先级说明" name="rules">
          <div style="padding: 20px;">
            <el-alert
              title="规则匹配顺序说明"
              type="info"
              :closable="false"
              style="margin-bottom: 20px;"
            >
              <p>1. 首先按优先级从高到低排序规则（数值越大优先级越高）</p>
              <p>2. 依次检查每个规则是否匹配请求条件（租户等级、地区、接口分组）</p>
              <p>3. VIP豁免判断：如果租户是VIP且规则开启VIP豁免，则跳过此规则</p>
              <p>4. 第一条触发限制的规则即为最终生效规则</p>
              <p>5. 地区规则：特定地区规则优先于全国(DEFAULT)规则</p>
            </el-alert>

            <h4 style="margin-bottom: 12px;">当前选中规则优先级排序：</h4>
            <div
              v-for="(rule, idx) in sortedSelectedRules"
              :key="rule.id"
              class="rule-card"
            >
              <div class="rule-header">
                <span class="rule-name">{{ idx + 1 }}. {{ rule.name }}</span>
                <el-tag size="small">优先级 {{ rule.priority }}</el-tag>
              </div>
              <div class="rule-meta">
                <span>{{ rule.type === 'GLOBAL' ? '全局规则' : '租户级规则: ' + getTenantLevelLabel(rule.tenantLevel) }}</span>
                <span>地区: {{ getRegionName(rule.regionCode) }}</span>
                <span v-if="rule.vipExempt">
                  <el-tag type="warning" size="small">VIP豁免</el-tag>
                </span>
                <span v-else>
                  <el-tag type="danger" size="small">VIP不豁免</el-tag>
                </span>
              </div>
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { releasesApi, rulesApi, tenantsApi, commonApi } from '../api';

const previewLoading = ref(false);
const allRules = ref([]);
const selectedRuleIds = ref([]);
const tenants = ref([]);
const regions = ref([]);
const previewRequests = ref([]);
const previewResults = ref(null);
const activeTab = ref('detail');

const selectAllRules = computed({
  get: () => allRules.value.length > 0 && selectedRuleIds.value.length === allRules.value.length,
  set: (val) => {},
});

const sortedSelectedRules = computed(() => {
  return allRules.value
    .filter(r => selectedRuleIds.value.includes(r.id))
    .sort((a, b) => (b.priority || 0) - (a.priority || 0));
});

function getTenantName(id) {
  const tenant = tenants.value.find(t => t.id === id);
  return tenant ? tenant.name : id;
}

function getRegionName(code) {
  const region = regions.value.find(r => r.code === code);
  return region ? region.name : code;
}

function getTenantLevelLabel(level) {
  const map = {
    VIP_GOLD: '黄金VIP',
    VIP_SILVER: '白银VIP',
    NORMAL: '普通租户',
  };
  return map[level] || level;
}

function getDecisionLabel(decision) {
  const map = {
    ALLOW: '放行',
    RATE_LIMITED: '限速',
    REJECTED: '拒绝',
  };
  return map[decision] || decision;
}

function getDecisionTagClass(decision) {
  const map = {
    ALLOW: 'tag-allow',
    RATE_LIMITED: 'tag-rate-limited',
    REJECTED: 'tag-rejected',
  };
  return map[decision] || 'tag-draft';
}

async function loadData() {
  try {
    const [rulesRes, tenantsRes, regionsRes] = await Promise.all([
      rulesApi.list(),
      tenantsApi.list(),
      commonApi.regions(),
    ]);
    allRules.value = rulesRes.data || [];
    tenants.value = tenantsRes.data || [];
    regions.value = regionsRes.data || [];
  } catch (err) {
    ElMessage.error(err.message);
  }
}

function toggleRule(id) {
  const idx = selectedRuleIds.value.indexOf(id);
  if (idx > -1) {
    selectedRuleIds.value.splice(idx, 1);
  } else {
    selectedRuleIds.value.push(id);
  }
}

function handleSelectAllChange(val) {
  if (val) {
    selectedRuleIds.value = allRules.value.map(r => r.id);
  } else {
    selectedRuleIds.value = [];
  }
}

function addEmptyRequest() {
  previewRequests.value.push({
    id: `req_${Date.now()}`,
    tenantId: tenants.value[0]?.id || '',
    regionCode: 'DEFAULT',
    path: '/api/order/create',
    timestamp: new Date().toISOString(),
  });
}

function removeRequest(index) {
  previewRequests.value.splice(index, 1);
}

function clearRequests() {
  previewRequests.value = [];
}

async function loadSampleRequests() {
  try {
    const res = await releasesApi.preview({
      ruleIds: [],
      mockCount: 20,
    });
    previewRequests.value = res.data.results.map(r => ({
      id: r.request.id,
      tenantId: r.request.tenantId,
      regionCode: r.request.regionCode,
      path: r.request.path,
      timestamp: r.request.timestamp,
    }));
    ElMessage.success('已加载20条样本请求');
  } catch (err) {
    ElMessage.error(err.message);
  }
}

async function runPreview() {
  if (selectedRuleIds.value.length === 0) {
    ElMessage.warning('请至少选择一条规则');
    return;
  }
  if (previewRequests.value.length === 0) {
    ElMessage.warning('请添加请求样本或加载样本请求');
    return;
  }

  previewLoading.value = true;
  try {
    const res = await releasesApi.preview({
      ruleIds: selectedRuleIds.value,
      requests: previewRequests.value,
    });
    previewResults.value = res.data;
    ElMessage.success('预演完成');
  } catch (err) {
    ElMessage.error(err.message);
  } finally {
    previewLoading.value = false;
  }
}

onMounted(() => {
  loadData();
});
</script>

<style scoped>
.rule-card.is-selected {
  border-color: #409eff;
  background: #ecf5ff;
}
</style>
