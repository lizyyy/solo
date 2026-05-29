<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  History,
  Search,
  User,
  Clock,
  ArrowRight,
  Edit3,
  Trash2,
  PlusCircle,
  RotateCcw,
  Filter,
  ChevronDown,
  ChevronUp
} from 'lucide-vue-next'
import { useImportStore } from '../stores/importStore'
import { formatDate } from '../utils'
import type { ActionType } from '../types'

const store = useImportStore()

const searchTerm = ref('')
const showFilters = ref(false)
const filterActions = ref<ActionType[]>([])
const expandedRecordId = ref<string | null>(null)

const actionTypes: { value: ActionType; label: string; icon: any; color: string }[] = [
  { value: 'create', label: '创建', icon: PlusCircle, color: 'success' },
  { value: 'update', label: '更新', icon: Edit3, color: 'primary' },
  { value: 'delete', label: '删除', icon: Trash2, color: 'danger' },
  { value: 'rollback', label: '回滚', icon: RotateCcw, color: 'warning' }
]

const allLogs = computed(() => {
  return [...store.changeLogs].sort(
    (a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime()
  )
})

const filteredLogs = computed(() => {
  return allLogs.value.filter(log => {
    if (searchTerm.value) {
      const search = searchTerm.value.toLowerCase()
      return (
        log.recordId.toLowerCase().includes(search) ||
        log.changedBy.toLowerCase().includes(search) ||
        (log.oldValue?.toLowerCase().includes(search) || false) ||
        (log.newValue?.toLowerCase().includes(search) || false)
      )
    }
    
    if (filterActions.value.length > 0 && !filterActions.value.includes(log.actionType)) {
      return false
    }
    
    return true
  })
})

const logsByRecord = computed(() => {
  const groups: Record<string, typeof filteredLogs.value> = {}
  filteredLogs.value.forEach(log => {
    if (!groups[log.recordId]) {
      groups[log.recordId] = []
    }
    groups[log.recordId].push(log)
  })
  return groups
})

function getActionInfo(action: ActionType) {
  return actionTypes.find(a => a.value === action) || actionTypes[0]
}

function toggleFilterAction(action: ActionType) {
  const index = filterActions.value.indexOf(action)
  if (index > -1) {
    filterActions.value.splice(index, 1)
  } else {
    filterActions.value.push(action)
  }
}

function toggleExpand(recordId: string) {
  expandedRecordId.value = expandedRecordId.value === recordId ? null : recordId
}

function clearFilters() {
  filterActions.value = []
  searchTerm.value = ''
}
</script>

<template>
  <div class="space-y-6 animate-fade-in">
    <div class="card">
      <div class="card-header flex items-center justify-between">
        <h3 class="font-semibold text-slate-900 flex items-center gap-2">
          <History class="w-5 h-5 text-primary-600" />
          操作日志审计
        </h3>
        <div class="flex items-center gap-3">
          <div class="relative">
            <Search class="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              v-model="searchTerm"
              type="text"
              placeholder="搜索记录..."
              class="input pl-9 w-64"
            />
          </div>
          <button
            @click="showFilters = !showFilters"
            :class="[
              'btn-secondary',
              showFilters ? 'border-primary-300 bg-primary-50' : ''
            ]"
          >
            <Filter class="w-4 h-4 mr-2" />
            筛选
          </button>
        </div>
      </div>
      
      <div v-if="showFilters" class="px-6 py-4 border-b border-slate-200 bg-slate-50">
        <label class="label">操作类型</label>
        <div class="flex flex-wrap gap-2 mt-2">
          <button
            v-for="action in actionTypes"
            :key="action.value"
            @click="toggleFilterAction(action.value)"
            :class="[
              'px-3 py-1.5 rounded-lg text-sm transition-all flex items-center gap-1.5',
              filterActions.includes(action.value)
                ? 'bg-primary-100 text-primary-700 font-medium'
                : 'bg-white border border-slate-200 text-slate-600 hover:border-primary-300'
            ]"
          >
            <component :is="action.icon" class="w-3.5 h-3.5" />
            {{ action.label }}
          </button>
        </div>
        <div class="mt-4 flex justify-end">
          <button @click="clearFilters" class="text-sm text-slate-500 hover:text-slate-700">
            清除筛选
          </button>
        </div>
      </div>
      
      <div class="divide-y divide-slate-100">
        <div v-if="filteredLogs.length === 0" class="p-12 text-center">
          <History class="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p class="text-slate-500">暂无操作记录</p>
        </div>
        
        <div v-for="(logs, recordId) in logsByRecord" :key="recordId">
          <div
            @click="toggleExpand(recordId)"
            class="px-6 py-4 hover:bg-slate-50 cursor-pointer flex items-center justify-between"
          >
            <div class="flex items-center gap-4">
              <div class="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                <span class="text-sm font-medium text-primary-600">
                  {{ logs.length }}
                </span>
              </div>
              <div>
                <h4 class="font-medium text-slate-900">记录 {{ recordId.slice(0, 12) }}...</h4>
                <p class="text-sm text-slate-500">{{ logs.length }} 次变更</p>
              </div>
            </div>
            <ChevronDown
              v-if="expandedRecordId !== recordId"
              class="w-5 h-5 text-slate-400"
            />
            <ChevronUp v-else class="w-5 h-5 text-slate-400" />
          </div>
          
          <div v-if="expandedRecordId === recordId" class="bg-slate-50 border-t border-slate-200">
            <div class="relative px-6 py-4">
              <div class="absolute left-10 top-4 bottom-4 w-0.5 bg-slate-200" />
              
              <div class="space-y-4">
                <div
                  v-for="log in logs"
                  :key="log.logId"
                  class="relative pl-12"
                >
                  <div
                    :class="[
                      'absolute left-8 w-4 h-4 rounded-full border-4 bg-white -translate-x-1/2',
                      getActionInfo(log.actionType).color === 'success' ? 'border-success-500' : '',
                      getActionInfo(log.actionType).color === 'primary' ? 'border-primary-500' : '',
                      getActionInfo(log.actionType).color === 'danger' ? 'border-danger-500' : '',
                      getActionInfo(log.actionType).color === 'warning' ? 'border-warning-500' : ''
                    ]"
                  />
                  
                  <div class="p-4 bg-white rounded-lg border border-slate-200">
                    <div class="flex items-start justify-between mb-2">
                      <div class="flex items-center gap-2">
                        <span
                          :class="[
                            'badge',
                            getActionInfo(log.actionType).color === 'success' ? 'badge-success' : '',
                            getActionInfo(log.actionType).color === 'primary' ? 'badge-info' : '',
                            getActionInfo(log.actionType).color === 'danger' ? 'badge-danger' : '',
                            getActionInfo(log.actionType).color === 'warning' ? 'badge-warning' : ''
                          ]"
                        >
                          <component :is="getActionInfo(log.actionType).icon" class="w-3 h-3 mr-1" />
                          {{ getActionInfo(log.actionType).label }}
                        </span>
                      </div>
                      <div class="flex items-center gap-4 text-sm text-slate-500">
                        <span class="flex items-center gap-1">
                          <Clock class="w-3.5 h-3.5" />
                          {{ formatDate(log.changedAt) }}
                        </span>
                        <span class="flex items-center gap-1">
                          <User class="w-3.5 h-3.5" />
                          {{ log.changedBy }}
                        </span>
                      </div>
                    </div>
                    
                    <div v-if="log.fieldName || log.oldValue || log.newValue" class="mt-3 grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div v-if="log.fieldName" class="p-3 bg-slate-50 rounded-lg">
                        <p class="text-xs text-slate-500">字段</p>
                        <p class="font-mono text-sm text-slate-900 mt-1">{{ log.fieldName }}</p>
                      </div>
                      <div v-if="log.oldValue" class="p-3 bg-danger-50 rounded-lg">
                        <p class="text-xs text-slate-500">变更前</p>
                        <p class="font-mono text-sm text-danger-700 mt-1">{{ log.oldValue }}</p>
                      </div>
                      <div v-if="log.newValue" class="p-3 bg-success-50 rounded-lg">
                        <p class="text-xs text-slate-500">变更后</p>
                        <p class="font-mono text-sm text-success-700 mt-1">{{ log.newValue }}</p>
                      </div>
                    </div>
                    
                    <div class="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                      <span class="text-xs text-slate-400">
                        来源会话: {{ log.sourceSession.slice(0, 16) }}...
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <div class="card">
      <div class="card-header">
        <h3 class="font-semibold text-slate-900">文件版本历史</h3>
      </div>
      <div class="card-body">
        <div v-if="store.csvFiles.length === 0" class="text-center py-8">
          <p class="text-slate-500">暂无上传文件</p>
        </div>
        
        <div v-else class="space-y-3">
          <div
            v-for="file in store.csvFiles"
            :key="file.fileId"
            class="p-4 border border-slate-200 rounded-lg hover:border-primary-300 transition-colors"
          >
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-4">
                <div class="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                  <span class="text-xs font-bold text-primary-600">{{ file.versionNo }}</span>
                </div>
                <div>
                  <h4 class="font-medium text-slate-900">{{ file.fileName }}</h4>
                  <div class="flex items-center gap-4 text-sm text-slate-500 mt-1">
                    <span>{{ file.totalRows }} 行数据</span>
                    <span>{{ formatDate(file.uploadedAt) }}</span>
                    <span>{{ file.uploadedBy }}</span>
                  </div>
                </div>
              </div>
              <div class="flex items-center gap-2">
                <span class="badge-success">最新版本</span>
                <span class="text-xs text-slate-400 font-mono">MD5: {{ file.fileHash.slice(0, 8) }}...</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
