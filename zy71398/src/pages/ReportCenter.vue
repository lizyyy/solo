<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import {
  FileBarChart,
  Download,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  FileText,
  Calendar,
  Lightbulb
} from 'lucide-vue-next'
import * as echarts from 'echarts'
import { useImportStore } from '../stores/importStore'
import { formatDate } from '../utils'
import type { DrillReport } from '../types'

const store = useImportStore()

const conflictChartRef = ref<HTMLDivElement | null>(null)
const successChartRef = ref<HTMLDivElement | null>(null)
let conflictChart: echarts.ECharts | null = null
let successChart: echarts.ECharts | null = null

const generatingReport = ref(false)
const selectedSessionId = ref<string | null>(null)

const sortedReports = computed(() => {
  return [...store.reports].sort(
    (a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime()
  )
})

const hasData = computed(() => {
  return store.currentSessionId !== null
})

function initCharts() {
  nextTick(() => {
    if (conflictChartRef.value) {
      conflictChart = echarts.init(conflictChartRef.value)
      updateConflictChart()
    }
    if (successChartRef.value) {
      successChart = echarts.init(successChartRef.value)
      updateSuccessChart()
    }
  })
}

function updateConflictChart() {
  if (!conflictChart) return
  
  const data = [
    { name: '主键重复', value: store.conflictStats.breakdown.duplicate_primary_key },
    { name: '字段验证', value: store.conflictStats.breakdown.field_validation },
    { name: '类型不匹配', value: store.conflictStats.breakdown.data_type_mismatch },
    { name: '部分成功', value: store.conflictStats.breakdown.partial_success },
    { name: '回滚错误', value: store.conflictStats.breakdown.rollback_scope_error }
  ]
  
  conflictChart.setOption({
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c} ({d}%)'
    },
    legend: {
      orient: 'vertical',
      right: 10,
      top: 'center'
    },
    series: [
      {
        type: 'pie',
        radius: ['40%', '70%'],
        center: ['35%', '50%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 8,
          borderColor: '#fff',
          borderWidth: 2
        },
        label: {
          show: false
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 14,
            fontWeight: 'bold'
          }
        },
        data: data,
        color: ['#E94560', '#F59E0B', '#3B82F6', '#8B5CF6', '#EC4899']
      }
    ]
  })
}

function updateSuccessChart() {
  if (!successChart) return
  
  const total = store.currentSession
    ? store.currentSession.successCount + store.currentSession.conflictCount
    : 0
  const successRate = total > 0 ? Math.round((store.currentSession!.successCount / total) * 100) : 100
  
  successChart.setOption({
    tooltip: {
      formatter: '{b}: {c}%'
    },
    series: [
      {
        type: 'gauge',
        startAngle: 180,
        endAngle: 0,
        min: 0,
        max: 100,
        splitNumber: 5,
        itemStyle: {
          color: successRate >= 90 ? '#10B981' : successRate >= 70 ? '#F59E0B' : '#E94560'
        },
        progress: {
          show: true,
          roundCap: true,
          width: 18
        },
        pointer: {
          show: false
        },
        axisLine: {
          roundCap: true,
          lineStyle: {
            width: 18,
            color: [[1, '#E2E8F0']]
          }
        },
        axisTick: {
          show: false
        },
        splitLine: {
          show: false
        },
        axisLabel: {
          show: false
        },
        title: {
          show: false
        },
        detail: {
          valueAnimation: true,
          formatter: '{value}%',
          fontSize: 32,
          fontWeight: 'bold',
          color: 'inherit',
          offsetCenter: [0, '0%']
        },
        data: [
          {
            value: successRate,
            name: '成功率'
          }
        ]
      }
    ]
  })
}

function generateReport() {
  if (!store.currentSessionId) return
  
  generatingReport.value = true
  
  setTimeout(() => {
    store.generateReport(store.currentSessionId!)
    generatingReport.value = false
    initCharts()
  }, 1500)
}

function exportReport(report: DrillReport, format: 'excel' | 'json') {
  const dataStr = JSON.stringify(report, null, 2)
  const blob = new Blob([dataStr], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `report_${report.reportId}.${format}`
  link.click()
  URL.revokeObjectURL(url)
}

onMounted(() => {
  initCharts()
  
  window.addEventListener('resize', () => {
    conflictChart?.resize()
    successChart?.resize()
  })
})

watch(() => store.currentSessionId, () => {
  updateConflictChart()
  updateSuccessChart()
})
</script>

<template>
  <div class="space-y-6 animate-fade-in">
    <div class="flex items-center justify-between">
      <div>
        <p class="text-slate-500">查看演练统计，生成并导出报告</p>
      </div>
      <button
        @click="generateReport"
        :disabled="!hasData || generatingReport"
        class="btn-primary"
      >
        <FileBarChart class="w-4 h-4 mr-2" />
        {{ generatingReport ? '生成中...' : '生成演练报告' }}
      </button>
    </div>
    
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div class="lg:col-span-2">
        <div class="card h-full">
          <div class="card-header">
            <h3 class="font-semibold text-slate-900 flex items-center gap-2">
              <AlertTriangle class="w-5 h-5 text-danger-600" />
              冲突类型分布
            </h3>
          </div>
          <div class="card-body">
            <div ref="conflictChartRef" class="h-64" />
          </div>
        </div>
      </div>
      
      <div class="card">
        <div class="card-header">
          <h3 class="font-semibold text-slate-900 flex items-center gap-2">
            <TrendingUp class="w-5 h-5 text-success-600" />
            预演成功率
          </h3>
        </div>
        <div class="card-body">
          <div ref="successChartRef" class="h-64" />
        </div>
      </div>
    </div>
    
    <div v-if="store.reports.length > 0" class="card">
      <div class="card-header flex items-center justify-between">
        <h3 class="font-semibold text-slate-900 flex items-center gap-2">
          <FileText class="w-5 h-5 text-primary-600" />
          已生成报告
        </h3>
        <span class="text-sm text-slate-500">共 {{ store.reports.length }} 份报告</span>
      </div>
      <div class="divide-y divide-slate-100">
        <div
          v-for="report in sortedReports"
          :key="report.reportId"
          class="px-6 py-4 hover:bg-slate-50 transition-colors"
        >
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-4">
              <div class="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                <FileBarChart class="w-5 h-5 text-primary-600" />
              </div>
              <div>
                <h4 class="font-medium text-slate-900">
                  演练报告 - {{ report.reportId.slice(0, 8) }}
                </h4>
                <div class="flex items-center gap-4 text-sm text-slate-500 mt-1">
                  <span class="flex items-center gap-1">
                    <Calendar class="w-3.5 h-3.5" />
                    {{ formatDate(report.generatedAt) }}
                  </span>
                  <span>{{ report.statistics.totalRecords }} 条记录</span>
                  <span>{{ Math.round(report.statistics.successRate * 100) }}% 成功率</span>
                </div>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <button
                @click="exportReport(report, 'json')"
                class="btn-secondary px-3 py-1.5 text-sm"
              >
                <Download class="w-4 h-4 mr-1.5" />
                JSON
              </button>
              <button
                @click="exportReport(report, 'excel')"
                class="btn-success px-3 py-1.5 text-sm"
              >
                <Download class="w-4 h-4 mr-1.5" />
                Excel
              </button>
            </div>
          </div>
          
          <div class="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="p-4 bg-info-50 rounded-lg">
              <div class="flex items-start gap-2">
                <Lightbulb class="w-5 h-5 text-info-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p class="font-medium text-info-800">优化建议</p>
                  <ul class="mt-2 text-sm text-info-600 space-y-1">
                    <li
                      v-for="(rec, index) in report.statistics.recommendations.slice(0, 3)"
                      :key="index"
                    >
                      • {{ rec }}
                    </li>
                  </ul>
                </div>
              </div>
            </div>
            
            <div class="p-4 bg-slate-50 rounded-lg">
              <p class="font-medium text-slate-800 mb-2">回滚影响分析</p>
              <div class="space-y-2">
                <div class="flex items-center justify-between text-sm">
                  <span class="text-slate-500">影响记录数</span>
                  <span class="font-medium text-slate-900">{{ report.statistics.rollbackImpact.affectedRecords }}</span>
                </div>
                <div class="flex items-center justify-between text-sm">
                  <span class="text-slate-500">数据丢失风险</span>
                  <span
                    :class="[
                      'font-medium',
                      report.statistics.rollbackImpact.dataLossRisk > 0.5 ? 'text-danger-600' : 'text-success-600'
                    ]"
                  >
                    {{ Math.round(report.statistics.rollbackImpact.dataLossRisk * 100) }}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <div v-else class="card">
      <div class="card-body text-center py-12">
        <FileBarChart class="w-16 h-16 text-slate-300 mx-auto mb-4" />
        <p class="text-slate-500 mb-2">暂无报告</p>
        <p class="text-sm text-slate-400">执行预演导入后生成演练报告</p>
      </div>
    </div>
    
    <div class="card">
      <div class="card-header">
        <h3 class="font-semibold text-slate-900 flex items-center gap-2">
          <CheckCircle class="w-5 h-5 text-success-600" />
          最近会话统计
        </h3>
      </div>
      <div class="card-body">
        <div class="table-container">
          <table class="table">
            <thead>
              <tr>
                <th>会话名称</th>
                <th>状态</th>
                <th>成功数</th>
                <th>冲突数</th>
                <th>成功率</th>
                <th>开始时间</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="store.importSessions.length === 0">
                <td colspan="6" class="text-center text-slate-500 py-8">
                  暂无导入会话
                </td>
              </tr>
              <tr v-for="session in store.importSessions.slice(0, 10)" :key="session.sessionId">
                <td class="font-medium">{{ session.sessionName }}</td>
                <td>
                  <span
                    :class="[
                      'badge',
                      session.status === 'completed' ? 'badge-success' : '',
                      session.status === 'running' ? 'badge-info' : '',
                      session.status === 'failed' ? 'badge-danger' : '',
                      session.status === 'pending' ? 'badge-secondary' : ''
                    ]"
                  >
                    {{ session.status === 'completed' ? '已完成' : session.status === 'running' ? '进行中' : session.status === 'failed' ? '失败' : '待处理' }}
                  </span>
                </td>
                <td>{{ session.successCount }}</td>
                <td>{{ session.conflictCount }}</td>
                <td>
                  <span
                    :class="[
                      'font-medium',
                      (session.successCount / (session.successCount + session.conflictCount || 1)) >= 0.9 ? 'text-success-600' : 'text-warning-600'
                    ]"
                  >
                    {{ Math.round((session.successCount / Math.max(1, session.successCount + session.conflictCount)) * 100) }}%
                  </span>
                </td>
                <td class="text-slate-500">{{ formatDate(session.startedAt) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>
