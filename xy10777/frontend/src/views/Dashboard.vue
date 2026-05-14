<template>
  <div class="dashboard">
    <el-row :gutter="16">
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-content">
            <div class="stat-icon geofence-icon">
              <el-icon size="28"><Grid /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ stats.geofenceCount }}</div>
              <div class="stat-label">围栏数量</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-content">
            <div class="stat-icon device-icon">
              <el-icon size="28"><Van /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ stats.deviceCount }}</div>
              <div class="stat-label">设备数量</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-content">
            <div class="stat-icon alert-icon">
              <el-icon size="28"><Warning /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ stats.alertCount }}</div>
              <div class="stat-label">告警总数</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-content">
            <div class="stat-icon false-alarm-icon">
              <el-icon size="28"><Delete /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ stats.falseAlarmCount }}</div>
              <div class="stat-label">已确认误报</div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="16" style="margin-top: 16px">
      <el-col :span="12">
        <el-card>
          <template #header>
            <span>告警类型分布</span>
          </template>
          <div ref="alertChart" style="height: 300px"></div>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card>
          <template #header>
            <span>修正前后告警对比</span>
          </template>
          <div ref="correctionChart" style="height: 300px"></div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="16" style="margin-top: 16px">
      <el-col :span="12">
        <el-card>
          <template #header>
            <span>最新告警</span>
          </template>
          <el-table :data="recentAlerts" size="small">
            <el-table-column prop="event_type" label="类型" width="80">
              <template #default="{ row }">
                <el-tag :type="row.event_type === 'enter' ? 'success' : 'danger'" size="small">
                  {{ row.event_type === 'enter' ? '进入' : row.event_type === 'exit' ? '离开' : '停留' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="timestamp" label="时间" width="160">
              <template #default="{ row }">
                {{ formatTime(row.timestamp) }}
              </template>
            </el-table-column>
            <el-table-column prop="confidence" label="置信度" width="100">
              <template #default="{ row }">
                <el-progress :percentage="Math.round(row.confidence * 100)" :stroke-width="8" />
              </template>
            </el-table-column>
            <el-table-column prop="is_false_alarm" label="状态" width="100">
              <template #default="{ row }">
                <el-tag :type="row.is_false_alarm ? 'warning' : (row.is_verified ? 'success' : 'info')" size="small">
                  {{ row.is_false_alarm ? '误报' : (row.is_verified ? '已确认' : '待确认') }}
                </el-tag>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card>
          <template #header>
            <span>误报过滤规则状态</span>
          </template>
          <el-table :data="filters" size="small">
            <el-table-column prop="name" label="规则名称" />
            <el-table-column prop="filter_type" label="类型" />
            <el-table-column prop="priority" label="优先级" width="80" />
            <el-table-column prop="is_active" label="状态" width="80">
              <template #default="{ row }">
                <el-switch v-model="row.is_active" disabled size="small" />
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import * as echarts from 'echarts'
import { geofenceApi, deviceApi, alertApi, configApi } from '@/api'

const stats = ref({
  geofenceCount: 0,
  deviceCount: 0,
  alertCount: 0,
  falseAlarmCount: 0
})

const recentAlerts = ref([])
const filters = ref([])
const alertChart = ref(null)
const correctionChart = ref(null)

const formatTime = (timestamp) => {
  return new Date(timestamp).toLocaleString('zh-CN')
}

const loadData = async () => {
  const [geoRes, devRes, alertRes, filterRes] = await Promise.all([
    geofenceApi.list(),
    deviceApi.list(),
    alertApi.list(),
    configApi.getFilters()
  ])
  
  stats.value.geofenceCount = geoRes.data.length
  stats.value.deviceCount = devRes.data.length
  stats.value.alertCount = alertRes.data.length
  stats.value.falseAlarmCount = alertRes.data.filter(a => a.is_false_alarm).length
  
  recentAlerts.value = alertRes.data.slice(0, 5)
  filters.value = filterRes.data

  initAlertChart(alertRes.data)
  initCorrectionChart(alertRes.data)
}

const initAlertChart = (alerts) => {
  const chart = echarts.init(alertChart.value)
  const enterCount = alerts.filter(a => a.event_type === 'enter').length
  const exitCount = alerts.filter(a => a.event_type === 'exit').length
  const stayCount = alerts.filter(a => a.event_type === 'stay').length

  chart.setOption({
    tooltip: { trigger: 'item' },
    series: [{
      type: 'pie',
      radius: ['40%', '70%'],
      data: [
        { value: enterCount, name: '进入', itemStyle: { color: '#67c23a' } },
        { value: exitCount, name: '离开', itemStyle: { color: '#f56c6c' } },
        { value: stayCount, name: '停留', itemStyle: { color: '#409eff' } }
      ],
      label: { show: true }
    }]
  })
}

const initCorrectionChart = (alerts) => {
  const chart = echarts.init(correctionChart.value)
  const verifiedCount = alerts.filter(a => a.is_verified && !a.is_false_alarm).length
  const falseAlarmCount = alerts.filter(a => a.is_false_alarm).length
  const pendingCount = alerts.filter(a => !a.is_verified).length

  chart.setOption({
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: ['正常告警', '误报排除', '待确认'] },
    yAxis: { type: 'value' },
    series: [{
      type: 'bar',
      data: [
        { value: verifiedCount, itemStyle: { color: '#67c23a' } },
        { value: falseAlarmCount, itemStyle: { color: '#e6a23c' } },
        { value: pendingCount, itemStyle: { color: '#909399' } }
      ],
      barWidth: '50%'
    }]
  })
}

onMounted(loadData)
</script>

<style scoped>
.stat-card {
  cursor: pointer;
  transition: all 0.3s;
}
.stat-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 10px 20px rgba(0,0,0,0.1);
}
.stat-content {
  display: flex;
  align-items: center;
  gap: 16px;
}
.stat-icon {
  width: 60px;
  height: 60px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
}
.geofence-icon {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}
.device-icon {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
}
.alert-icon {
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
}
.false-alarm-icon {
  background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
}
.stat-value {
  font-size: 28px;
  font-weight: bold;
  color: #333;
}
.stat-label {
  font-size: 14px;
  color: #999;
  margin-top: 4px;
}
</style>