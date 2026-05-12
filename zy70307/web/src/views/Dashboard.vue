<template>
  <div>
    <div class="page-header">
      <h2>总览</h2>
      <div class="page-actions">
        <el-button type="primary" @click="simulateTraffic">
          <el-icon><Connection /></el-icon>
          模拟流量
        </el-button>
        <el-button @click="refreshData">
          <el-icon><Refresh /></el-icon>
          刷新
        </el-button>
      </div>
    </div>

    <el-row :gutter="20" style="margin-bottom: 24px;">
      <el-col :span="6">
        <div class="stat-card">
          <div class="stat-value">{{ stats.totalRequests || 0 }}</div>
          <div class="stat-label">总请求数</div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card green">
          <div class="stat-value">{{ stats.allowed || 0 }}</div>
          <div class="stat-label">放行请求</div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card orange">
          <div class="stat-value">{{ (stats.rateLimited || 0) + (stats.rejected || 0) }}</div>
          <div class="stat-label">被限制请求</div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card blue">
          <div class="stat-value">{{ stats.vipExempted || 0 }}</div>
          <div class="stat-label">VIP豁免请求</div>
        </div>
      </el-col>
    </el-row>

    <el-row :gutter="20">
      <el-col :span="12">
        <div class="page-card">
          <h3 style="margin-bottom: 16px;">当前策略概览</h3>
          <el-empty v-if="!currentRelease" description="当前无激活策略" />
          <div v-else>
            <el-descriptions :column="2" border>
              <el-descriptions-item label="策略名称">
                {{ currentRelease.name }}
              </el-descriptions-item>
              <el-descriptions-item label="版本">
                <el-tag type="success">{{ currentRelease.version }}</el-tag>
              </el-descriptions-item>
              <el-descriptions-item label="发布时间">
                {{ formatDate(currentRelease.releasedAt) }}
              </el-descriptions-item>
              <el-descriptions-item label="规则数量">
                {{ activeRules.length }} 条
              </el-descriptions-item>
            </el-descriptions>

            <div style="margin-top: 20px;">
              <h4 style="margin-bottom: 12px;">生效规则：</h4>
              <div v-for="rule in activeRules" :key="rule.id" class="rule-card">
                <div class="rule-header">
                  <span class="rule-name">{{ rule.name }}</span>
                  <span class="status-tag tag-active">优先级 {{ rule.priority }}</span>
                </div>
                <div class="rule-meta">
                  <span>类型: {{ rule.type === 'GLOBAL' ? '全局' : '租户级' }}</span>
                  <span v-if="rule.vipExempt"><el-tag type="warning" size="small">VIP豁免</el-tag></span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </el-col>

      <el-col :span="12">
        <div class="page-card" style="margin-bottom: 20px;">
          <h3 style="margin-bottom: 16px;">发布批次对比</h3>
          <el-table :data="releaseComparison" v-if="releaseComparison.length > 0" size="small">
            <el-table-column prop="releaseName" label="策略名称" />
            <el-table-column prop="releaseVersion" label="版本" width="100" />
            <el-table-column prop="total" label="请求数" width="80" />
            <el-table-column prop="allowed" label="放行" width="80" />
            <el-table-column prop="blocked" label="拦截" width="80" />
            <el-table-column label="拦截率" width="100">
              <template #default="{ row }">
                <el-progress :percentage="parseFloat(row.blockRate)" :stroke-width="8" />
              </template>
            </el-table-column>
          </el-table>
          <el-empty v-else description="暂无统计数据" />
        </div>

        <div class="page-card">
          <h3 style="margin-bottom: 16px;">Top 10 被拦截租户</h3>
          <el-table :data="topBlockedTenants" v-if="topBlockedTenants.length > 0" size="small">
            <el-table-column type="index" label="排名" width="60" />
            <el-table-column prop="name" label="租户名称" />
            <el-table-column prop="count" label="被拦截次数" width="120">
              <template #default="{ row }">
                <el-tag type="danger">{{ row.count }}</el-tag>
              </template>
            </el-table-column>
          </el-table>
          <el-empty v-else description="暂无数据" />
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import dayjs from 'dayjs';
import { hitLogsApi, releasesApi, rulesApi } from '../api';

const currentRelease = ref(null);
const activeRules = ref([]);
const stats = ref({});
const releaseComparison = ref([]);
const topBlockedTenants = ref([]);

function formatDate(date) {
  return date ? dayjs(date).format('YYYY-MM-DD HH:mm:ss') : '-';
}

async function refreshData() {
  try {
    const [releaseRes, rulesRes, statsRes] = await Promise.all([
      releasesApi.current(),
      rulesApi.list(),
      hitLogsApi.stats(),
    ]);
    
    currentRelease.value = releaseRes.data;
    activeRules.value = rulesRes.data?.filter(r => r.status === 'ACTIVE') || [];
    stats.value = statsRes.data || {};
    releaseComparison.value = statsRes.data?.releaseComparison || [];
    topBlockedTenants.value = statsRes.data?.topBlockedTenants || [];
  } catch (err) {
    ElMessage.error(err.message);
  }
}

async function simulateTraffic() {
  try {
    await hitLogsApi.simulate(30);
    ElMessage.success('模拟流量已生成');
    refreshData();
  } catch (err) {
    ElMessage.error(err.message);
  }
}

onMounted(() => {
  refreshData();
});
</script>
