<template>
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
    <div class="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
      <!-- 头部 -->
      <div class="flex items-center justify-between p-6 border-b border-gray-200">
        <h2 class="text-xl font-semibold text-gray-800 flex items-center">
          <AlertTriangle class="w-6 h-6 mr-2 text-red-600" />
          问题列表
          <span
            v-if="bookStore.activeIssues.length > 0"
            class="ml-2 px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 rounded-full"
          >
            {{ bookStore.activeIssues.length }} 待处理
          </span>
        </h2>
        <button
          @click="$emit('close')"
          class="p-2 hover:bg-gray-100 rounded-lg transition"
        >
          <X class="w-5 h-5 text-gray-500" />
        </button>
      </div>

      <!-- 筛选标签 -->
      <div class="px-6 py-3 border-b border-gray-200 flex items-center space-x-2">
        <button
          @click="filterStatus = 'all'"
          class="px-3 py-1.5 text-sm font-medium rounded-lg transition"
          :class="filterStatus === 'all' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'"
        >
          全部 ({{ bookStore.issues.length }})
        </button>
        <button
          @click="filterStatus = 'active'"
          class="px-3 py-1.5 text-sm font-medium rounded-lg transition"
          :class="filterStatus === 'active' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'"
        >
          待处理 ({{ bookStore.activeIssues.length }})
        </button>
        <button
          @click="filterStatus = 'resolved'"
          class="px-3 py-1.5 text-sm font-medium rounded-lg transition"
          :class="filterStatus === 'resolved' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'"
        >
          已解决 ({{ resolvedCount }})
        </button>
      </div>

      <!-- 问题列表 -->
      <div class="flex-1 overflow-y-auto p-6">
        <div v-if="filteredIssues.length > 0" class="space-y-4">
          <div
            v-for="issue in filteredIssues"
            :key="issue.id"
            class="border rounded-lg p-4 transition hover:shadow-md"
            :class="issue.resolved ? 'border-gray-200 bg-gray-50' : 'border-red-200 bg-red-50'"
          >
            <div class="flex items-start justify-between">
              <div class="flex-1">
                <div class="flex items-center space-x-2 mb-2">
                  <span
                    class="px-2 py-0.5 text-xs font-medium rounded-full"
                    :class="issue.resolved ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'"
                  >
                    {{ issue.resolved ? '已解决' : '待处理' }}
                  </span>
                  <span class="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 rounded-full">
                    {{ issue.type }}
                  </span>
                </div>
                <p class="text-sm font-medium text-gray-800 mb-2">{{ issue.message }}</p>
                <p class="text-xs text-gray-500">
                  创建时间: {{ formatTime(issue.createdAt) }}
                  <span v-if="issue.resolvedAt" class="ml-3">
                    解决时间: {{ formatTime(issue.resolvedAt) }}
                  </span>
                </p>
              </div>
              <button
                v-if="!issue.resolved"
                @click="resolveIssue(issue.id)"
                class="ml-4 p-2 text-green-600 hover:bg-green-100 rounded-lg transition"
                title="标记为已解决"
              >
                <CheckCircle class="w-5 h-5" />
              </button>
            </div>

            <!-- 详细信息 -->
            <div
              v-if="Object.keys(issue.details).length > 0"
              class="mt-3 pt-3 border-t border-gray-200"
            >
              <button
                @click="expandedDetails[issue.id] = !expandedDetails[issue.id]"
                class="text-xs text-gray-500 hover:text-gray-700 flex items-center"
              >
                <component
                  :is="expandedDetails[issue.id] ? ChevronUp : ChevronDown"
                  class="w-3 h-3 mr-1"
                />
                {{ expandedDetails[issue.id] ? '收起' : '展开' }}详细信息
              </button>
              <div
                v-if="expandedDetails[issue.id]"
                class="mt-2 p-2 bg-gray-100 rounded text-xs text-gray-600 font-mono overflow-x-auto"
              >
                <pre>{{ JSON.stringify(issue.details, null, 2) }}</pre>
              </div>
            </div>
          </div>
        </div>

        <!-- 空状态 -->
        <div v-else class="text-center py-12">
          <CheckCircle class="w-12 h-12 text-green-300 mx-auto mb-4" />
          <p class="text-gray-500">
            {{ filterStatus === 'active' ? '暂无待处理问题' : '暂无问题记录' }}
          </p>
        </div>
      </div>

      <!-- 底部 -->
      <div class="p-6 border-t border-gray-200 flex items-center justify-between">
        <p class="text-xs text-gray-500">
          所有异常操作都会被记录在这里，不会静默跳过
        </p>
        <button
          @click="$emit('close')"
          class="px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition"
        >
          关闭
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, reactive } from 'vue'
import { useBookStore } from '../stores/bookStore'
import {
  AlertTriangle,
  X,
  CheckCircle,
  ChevronDown,
  ChevronUp
} from 'lucide-vue-next'

defineEmits(['close'])

const bookStore = useBookStore()

const filterStatus = ref('all')
const expandedDetails = reactive({})

const resolvedCount = computed(() => {
  return bookStore.issues.filter(i => i.resolved).length
})

const filteredIssues = computed(() => {
  if (filterStatus.value === 'all') return bookStore.issues
  if (filterStatus.value === 'active') return bookStore.activeIssues
  return bookStore.issues.filter(i => i.resolved)
})

const resolveIssue = (issueId) => {
  bookStore.resolveIssue(issueId)
}

const formatTime = (timestamp) => {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}
</script>
