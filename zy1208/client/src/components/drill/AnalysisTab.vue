<template>
  <div class="analysis-tab">
    <el-alert
      v-if="!analysis"
      title="暂无分析数据"
      type="warning"
      show-icon
    >
      <template #default>
        <p>请先在概览页面运行性能分析</p>
      </template>
    </el-alert>

    <div v-else class="analysis-content">
      <el-card class="chart-card">
        <template #header>
          <div class="card-header">
            <span>性能评分雷达图</span>
          </div>
        </template>
        <div ref="radarChart" class="chart-container" style="height: 400px;"></div>
      </el-card>

      <el-row :gutter="20">
        <el-col :span="12">
          <el-card class="section-card">
            <template #header>
              <div class="card-header">
                <span>连接池分析</span>
                <el-tag :type="connectionPoolStatus.type">{{ connectionPoolStatus.text }}</el-tag>
              </div>
            </template>
            
            <el-descriptions :column="2" border v-if="analysis.connectionPool">
              <el-descriptions-item label="当前最大连接数">
                {{ analysis.connectionPool.currentMaxConnections || 'N/A' }}
              </el-descriptions-item>
              <el-descriptions-item label="建议最大连接数">
                {{ analysis.connectionPool.suggestedMaxConnections || 'N/A' }}
              </el-descriptions-item>
              <el-descriptions-item label="当前空闲超时">
                {{ analysis.connectionPool.currentIdleTimeout || 'N/A' }}
              </el-descriptions-item>
              <el-descriptions-item label="建议空闲超时">
                {{ analysis.connectionPool.suggestedIdleTimeout || 'N/A' }}
              </el-descriptions-item>
            </el-descriptions>
            
            <el-empty v-else description="暂无连接池数据" />
          </el-card>
        </el-col>

        <el-col :span="12">
          <el-card class="section-card">
            <template #header>
              <div class="card-header">
                <span>读写分离分析</span>
                <el-tag :type="readWriteStatus.type">{{ readWriteStatus.text }}</el-tag>
              </div>
            </template>
            
            <el-descriptions :column="2" border v-if="analysis.readWriteRouting">
              <el-descriptions-item label="读查询数量">
                {{ analysis.readWriteRouting.readQueries || 0 }}
              </el-descriptions-item>
              <el-descriptions-item label="写查询数量">
                {{ analysis.readWriteRouting.writeQueries || 0 }}
              </el-descriptions-item>
              <el-descriptions-item label="读写比例" :span="2">
                {{ analysis.readWriteRouting.readWriteRatio || 'N/A' }}
              </el-descriptions-item>
            </el-descriptions>
            
            <div v-if="analysis.readWriteRouting?.issues?.length > 0" class="issues-section">
              <h4>检测到的问题：</h4>
              <ul>
                <li v-for="(issue, index) in analysis.readWriteRouting.issues" :key="index">
                  {{ issue }}
                </li>
              </ul>
            </div>
            
            <el-empty v-else-if="!analysis.readWriteRouting" description="暂无读写路由数据" />
          </el-card>
        </el-col>
      </el-row>

      <el-card class="section-card" v-if="analysis.shardingRisks?.length > 0">
        <template #header>
          <div class="card-header">
            <span>分片风险分析</span>
            <el-tag type="warning">检测到风险</el-tag>
          </div>
        </template>
        
        <el-table :data="analysis.shardingRisks">
          <el-table-column prop="severity" label="风险等级" width="120">
            <template #default="{ row }">
              <el-tag :type="getSeverityType(row.severity)">
                {{ getSeverityText(row.severity) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="category" label="分类" width="150" />
          <el-table-column prop="tableName" label="表名" width="150" />
          <el-table-column prop="description" label="问题描述" min-width="250" />
          <el-table-column prop="suggestion" label="建议" min-width="250" />
        </el-table>
      </el-card>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { drillApi, analysisApi } from '@/api'
import * as echarts from 'echarts'

const route = useRoute()

const analysis = ref(null)
const radarChart = ref(null)
let chartInstance = null

const connectionPoolStatus = computed(() => {
  if (!analysis.value?.connectionPool) {
    return { type: 'info', text: '无数据' }
  }
  
  const pool = analysis.value.connectionPool
  if (pool.connectionIssues?.length > 0) {
    return { type: 'danger', text: '有问题' }
  }
  return { type: 'success', text: '正常' }
})

const readWriteStatus = computed(() => {
  if (!analysis.value?.readWriteRouting) {
    return { type: 'info', text: '无数据' }
  }
  
  const routing = analysis.value.readWriteRouting
  if (routing.issues?.length > 0) {
    return { type: 'warning', text: '需要优化' }
  }
  return { type: 'success', text: '正常' }
})

const getSeverityType = (severity) => {
  const map = {
    critical: 'danger',
    high: 'danger',
    medium: 'warning',
    low: 'info'
  }
  return map[severity] || 'info'
}

const getSeverityText = (severity) => {
  const map = {
    critical: '严重',
    high: '高',
    medium: '中',
    low: '低'
  }
  return map[severity] || severity
}

const fetchAnalysis = async () => {
  try {
    const drillId = route.params.id
    const response = await analysisApi.get(drillId)
    analysis.value = response.data
    
    await nextTick()
    initChart()
  } catch (error) {
    console.log('暂无分析结果')
  }
}

const initChart = () => {
  if (!radarChart.value || !analysis.value) return
  
  if (chartInstance) {
    chartInstance.dispose()
  }
  
  chartInstance = echarts.init(radarChart.value)
  
  const indicators = [
    { name: '慢查询', max: 100 },
    { name: '索引设计', max: 100 },
    { name: '连接池', max: 100 },
    { name: '读写分离', max: 100 },
    { name: '分片策略', max: 100 },
    { name: '写入优化', max: 100 }
  ]
  
  const bottlenecks = analysis.value.bottlenecks || []
  
  const getCategoryScore = (category) => {
    const categoryBottlenecks = bottlenecks.filter(b => 
      b.category?.includes(category) || b.description?.includes(category)
    )
    
    const severityMap = {
      critical: 20,
      high: 10,
      medium: 5,
      low: 2
    }
    
    let deduction = 0
    for (const b of categoryBottlenecks) {
      deduction += severityMap[b.severity] || 5
    }
    
    return Math.max(0, 100 - deduction)
  }
  
  const values = [
    getCategoryScore('慢查询'),
    getCategoryScore('索引'),
    getCategoryScore('连接池'),
    getCategoryScore('读写'),
    getCategoryScore('分片'),
    getCategoryScore('写入')
  ]
  
  const option = {
    tooltip: {},
    legend: {
      data: ['当前评分']
    },
    radar: {
      indicator: indicators,
      axisName: {
        color: '#333'
      },
      splitArea: {
        areaStyle: {
          color: ['rgba(114, 172, 209, 0.2)', 'rgba(114, 172, 209, 0.4)'],
          shadowColor: 'rgba(0, 0, 0, 0.3)',
          shadowBlur: 10
        }
      }
    },
    series: [{
      name: '评分',
      type: 'radar',
      data: [
        {
          value: values,
          name: '当前评分',
          areaStyle: {
            color: 'rgba(64, 158, 255, 0.3)'
          },
          lineStyle: {
            color: '#409eff'
          },
          itemStyle: {
            color: '#409eff'
          }
        }
      ]
    }]
  }
  
  chartInstance.setOption(option)
}

onMounted(() => {
  fetchAnalysis()
})
</script>

<style scoped>
.analysis-tab {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.analysis-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.chart-card, .section-card {
  border-radius: 8px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.chart-container {
  width: 100%;
}

.issues-section {
  margin-top: 16px;
  padding: 12px;
  background: #fff7e6;
  border-radius: 4px;
}

.issues-section h4 {
  margin: 0 0 8px 0;
  font-size: 14px;
  color: #e6a23c;
}

.issues-section ul {
  margin: 0;
  padding-left: 20px;
}

.issues-section li {
  margin: 4px 0;
  font-size: 13px;
  color: #606266;
}
</style>
