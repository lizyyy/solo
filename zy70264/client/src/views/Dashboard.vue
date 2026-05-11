<template>
  <div>
    <h2 class="page-title">数据概览</h2>

    <el-alert
      title="欢迎使用养老餐配送温度追踪台"
      type="info"
      :closable="false"
      class="mb-20"
    >
      <template #default>
        点击下方按钮可快速创建示例数据进行演示。
        <div class="sample-buttons" style="margin-top: 12px;">
          <el-button type="success" :loading="loadingNormal" @click="createNormalSample">
            创建【顺利样例】数据
          </el-button>
          <el-button type="warning" :loading="loadingAbnormal" @click="createAbnormalSample">
            创建【异常拦截样例】数据
          </el-button>
          <el-button type="primary" :loading="loadingRules" @click="initRules">
            初始化补偿规则
          </el-button>
        </div>
      </template>
    </el-alert>

    <el-row :gutter="20" class="mb-20">
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-value" style="color: #409eff;">{{ stats.batchStats?.total_batches || 0 }}</div>
          <div class="stat-label">配送批次总数</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-value" style="color: #67c23a;">{{ stats.tempStats?.total_segments || 0 }}</div>
          <div class="stat-label">温度监控片段</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-value" style="color: #f56c6c;">{{ stats.tempStats?.abnormal_segments || 0 }}</div>
          <div class="stat-label">温度异常片段</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-value" style="color: #e6a23c;">¥{{ stats.compensationStats?.total_amount || 0 }}</div>
          <div class="stat-label">已审批补偿金额</div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20">
      <el-col :span="16">
        <el-card class="card-section">
          <template #header>
            <span>配送趋势（近30天）</span>
          </template>
          <div ref="trendChart" class="chart-container"></div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card class="card-section">
          <template #header>
            <span>退餐原因分布</span>
          </template>
          <div ref="returnChart" class="chart-container"></div>
        </el-card>
      </el-col>
    </el-row>

    <el-card class="card-section">
      <template #header>
        <div class="flex-between">
          <span>食品安全事件</span>
          <el-button type="primary" size="small" @click="refreshData">刷新</el-button>
        </div>
      </template>
      <el-table :data="incidents" v-loading="loading" stripe>
        <el-table-column prop="batch_no" label="批次号" width="180">
          <template #default="{ row }">
            <span class="batch-no">{{ row.batch_no }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="delivery_date" label="配送日期" width="120" />
        <el-table-column prop="incident_type" label="事件类型" width="120">
          <template #default="{ row }">
            <el-tag :type="row.incident_type === 'temperature' ? 'warning' : 'danger'">
              {{ row.incident_type === 'temperature' ? '温度异常' : '食品安全' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="severity" label="严重程度" width="100">
          <template #default="{ row }">
            <el-tag :type="row.severity === 'high' ? 'danger' : 'warning'">
              {{ row.severity === 'high' ? '高' : '中/低' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="description" label="描述" min-width="200" />
        <el-table-column prop="affected_count" label="受影响人数" width="100" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 'open' ? 'danger' : 'info'">
              {{ row.status === 'open' ? '处理中' : '已关闭' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <el-button
              v-if="row.status === 'open'"
              type="primary"
              size="small"
              link
              @click="closeIncident(row)"
            >
              关闭
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted, nextTick } from 'vue';
import * as echarts from 'echarts';
import dayjs from 'dayjs';
import { ElMessage, ElMessageBox } from 'element-plus';
import { reportAPI, sampleDataAPI } from '@/api';

const loading = ref(false);
const loadingNormal = ref(false);
const loadingAbnormal = ref(false);
const loadingRules = ref(false);
const stats = reactive({});
const incidents = ref([]);
const trendChart = ref(null);
const returnChart = ref(null);
let trendChartInstance = null;
let returnChartInstance = null;

const loadData = async () => {
  loading.value = true;
  try {
    const res = await reportAPI.dashboard({
      startDate: dayjs().subtract(30, 'day').format('YYYY-MM-DD'),
      endDate: dayjs().format('YYYY-MM-DD')
    });
    Object.assign(stats, res.data);
    
    const incidentsRes = await reportAPI.incidents();
    incidents.value = incidentsRes.data;
    
    await nextTick();
    renderCharts();
  } finally {
    loading.value = false;
  }
};

const renderCharts = () => {
  if (trendChart.value && stats.dailyTrend?.length > 0) {
    if (trendChartInstance) trendChartInstance.dispose();
    trendChartInstance = echarts.init(trendChart.value);
    trendChartInstance.setOption({
      tooltip: { trigger: 'axis' },
      legend: { data: ['配送批次', '温度异常'] },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: stats.dailyTrend.map(d => d.delivery_date)
      },
      yAxis: { type: 'value' },
      series: [
        {
          name: '配送批次',
          type: 'line',
          data: stats.dailyTrend.map(d => d.batches),
          smooth: true,
          itemStyle: { color: '#409eff' }
        },
        {
          name: '温度异常',
          type: 'line',
          data: stats.dailyTrend.map(d => d.abnormal_temps),
          smooth: true,
          itemStyle: { color: '#f56c6c' }
        }
      ]
    });
  }

  if (returnChart.value && stats.returnStats?.length > 0) {
    if (returnChartInstance) returnChartInstance.dispose();
    returnChartInstance = echarts.init(returnChart.value);
    const reasonNames = {
      'T001': '温度过低', 'T002': '温度过高', 'T003': '保温箱异常',
      'F001': '发现异物', 'F002': '变质异味', 'F003': '外观损坏',
      'O001': '老人不在家', 'O002': '数量不符', 'O003': '配送延迟'
    };
    returnChartInstance.setOption({
      tooltip: { trigger: 'item' },
      series: [{
        type: 'pie',
        radius: ['40%', '70%'],
        data: stats.returnStats.map(d => ({
          name: reasonNames[d.reason_code] || d.reason_code,
          value: d.count
        })),
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.5)'
          }
        }
      }]
    });
  }
};

const refreshData = () => {
  loadData();
  ElMessage.success('数据已刷新');
};

const createNormalSample = async () => {
  loadingNormal.value = true;
  try {
    const res = await sampleDataAPI.createNormal();
    ElMessage.success(res.message);
    loadData();
  } finally {
    loadingNormal.value = false;
  }
};

const createAbnormalSample = async () => {
  loadingAbnormal.value = true;
  try {
    const res = await sampleDataAPI.createAbnormal();
    ElMessage({ message: res.message, type: 'warning' });
    loadData();
  } finally {
    loadingAbnormal.value = false;
  }
};

const initRules = async () => {
  loadingRules.value = true;
  try {
    const res = await sampleDataAPI.initRules();
    ElMessage.success(res.message);
  } finally {
    loadingRules.value = false;
  }
};

const closeIncident = async (row) => {
  try {
    await ElMessageBox.confirm('确定要关闭此事件吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    });
    await reportAPI.closeIncident(row.id, { closed_by: '管理员' });
    ElMessage.success('事件已关闭');
    loadData();
  } catch {
    // 用户取消
  }
};

onMounted(() => {
  loadData();
  window.addEventListener('resize', renderCharts);
});

onUnmounted(() => {
  window.removeEventListener('resize', renderCharts);
  if (trendChartInstance) trendChartInstance.dispose();
  if (returnChartInstance) returnChartInstance.dispose();
});
</script>
