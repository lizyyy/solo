<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div class="flex items-center space-x-4">
        <router-link to="/" class="text-gray-500 hover:text-gray-700">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
          </svg>
        </router-link>
        <div>
          <h1 class="text-2xl font-bold text-gray-900">{{ experiment?.config?.name || '加载中...' }}</h1>
          <p class="text-gray-500 text-sm">{{ experiment?.config?.description || '' }}</p>
        </div>
      </div>
      <div class="flex items-center space-x-3">
        <span :class="getStatusClass(experiment?.status)" class="badge">
          {{ getStatusText(experiment?.status) }}
        </span>
        <button 
          v-if="experiment?.status === 'created'"
          @click="handleRun"
          class="btn-success"
          :disabled="loading"
        >
          运行实验
        </button>
        <div class="relative" v-if="experiment?.status === 'completed'">
          <button 
            @click="showExportMenu = !showExportMenu"
            class="btn-secondary flex items-center space-x-2"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
            </svg>
            <span>导出</span>
          </button>
          <div v-if="showExportMenu" class="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-10 border border-gray-200">
            <button @click="exportJSON" class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
              导出 JSON
            </button>
            <button @click="exportMarkdown" class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
              导出 Markdown
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="loading" class="flex justify-center py-20">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
    </div>

    <div v-else-if="!experiment" class="card text-center py-12">
      <svg class="mx-auto h-16 w-16 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
      </svg>
      <h3 class="mt-2 text-sm font-medium text-gray-900">实验不存在</h3>
      <p class="mt-1 text-sm text-gray-500">该实验可能已被删除</p>
    </div>

    <div v-else>
      <div class="card">
        <h2 class="text-lg font-semibold text-gray-900 mb-4">实验配置</h2>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div class="p-3 bg-gray-50 rounded-lg">
            <p class="text-xs text-gray-500">连接数</p>
            <p class="text-xl font-semibold text-gray-900">{{ experiment.config.connections }}</p>
          </div>
          <div class="p-3 bg-gray-50 rounded-lg">
            <p class="text-xs text-gray-500">读事件</p>
            <p class="text-xl font-semibold text-purple-600">{{ experiment.config.readEvents }}</p>
          </div>
          <div class="p-3 bg-gray-50 rounded-lg">
            <p class="text-xs text-gray-500">写事件</p>
            <p class="text-xl font-semibold text-amber-600">{{ experiment.config.writeEvents }}</p>
          </div>
          <div class="p-3 bg-gray-50 rounded-lg">
            <p class="text-xs text-gray-500">失败率</p>
            <p class="text-xl font-semibold text-red-600">{{ (experiment.config.failureRate * 100).toFixed(1) }}%</p>
          </div>
        </div>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
          <div class="p-3 bg-gray-50 rounded-lg">
            <p class="text-xs text-gray-500">回调耗时</p>
            <p class="text-lg font-semibold text-gray-900">{{ experiment.config.callbackDelay }}ms</p>
          </div>
          <div class="p-3 bg-gray-50 rounded-lg">
            <p class="text-xs text-gray-500">读超时</p>
            <p class="text-lg font-semibold text-gray-900">{{ experiment.config.readTimeout }}ms</p>
          </div>
          <div class="p-3 bg-gray-50 rounded-lg">
            <p class="text-xs text-gray-500">写超时</p>
            <p class="text-lg font-semibold text-gray-900">{{ experiment.config.writeTimeout }}ms</p>
          </div>
          <div class="p-3 bg-gray-50 rounded-lg">
            <p class="text-xs text-gray-500">线程池大小</p>
            <p class="text-lg font-semibold text-gray-900">{{ experiment.config.threadPoolSize }}</p>
          </div>
        </div>
      </div>

      <div v-if="experiment.status === 'created'" class="card text-center py-8">
        <svg class="mx-auto h-12 w-12 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path>
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <h3 class="mt-4 text-lg font-medium text-gray-900">实验待运行</h3>
        <p class="mt-2 text-sm text-gray-500">点击下方按钮开始对比 Reactor 和 Proactor 模型</p>
        <button 
          @click="handleRun"
          class="mt-4 btn-success flex items-center space-x-2 mx-auto"
          :disabled="loading"
        >
          <svg v-if="loading" class="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>{{ loading ? '运行中...' : '开始运行' }}</span>
        </button>
      </div>

      <div v-else-if="experiment.status === 'running'" class="card">
        <div class="text-center py-8">
          <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-yellow-100 mb-4">
            <svg class="w-8 h-8 text-yellow-600 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
          <h3 class="text-lg font-medium text-gray-900">实验运行中</h3>
          <p class="text-sm text-gray-500 mt-2">正在对比 Reactor 和 Proactor 模型，请稍候...</p>
          <button @click="refreshExperiment" class="mt-4 text-primary-600 hover:text-primary-700 text-sm">
            刷新状态
          </button>
        </div>
      </div>

      <div v-else-if="experiment.status === 'failed'" class="bg-red-50 border border-red-200 rounded-lg p-6">
        <div class="flex items-start">
          <svg class="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <div class="ml-3">
            <h3 class="text-sm font-medium text-red-800">实验运行失败</h3>
            <p class="text-sm text-red-700 mt-1">{{ experiment.error || '未知错误' }}</p>
          </div>
        </div>
      </div>

      <div v-else-if="experiment.status === 'completed'">
        <div class="card">
          <h2 class="text-lg font-semibold text-gray-900 mb-4">结果对比</h2>
          
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="border-2 border-purple-200 rounded-lg p-4">
              <div class="flex items-center justify-between mb-4">
                <div class="flex items-center space-x-2">
                  <span class="w-3 h-3 bg-accent-reactor rounded-full"></span>
                  <h3 class="font-semibold text-gray-900">Reactor</h3>
                </div>
                <span class="text-xs text-gray-500">单线程事件循环</span>
              </div>
              
              <div v-if="experiment.reactorResults" class="space-y-3">
                <div class="flex justify-between text-sm">
                  <span class="text-gray-500">执行时间</span>
                  <span class="font-medium">{{ experiment.reactorResults.executionTime }}ms</span>
                </div>
                <div class="flex justify-between text-sm">
                  <span class="text-gray-500">处理事件数</span>
                  <span class="font-medium">{{ experiment.reactorResults.metrics.eventsProcessed }}</span>
                </div>
                <div class="flex justify-between text-sm">
                  <span class="text-gray-500">失败事件数</span>
                  <span class="font-medium text-red-600">{{ experiment.reactorResults.metrics.eventsFailed }}</span>
                </div>
                <div class="flex justify-between text-sm">
                  <span class="text-gray-500">平均延迟</span>
                  <span class="font-medium">{{ experiment.reactorResults.metrics.avgLatency }}ms</span>
                </div>
                <div class="flex justify-between text-sm">
                  <span class="text-gray-500">吞吐量</span>
                  <span class="font-medium text-green-600">{{ experiment.reactorResults.throughput }} events/s</span>
                </div>
                <div class="flex justify-between text-sm">
                  <span class="text-gray-500">成功率</span>
                  <span class="font-medium">{{ experiment.reactorResults.metrics.successRate }}%</span>
                </div>
              </div>
              <div v-else class="text-center py-4 text-gray-400 text-sm">
                暂无数据
              </div>
            </div>

            <div class="border-2 border-amber-200 rounded-lg p-4">
              <div class="flex items-center justify-between mb-4">
                <div class="flex items-center space-x-2">
                  <span class="w-3 h-3 bg-accent-proactor rounded-full"></span>
                  <h3 class="font-semibold text-gray-900">Proactor</h3>
                </div>
                <span class="text-xs text-gray-500">异步 I/O + 线程池</span>
              </div>
              
              <div v-if="experiment.proactorResults" class="space-y-3">
                <div class="flex justify-between text-sm">
                  <span class="text-gray-500">执行时间</span>
                  <span class="font-medium">{{ experiment.proactorResults.executionTime }}ms</span>
                </div>
                <div class="flex justify-between text-sm">
                  <span class="text-gray-500">处理事件数</span>
                  <span class="font-medium">{{ experiment.proactorResults.metrics.eventsProcessed }}</span>
                </div>
                <div class="flex justify-between text-sm">
                  <span class="text-gray-500">失败事件数</span>
                  <span class="font-medium text-red-600">{{ experiment.proactorResults.metrics.eventsFailed }}</span>
                </div>
                <div class="flex justify-between text-sm">
                  <span class="text-gray-500">平均延迟</span>
                  <span class="font-medium">{{ experiment.proactorResults.metrics.avgLatency }}ms</span>
                </div>
                <div class="flex justify-between text-sm">
                  <span class="text-gray-500">吞吐量</span>
                  <span class="font-medium text-green-600">{{ experiment.proactorResults.throughput }} events/s</span>
                </div>
                <div class="flex justify-between text-sm">
                  <span class="text-gray-500">成功率</span>
                  <span class="font-medium">{{ experiment.proactorResults.metrics.successRate }}%</span>
                </div>
                <div class="flex justify-between text-sm">
                  <span class="text-gray-500">平均线程使用</span>
                  <span class="font-medium">{{ experiment.proactorResults.metrics.avgThreadUsage }} 线程</span>
                </div>
              </div>
              <div v-else class="text-center py-4 text-gray-400 text-sm">
                暂无数据
              </div>
            </div>
          </div>

          <div v-if="experiment.comparison" class="mt-6 p-4 bg-gray-50 rounded-lg">
            <h3 class="font-semibold text-gray-900 mb-3">综合对比</h3>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div class="text-center">
                <p class="text-xs text-gray-500 mb-1">执行时间胜者</p>
                <p :class="experiment.comparison.executionTime.winner === 'Reactor' ? 'text-purple-600 font-bold' : 'text-amber-600 font-bold'">
                  {{ experiment.comparison.executionTime.winner }}
                </p>
                <p class="text-xs text-gray-400">
                  差 {{ Math.abs(experiment.comparison.executionTime.difference).toFixed(0) }}ms
                </p>
              </div>
              <div class="text-center">
                <p class="text-xs text-gray-500 mb-1">吞吐量胜者</p>
                <p :class="experiment.comparison.throughput.winner === 'Reactor' ? 'text-purple-600 font-bold' : 'text-amber-600 font-bold'">
                  {{ experiment.comparison.throughput.winner }}
                </p>
                <p class="text-xs text-gray-400">
                  差 {{ Math.abs(experiment.comparison.throughput.difference).toFixed(2) }} events/s
                </p>
              </div>
              <div class="text-center">
                <p class="text-xs text-gray-500 mb-1">Reactor 线程</p>
                <p class="text-purple-600 font-bold">{{ experiment.comparison.threadUsage.reactor }}</p>
                <p class="text-xs text-gray-400">单线程</p>
              </div>
              <div class="text-center">
                <p class="text-xs text-gray-500 mb-1">Proactor 线程</p>
                <p class="text-amber-600 font-bold">{{ experiment.comparison.threadUsage.proactor }}</p>
                <p class="text-xs text-gray-400">线程池</p>
              </div>
            </div>
          </div>
        </div>

        <div v-if="timeline.length > 0" class="card">
          <h2 class="text-lg font-semibold text-gray-900 mb-4">事件时间线</h2>
          
          <div class="flex items-center space-x-4 mb-4">
            <select v-model="selectedModel" class="form-input w-48">
              <option value="all">全部事件</option>
              <option value="Reactor">仅 Reactor</option>
              <option value="Proactor">仅 Proactor</option>
            </select>
            <span class="text-sm text-gray-500">
              显示 {{ filteredTimeline.length }} 个事件
            </span>
          </div>

          <div class="max-h-96 overflow-y-auto scrollbar-thin">
            <div class="space-y-2">
              <div 
                v-for="(event, index) in filteredTimeline.slice(0, 200)" 
                :key="event.id"
                class="flex items-start space-x-3 p-2 rounded-lg hover:bg-gray-50"
              >
                <div class="flex flex-col items-center">
                  <span 
                    :class="event.model === 'Reactor' ? 'bg-accent-reactor' : 'bg-accent-proactor'"
                    class="w-3 h-3 rounded-full"
                  ></span>
                  <div v-if="index < filteredTimeline.length - 1" class="w-0.5 h-8 bg-gray-200"></div>
                </div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center space-x-2">
                    <span class="text-xs font-medium" :class="event.model === 'Reactor' ? 'text-purple-600' : 'text-amber-600'">
                      {{ event.model }}
                    </span>
                    <span class="text-xs text-gray-500">{{ event.type }}</span>
                    <span 
                      :class="event.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'"
                      class="badge"
                    >
                      {{ event.status === 'completed' ? '成功' : '失败' }}
                    </span>
                  </div>
                  <p class="text-xs text-gray-500 mt-1">
                    连接: {{ event.data?.connectionId }} | 
                    时间: {{ formatTime(event.timestamp) }}
                  </p>
                  <p v-if="event.error" class="text-xs text-red-500 mt-1">
                    错误: {{ event.error.message || JSON.stringify(event.error) }}
                  </p>
                </div>
              </div>
            </div>
            <div v-if="filteredTimeline.length > 200" class="text-center py-4 text-sm text-gray-500">
              仅显示前 200 个事件，共 {{ filteredTimeline.length }} 个
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useExperimentStore } from '@/stores/experimentStore'
import { experimentApi } from '@/api'
import dayjs from 'dayjs'

const route = useRoute()
const router = useRouter()
const store = useExperimentStore()

const experiment = ref(null)
const timeline = ref([])
const loading = ref(false)
const showExportMenu = ref(false)
const selectedModel = ref('all')

const filteredTimeline = computed(() => {
  if (selectedModel.value === 'all') {
    return timeline.value
  }
  return timeline.value.filter(e => e.model === selectedModel.value)
})

const getStatusClass = (status) => {
  const classes = {
    created: 'badge-info',
    running: 'status-running badge',
    completed: 'status-completed badge',
    failed: 'status-failed badge'
  }
  return classes[status] || 'badge-info'
}

const getStatusText = (status) => {
  const texts = {
    created: '待运行',
    running: '运行中',
    completed: '已完成',
    failed: '失败'
  }
  return texts[status] || status
}

const formatTime = (timestamp) => {
  return dayjs(timestamp).format('HH:mm:ss.SSS')
}

const refreshExperiment = async () => {
  loading.value = true
  try {
    await store.fetchExperiment(route.params.id)
    experiment.value = store.currentExperiment
    
    if (experiment.value?.status === 'completed') {
      const timelineResponse = await experimentApi.getTimeline(route.params.id)
      if (timelineResponse.data.success) {
        timeline.value = timelineResponse.data.data.events
      }
    }
  } catch (error) {
    console.error('Failed to refresh experiment:', error)
  } finally {
    loading.value = false
  }
}

const handleRun = async () => {
  loading.value = true
  try {
    await store.runExperiment(route.params.id)
    await refreshExperiment()
  } catch (error) {
    console.error('Failed to run experiment:', error)
  } finally {
    loading.value = false
  }
}

const exportJSON = async () => {
  try {
    const response = await experimentApi.exportJSON(route.params.id)
    const url = window.URL.createObjectURL(new Blob([response.data]))
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `experiment-${route.params.id}.json`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  } catch (error) {
    console.error('Failed to export JSON:', error)
  }
  showExportMenu.value = false
}

const exportMarkdown = async () => {
  try {
    const response = await experimentApi.exportMarkdown(route.params.id)
    const url = window.URL.createObjectURL(new Blob([response.data]))
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `experiment-${route.params.id}.md`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  } catch (error) {
    console.error('Failed to export Markdown:', error)
  }
  showExportMenu.value = false
}

onMounted(async () => {
  await refreshExperiment()
})

document.addEventListener('click', (e) => {
  if (!e.target.closest('.relative')) {
    showExportMenu.value = false
  }
})
</script>
