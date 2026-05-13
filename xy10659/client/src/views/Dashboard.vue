<template>
  <div class="dashboard">
    <el-row :gutter="20">
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-content">
            <div class="stat-icon" style="background: #409EFF">
              <el-icon :size="30"><Van /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ stats.vehicles || 0 }}</div>
              <div class="stat-label">车辆总数</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-content">
            <div class="stat-icon" style="background: #67C23A">
              <el-icon :size="30"><Tickets /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ stats.orders || 0 }}</div>
              <div class="stat-label">套餐订单</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-content">
            <div class="stat-icon" style="background: #E6A23C">
              <el-icon :size="30"><DocumentChecked /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ stats.today_verifications || 0 }}</div>
              <div class="stat-label">今日核销</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-content">
            <div class="stat-icon" style="background: #F56C6C">
              <el-icon :size="30"><Warning /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ stats.pending_exceptions || 0 }}</div>
              <div class="stat-label">待处理异常</div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" style="margin-top: 20px">
      <el-col :span="12">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>月度核销趋势</span>
            </div>
          </template>
          <div ref="monthlyChart" style="width: 100%; height: 300px"></div>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>经办人排名</span>
            </div>
          </template>
          <div ref="handlerChart" style="width: 100%; height: 300px"></div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" style="margin-top: 20px">
      <el-col :span="12">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>待处理提醒</span>
              <el-button type="primary" size="small" @click="$router.push('/reminders')">查看全部</el-button>
            </div>
          </template>
          <el-table :data="reminders.slice(0, 5)" style="width: 100%">
            <el-table-column prop="plate_number" label="车牌号" width="100" />
            <el-table-column prop="vehicle_model" label="车型" />
            <el-table-column prop="item_name" label="保养项目" />
            <el-table-column prop="reminder_date" label="提醒日期" width="120" />
          </el-table>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>最近异常</span>
              <el-button type="danger" size="small" @click="$router.push('/exceptions')">查看全部</el-button>
            </div>
          </template>
          <el-table :data="exceptions.slice(0, 5)" style="width: 100%">
            <el-table-column prop="exception_no" label="异常单号" width="120" />
            <el-table-column prop="exception_type" label="异常类型" width="100" />
            <el-table-column prop="exception_reason" label="异常原因" />
            <el-table-column prop="status" label="状态" width="80">
              <template #default="scope">
                <el-tag :type="scope.row.status === 'pending' ? 'warning' : 'success'">
                  {{ scope.row.status === 'pending' ? '待处理' : '已解决' }}
                </el-tag>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import axios from 'axios';
import * as echarts from 'echarts';

const stats = ref({});
const reminders = ref([]);
const exceptions = ref([]);
const monthlyChart = ref(null);
const handlerChart = ref(null);

const fetchStats = async () => {
  try {
    const res = await axios.get('/api/stats');
    stats.value = res.data;
  } catch (err) {
    console.error(err);
  }
};

const fetchReminders = async () => {
  try {
    const res = await axios.get('/api/reminders', { params: { status: 'pending' } });
    reminders.value = res.data.data || [];
  } catch (err) {
    console.error(err);
  }
};

const fetchExceptions = async () => {
  try {
    const res = await axios.get('/api/exceptions');
    exceptions.value = res.data.data || [];
  } catch (err) {
    console.error(err);
  }
};

const renderMonthlyChart = async () => {
  try {
    const res = await axios.get('/api/stats/monthly-data');
    const data = res.data.reverse();
    
    const chart = echarts.init(monthlyChart.value);
    chart.setOption({
      tooltip: {
        trigger: 'axis'
      },
      xAxis: {
        type: 'category',
        data: data.map(item => item.month)
      },
      yAxis: [
        {
          type: 'value',
          name: '核销次数'
        },
        {
          type: 'value',
          name: '金额(元)'
        }
      ],
      series: [
        {
          name: '核销次数',
          type: 'bar',
          data: data.map(item => item.count),
          itemStyle: { color: '#409EFF' }
        },
        {
          name: '金额',
          type: 'line',
          yAxisIndex: 1,
          data: data.map(item => item.total),
          itemStyle: { color: '#67C23A' }
        }
      ]
    });
  } catch (err) {
    console.error(err);
  }
};

const renderHandlerChart = async () => {
  try {
    const res = await axios.get('/api/stats/handler-ranking');
    const data = res.data;
    
    const chart = echarts.init(handlerChart.value);
    chart.setOption({
      tooltip: {
        trigger: 'axis'
      },
      xAxis: {
        type: 'value'
      },
      yAxis: {
        type: 'category',
        data: data.map(item => item.handler).reverse()
      },
      series: [
        {
          name: '核销次数',
          type: 'bar',
          data: data.map(item => item.count).reverse(),
          itemStyle: { color: '#E6A23C' }
        }
      ]
    });
  } catch (err) {
    console.error(err);
  }
};

onMounted(() => {
  fetchStats();
  fetchReminders();
  fetchExceptions();
  renderMonthlyChart();
  renderHandlerChart();
});
</script>

<style scoped>
.dashboard {
  padding: 0;
}
.stat-card {
  height: 120px;
}
.stat-content {
  display: flex;
  align-items: center;
  gap: 20px;
}
.stat-icon {
  width: 60px;
  height: 60px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
}
.stat-info {
  flex: 1;
}
.stat-value {
  font-size: 28px;
  font-weight: bold;
  color: #303133;
}
.stat-label {
  font-size: 14px;
  color: #909399;
  margin-top: 5px;
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
