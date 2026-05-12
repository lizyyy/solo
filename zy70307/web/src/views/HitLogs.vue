<template>
  <div>
    <div class="page-header">
      <h2>命中日志</h2>
      <div class="page-actions">
        <el-button @click="simulateTraffic">
          <el-icon><Connection /></el-icon>
          模拟流量
        </el-button>
        <el-dropdown @command="handleExport">
          <el-button type="primary">
            <el-icon><Download /></el-icon>
            导出报表
            <el-icon class="el-icon--right"><ArrowDown /></el-icon>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="csv">导出 CSV</el-dropdown-item>
              <el-dropdown-item command="json">导出 JSON</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <el-button @click="loadData">
          <el-icon><Refresh /></el-icon>
          刷新
        </el-button>
      </div>
    </div>

    <el-row :gutter="20" style="margin-bottom: 20px;">
      <el-col :span="6">
        <div class="stat-card">
          <div class="stat-value">{{ stats.totalRequests || 0 }}</div>
          <div class="stat-label">总请求数</div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card green">
          <div class="stat-value">{{ stats.allowed || 0 }}</div>
          <div class="stat-label">放行 ({{ getPercent('allowed') }}%)</div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);">
          <div class="stat-value">{{ stats.rateLimited || 0 }}</div>
          <div class="stat-label">限速 ({{ getPercent('rateLimited') }}%)</div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card orange">
          <div class="stat-value">{{ stats.rejected || 0 }}</div>
          <div class="stat-label">拒绝 ({{ getPercent('rejected') }}%)</div>
        </div>
      </el-col>
    </el-row>

    <el-row :gutter="20">
      <el-col :span="18">
        <div class="page-card">
          <div style="margin-bottom: 16px;">
            <el-form :inline="true" :model="filters">
              <el-form-item label="决策">
                <el-select v-model="filters.decision" clearable placeholder="全部" style="width: 120px;">
                  <el-option label="放行" value="ALLOW" />
                  <el-option label="限速" value="RATE_LIMITED" />
                  <el-option label="拒绝" value="REJECTED" />
                </el-select>
              </el-form-item>
              <el-form-item label="租户">
                <el-select v-model="filters.tenantId" clearable placeholder="全部" style="width: 150px;">
                  <el-option
                    v-for="t in tenants"
                    :key="t.id"
                    :label="t.name"
                    :value="t.id"
                  />
                </el-select>
              </el-form-item>
              <el-form-item label="发布批次">
                <el-select v-model="filters.releaseId" clearable placeholder="全部" style="width: 180px;">
                  <el-option
                    v-for="r in releases"
                    :key="r.id"
                    :label="`${r.name} (v${r.version})`"
                    :value="r.id"
                  />
                </el-select>
              </el-form-item>
              <el-form-item>
                <el-button type="primary" @click="loadData">查询</el-button>
                <el-button @click="resetFilters">重置</el-button>
              </el-form-item>
            </el-form>
          </div>

          <el-table :data="logs" v-loading="loading" size="small">
            <el-table-column type="expand">
              <template #default="{ row }">
                <div class="expand-detail">
                  <p><strong>请求路径：</strong>{{ row.path }}</p>
                  <p><strong>命中规则：</strong>{{ row.ruleName || '-' }}</p>
                  <p><strong>规则优先级：</strong>{{ row.rulePriority || '-' }}</p>
                  <p><strong>VIP豁免：</strong>{{ row.vipExempted ? '是' : '否' }}</p>
                  <p><strong>说明：</strong>{{ row.explanation || '-' }}</p>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="时间" width="170">
              <template #default="{ row }">
                {{ formatDate(row.hitAt) }}
              </template>
            </el-table-column>
            <el-table-column label="租户" width="130">
              <template #default="{ row }">
                {{ row.tenantName }}
                <el-tag v-if="row.vipExempted" type="success" size="small" style="margin-left: 4px;">VIP</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="地区" width="100" prop="region" />
            <el-table-column label="接口路径" prop="path" show-overflow-tooltip />
            <el-table-column label="决策" width="80">
              <template #default="{ row }">
                <span :class="['status-tag', getDecisionTagClass(row.decision)]">
                  {{ getDecisionLabel(row.decision) }}
                </span>
              </template>
            </el-table-column>
            <el-table-column label="命中规则" width="180" show-overflow-tooltip>
              <template #default="{ row }">
                <el-tag v-if="row.ruleName" size="small">{{ row.ruleName }}</el-tag>
                <span v-else style="color: #909399;">无</span>
              </template>
            </el-table-column>
            <el-table-column label="发布批次" width="150" show-overflow-tooltip>
              <template #default="{ row }">
                {{ row.releaseName || '-' }}
                <el-tag v-if="row.releaseVersion" type="info" size="small" style="margin-left: 4px;">
                  {{ row.releaseVersion }}
                </el-tag>
              </template>
            </el-table-column>
          </el-table>

          <div style="margin-top: 16px; text-align: center;">
            <el-pagination
              v-if="total > 0"
              background
              :current-page.sync="currentPage"
              :page-size="pageSize"
              :total="total"
              layout="prev, pager, next, total"
              @current-change="loadData"
            />
          </div>
        </div>
      </el-col>

      <el-col :span="6">
        <div class="page-card" style="margin-bottom: 20px;">
          <h3 style="margin-bottom: 16px;">按规则统计</h3>
          <div v-if="Object.keys(stats.byRule || {}).length === 0" style="color: #909399; text-align: center; padding: 20px;">
            暂无数据
          </div>
          <div
            v-for="(count, ruleName) in stats.byRule"
            :key="ruleName"
            style="margin-bottom: 12px;"
          >
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
              <span style="font-size: 12px; color: #606266;">{{ ruleName }}</span>
              <span style="font-size: 12px; font-weight: bold;">{{ count }}</span>
            </div>
            <el-progress
              :percentage="getRulePercent(count)"
              :stroke-width="8"
              :show-text="false"
            />
          </div>
        </div>

        <div class="page-card">
          <h3 style="margin-bottom: 16px;">按地区统计</h3>
          <div v-if="Object.keys(stats.byRegion || {}).length === 0" style="color: #909399; text-align: center; padding: 20px;">
            暂无数据
          </div>
          <div
            v-for="(count, region) in stats.byRegion"
            :key="region"
            style="margin-bottom: 12px;"
          >
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
              <span style="font-size: 12px; color: #606266;">{{ region }}</span>
              <span style="font-size: 12px; font-weight: bold;">{{ count }}</span>
            </div>
            <el-progress
              :percentage="getRulePercent(count)"
              :stroke-width="8"
              :show-text="false"
              color="#e6a23c"
            />
          </div>
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import dayjs from 'dayjs';
import { hitLogsApi, releasesApi, tenantsApi } from '../api';

const loading = ref(false);
const logs = ref([]);
const total = ref(0);
const currentPage = ref(1);
const pageSize = 20;
const stats = ref({});
const releases = ref([]);
const tenants = ref([]);

const filters = reactive({
  decision: '',
  tenantId: '',
  releaseId: '',
});

function formatDate(date) {
  return date ? dayjs(date).format('MM-DD HH:mm:ss') : '-';
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

function getPercent(type) {
  if (!stats.value.totalRequests) return 0;
  return ((stats.value[type] || 0) / stats.value.totalRequests * 100).toFixed(1);
}

function getRulePercent(count) {
  if (!stats.value.totalRequests) return 0;
  return (count / stats.value.totalRequests * 100).toFixed(0);
}

async function loadData() {
  loading.value = true;
  try {
    const params = {
      ...filters,
      limit: pageSize,
      offset: (currentPage.value - 1) * pageSize,
    };
    
    const [logsRes, statsRes, releasesRes, tenantsRes] = await Promise.all([
      hitLogsApi.list(params),
      hitLogsApi.stats(filters),
      releasesApi.list(),
      tenantsApi.list(),
    ]);
    
    logs.value = logsRes.data || [];
    total.value = logsRes.total || 0;
    stats.value = statsRes.data || {};
    releases.value = releasesRes.data || [];
    tenants.value = tenantsRes.data || [];
  } catch (err) {
    ElMessage.error(err.message);
  } finally {
    loading.value = false;
  }
}

function resetFilters() {
  Object.assign(filters, {
    decision: '',
    tenantId: '',
    releaseId: '',
  });
  currentPage.value = 1;
  loadData();
}

async function simulateTraffic() {
  try {
    await hitLogsApi.simulate(30);
    ElMessage.success('模拟流量已生成');
    loadData();
  } catch (err) {
    ElMessage.error(err.message);
  }
}

function handleExport(format) {
  const url = hitLogsApi.export({
    ...filters,
    format,
  });
  window.open(url, '_blank');
}

onMounted(() => {
  loadData();
});
</script>
