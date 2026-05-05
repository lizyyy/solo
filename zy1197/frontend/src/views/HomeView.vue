<template>
  <div class="space-y-6">
    <div class="flex justify-between items-center">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">实验列表</h1>
        <p class="text-gray-500 mt-1">管理和对比 Reactor 与 Proactor 网络模型实验</p>
      </div>
      <router-link to="/create" class="btn-primary flex items-center space-x-2">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
        </svg>
        <span>创建实验</span>
      </router-link>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div class="card">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-gray-500">总实验数</p>
            <p class="text-2xl font-bold text-gray-900">{{ experiments.length }}</p>
          </div>
          <div class="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
            <svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
            </svg>
          </div>
        </div>
      </div>
      
      <div class="card">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-gray-500">已完成</p>
            <p class="text-2xl font-bold text-green-600">{{ statusCounts.completed }}</p>
          </div>
          <div class="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
            <svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
            </svg>
          </div>
        </div>
      </div>
      
      <div class="card">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-gray-500">运行中</p>
            <p class="text-2xl font-bold text-yellow-600">{{ statusCounts.running }}</p>
          </div>
          <div class="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
            <svg class="w-6 h-6 text-yellow-600 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
            </svg>
          </div>
        </div>
      </div>
      
      <div class="card">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-gray-500">失败</p>
            <p class="text-2xl font-bold text-red-600">{{ statusCounts.failed }}</p>
          </div>
          <div class="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
            <svg class="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <h2 class="text-lg font-semibold text-gray-900 mb-4">快速开始</h2>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div 
          v-for="config in quickStartConfigs" 
          :key="config.name"
          class="p-4 border border-gray-200 rounded-lg hover:border-primary-300 hover:bg-primary-50 cursor-pointer transition-colors"
          @click="useQuickStart(config)"
        >
          <div class="flex items-center justify-between mb-2">
            <h3 class="font-medium text-gray-900">{{ config.name }}</h3>
            <span :class="getDifficultyClass(config.difficulty)" class="badge">
              {{ getDifficultyText(config.difficulty) }}
            </span>
          </div>
          <p class="text-sm text-gray-500 mb-3">{{ config.description }}</p>
          <div class="flex items-center justify-between text-xs text-gray-400">
            <span>连接数: {{ config.connections }}</span>
            <span>事件数: {{ config.readEvents + config.writeEvents }}</span>
            <span>预计: {{ config.estimatedTime }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-lg font-semibold text-gray-900">所有实验</h2>
        <button 
          @click="fetchExperiments"
          class="text-sm text-primary-600 hover:text-primary-700 flex items-center space-x-1"
          :disabled="loading"
        >
          <svg class="w-4 h-4" :class="loading ? 'animate-spin' : ''" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
          </svg>
          <span>刷新</span>
        </button>
      </div>

      <div v-if="loading" class="flex justify-center py-12">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>

      <div v-else-if="experiments.length === 0" class="text-center py-12">
        <svg class="mx-auto h-16 w-16 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"></path>
        </svg>
        <h3 class="mt-2 text-sm font-medium text-gray-900">暂无实验</h3>
        <p class="mt-1 text-sm text-gray-500">创建一个新实验开始对比 Reactor 和 Proactor</p>
        <div class="mt-6">
          <router-link to="/create" class="btn-primary">
            创建第一个实验
          </router-link>
        </div>
      </div>

      <div v-else class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">实验名称</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">配置</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">创建时间</th>
              <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr v-for="exp in experiments" :key="exp.id" class="hover:bg-gray-50">
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm font-medium text-gray-900">{{ exp.name }}</div>
                <div class="text-sm text-gray-500">{{ exp.description || '无描述' }}</div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex items-center space-x-2 text-sm text-gray-500">
                  <span class="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100">
                    {{ exp.config.connections }} 连接
                  </span>
                  <span class="inline-flex items-center px-2 py-0.5 rounded text-xs bg-purple-100 text-purple-800">
                    {{ exp.config.readEvents }} 读
                  </span>
                  <span class="inline-flex items-center px-2 py-0.5 rounded text-xs bg-amber-100 text-amber-800">
                    {{ exp.config.writeEvents }} 写
                  </span>
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span :class="getStatusClass(exp.status)" class="badge">
                  {{ getStatusText(exp.status) }}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {{ formatDate(exp.createdAt) }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <div class="flex items-center justify-end space-x-3">
                  <router-link 
                    :to="`/experiment/${exp.id}`"
                    class="text-primary-600 hover:text-primary-900"
                  >
                    查看
                  </router-link>
                  <button 
                    v-if="exp.status === 'created'"
                    @click="runExperiment(exp.id)"
                    class="text-green-600 hover:text-green-900"
                    :disabled="loading"
                  >
                    运行
                  </button>
                  <button 
                    @click="deleteExperiment(exp.id)"
                    class="text-red-600 hover:text-red-900"
                    :disabled="loading"
                  >
                    删除
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useExperimentStore } from '@/stores/experimentStore'
import dayjs from 'dayjs'

const router = useRouter()
const store = useExperimentStore()

const experiments = computed(() => store.experiments)
const statusCounts = computed(() => store.statusCounts)
const seedData = computed(() => store.seedData)
const loading = computed(() => store.loading)

const quickStartConfigs = computed(() => seedData.value?.quickStartConfigs || [])

onMounted(async () => {
  await store.fetchExperiments()
  await store.fetchSeedData()
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

const getDifficultyClass = (difficulty) => {
  const classes = {
    beginner: 'bg-green-100 text-green-800',
    intermediate: 'bg-blue-100 text-blue-800',
    advanced: 'bg-purple-100 text-purple-800'
  }
  return classes[difficulty] || 'bg-gray-100 text-gray-800'
}

const getDifficultyText = (difficulty) => {
  const texts = {
    beginner: '入门',
    intermediate: '中级',
    advanced: '高级'
  }
  return texts[difficulty] || difficulty
}

const formatDate = (timestamp) => {
  return dayjs(timestamp).format('YYYY-MM-DD HH:mm')
}

const useQuickStart = (config) => {
  router.push({
    path: '/create',
    query: { preset: JSON.stringify(config) }
  })
}

const runExperiment = async (id) => {
  try {
    await store.runExperiment(id)
  } catch (error) {
    console.error('Failed to run experiment:', error)
  }
}

const deleteExperiment = async (id) => {
  if (confirm('确定要删除这个实验吗？')) {
    try {
      await store.deleteExperiment(id)
    } catch (error) {
      console.error('Failed to delete experiment:', error)
    }
  }
}
</script>
