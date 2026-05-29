<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  AlertTriangle,
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  Eye,
  Check,
  X,
  Clock,
  AlertCircle,
  AlertOctagon,
  Info
} from 'lucide-vue-next'
import { useImportStore } from '../stores/importStore'
import { getConflictTypeLabel, getSeverityColor, formatDate } from '../utils'
import type { ConflictType, ConflictSeverity, ConflictStatus } from '../types'

const store = useImportStore()

const searchTerm = ref('')
const showFilters = ref(false)
const expandedConflictId = ref<string | null>(null)
const showDetailModal = ref(false)

const filterTypes = ref<ConflictType[]>([])
const filterSeverities = ref<ConflictSeverity[]>([])
const filterStatuses = ref<ConflictStatus[]>([])

const conflictTypes: { value: ConflictType; label: string }[] = [
  { value: 'duplicate_primary_key', label: '主键重复' },
  { value: 'partial_success', label: '部分成功' },
  { value: 'rollback_scope_error', label: '回滚范围错误' },
  { value: 'field_validation', label: '字段验证' },
  { value: 'data_type_mismatch', label: '数据类型不匹配' }
]

const severities: { value: ConflictSeverity; label: string; icon: any }[] = [
  { value: 'high', label: '高风险', icon: AlertOctagon },
  { value: 'medium', label: '中风险', icon: AlertTriangle },
  { value: 'low', label: '低风险', icon: Info }
]

const statuses: { value: ConflictStatus; label: string }[] = [
  { value: 'open', label: '待处理' },
  { value: 'resolved', label: '已解决' },
  { value: 'ignored', label: '已忽略' }
]

const filteredConflicts = computed(() => {
  return store.conflicts.filter(conflict => {
    if (searchTerm.value) {
      const search = searchTerm.value.toLowerCase()
      const matchSearch = 
        conflict.conflictMessage.toLowerCase().includes(search) ||
        String(conflict.originalLineNo).includes(search)
      if (!matchSearch) return false
    }
    
    if (filterTypes.value.length > 0 && !filterTypes.value.includes(conflict.conflictType)) {
      return false
    }
    
    if (filterSeverities.value.length > 0 && !filterSeverities.value.includes(conflict.severity)) {
      return false
    }
    
    if (filterStatuses.value.length > 0 && !filterStatuses.value.includes(conflict.status)) {
      return false
    }
    
    return true
  })
})

function toggleExpand(conflictId: string) {
  expandedConflictId.value = expandedConflictId.value === conflictId ? null : conflictId
}

function viewDetail(conflictId: string) {
  store.selectedConflictId = conflictId
  showDetailModal.value = true
}

function resolveConflict(conflictId: string) {
  store.resolveConflict(conflictId, '手动确认解决')
}

function ignoreConflict(conflictId: string) {
  const conflict = store.conflicts.find(c => c.conflictId === conflictId)
  if (conflict) {
    conflict.status = 'ignored'
  }
}

function toggleFilterType(type: ConflictType) {
  const index = filterTypes.value.indexOf(type)
  if (index > -1) {
    filterTypes.value.splice(index, 1)
  } else {
    filterTypes.value.push(type)
  }
}

function toggleFilterSeverity(severity: ConflictSeverity) {
  const index = filterSeverities.value.indexOf(severity)
  if (index > -1) {
    filterSeverities.value.splice(index, 1)
  } else {
    filterSeverities.value.push(severity)
  }
}

function toggleFilterStatus(status: ConflictStatus) {
  const index = filterStatuses.value.indexOf(status)
  if (index > -1) {
    filterStatuses.value.splice(index, 1)
  } else {
    filterStatuses.value.push(status)
  }
}

function clearFilters() {
  filterTypes.value = []
  filterSeverities.value = []
  filterStatuses.value = []
  searchTerm.value = ''
}

function getSeverityIcon(severity: ConflictSeverity) {
  return severities.find(s => s.value === severity)?.icon || Info
}
</script>

<template>
  <div class="space-y-6 animate-fade-in">
    <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
      <div class="card">
        <div class="card-body">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-slate-500">总冲突数</p>
              <p class="text-2xl font-bold text-slate-900 mt-1">{{ store.conflictStats.total }}</p>
            </div>
            <div class="w-12 h-12 bg-danger-100 rounded-xl flex items-center justify-center">
              <AlertTriangle class="w-6 h-6 text-danger-600" />
            </div>
          </div>
        </div>
      </div>
      <div class="card">
        <div class="card-body">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-slate-500">待处理</p>
              <p class="text-2xl font-bold text-warning-600 mt-1">{{ store.conflictStats.byStatus.open }}</p>
            </div>
            <div class="w-12 h-12 bg-warning-100 rounded-xl flex items-center justify-center">
              <Clock class="w-6 h-6 text-warning-600" />
            </div>
          </div>
        </div>
      </div>
      <div class="card">
        <div class="card-body">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-slate-500">已解决</p>
              <p class="text-2xl font-bold text-success-600 mt-1">{{ store.conflictStats.byStatus.resolved }}</p>
            </div>
            <div class="w-12 h-12 bg-success-100 rounded-xl flex items-center justify-center">
              <Check class="w-6 h-6 text-success-600" />
            </div>
          </div>
        </div>
      </div>
      <div class="card">
        <div class="card-body">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-slate-500">高风险</p>
              <p class="text-2xl font-bold text-danger-600 mt-1">{{ store.conflictStats.bySeverity.high }}</p>
            </div>
            <div class="w-12 h-12 bg-danger-100 rounded-xl flex items-center justify-center">
              <AlertOctagon class="w-6 h-6 text-danger-600" />
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <div class="card">
      <div class="card-header flex items-center justify-between">
        <h3 class="font-semibold text-slate-900 flex items-center gap-2">
          <AlertTriangle class="w-5 h-5 text-danger-600" />
          冲突队列
        </h3>
        <div class="flex items-center gap-3">
          <div class="relative">
            <Search class="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              v-model="searchTerm"
              type="text"
              placeholder="搜索冲突..."
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
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label class="label">冲突类型</label>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="type in conflictTypes"
                :key="type.value"
                @click="toggleFilterType(type.value)"
                :class="[
                  'px-3 py-1.5 rounded-lg text-sm transition-all',
                  filterTypes.includes(type.value)
                    ? 'bg-primary-100 text-primary-700 font-medium'
                    : 'bg-white border border-slate-200 text-slate-600 hover:border-primary-300'
                ]"
              >
                {{ type.label }}
              </button>
            </div>
          </div>
          <div>
            <label class="label">严重程度</label>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="severity in severities"
                :key="severity.value"
                @click="toggleFilterSeverity(severity.value)"
                :class="[
                  'px-3 py-1.5 rounded-lg text-sm transition-all flex items-center gap-1.5',
                  filterSeverities.includes(severity.value)
                    ? 'bg-primary-100 text-primary-700 font-medium'
                    : 'bg-white border border-slate-200 text-slate-600 hover:border-primary-300'
                ]"
              >
                <component :is="severity.icon" class="w-3.5 h-3.5" />
                {{ severity.label }}
              </button>
            </div>
          </div>
          <div>
            <label class="label">处理状态</label>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="status in statuses"
                :key="status.value"
                @click="toggleFilterStatus(status.value)"
                :class="[
                  'px-3 py-1.5 rounded-lg text-sm transition-all',
                  filterStatuses.includes(status.value)
                    ? 'bg-primary-100 text-primary-700 font-medium'
                    : 'bg-white border border-slate-200 text-slate-600 hover:border-primary-300'
                ]"
              >
                {{ status.label }}
              </button>
            </div>
          </div>
        </div>
        <div class="mt-4 flex justify-end">
          <button @click="clearFilters" class="text-sm text-slate-500 hover:text-slate-700">
            清除所有筛选
          </button>
        </div>
      </div>
      
      <div class="divide-y divide-slate-100">
        <div v-if="filteredConflicts.length === 0" class="p-12 text-center">
          <Check class="w-12 h-12 text-success-300 mx-auto mb-3" />
          <p class="text-slate-500">暂无冲突记录</p>
        </div>
        
        <div
          v-for="conflict in filteredConflicts"
          :key="conflict.conflictId"
          class="hover:bg-slate-50 transition-colors"
        >
          <div class="px-6 py-4">
            <div class="flex items-start justify-between">
              <div class="flex items-start gap-4 flex-1">
                <div
                  :class="[
                    'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0',
                    conflict.severity === 'high' ? 'bg-danger-100' : '',
                    conflict.severity === 'medium' ? 'bg-warning-100' : '',
                    conflict.severity === 'low' ? 'bg-info-100' : ''
                  ]"
                >
                  <component
                    :is="getSeverityIcon(conflict.severity)"
                    :class="[
                      'w-5 h-5',
                      conflict.severity === 'high' ? 'text-danger-600' : '',
                      conflict.severity === 'medium' ? 'text-warning-600' : '',
                      conflict.severity === 'low' ? 'text-info-600' : ''
                    ]"
                  />
                </div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 mb-1">
                    <h4 class="font-medium text-slate-900">{{ conflict.conflictMessage }}</h4>
                    <span
                      :class="[
                        'badge',
                        conflict.status === 'open' ? 'badge-warning' : '',
                        conflict.status === 'resolved' ? 'badge-success' : '',
                        conflict.status === 'ignored' ? 'badge-secondary' : ''
                      ]"
                    >
                      {{ statuses.find(s => s.value === conflict.status)?.label }}
                    </span>
                  </div>
                  <div class="flex items-center gap-4 text-sm text-slate-500">
                    <span class="font-mono bg-slate-100 px-2 py-0.5 rounded">
                      行号: {{ conflict.originalLineNo }}
                    </span>
                    <span>{{ getConflictTypeLabel(conflict.conflictType) }}</span>
                    <span>{{ formatDate(conflict.createdAt) }}</span>
                  </div>
                </div>
              </div>
              <div class="flex items-center gap-2 ml-4">
                <button @click="viewDetail(conflict.conflictId)" class="btn-secondary px-3 py-1.5 text-sm">
                  <Eye class="w-4 h-4 mr-1.5" />
                  详情
                </button>
                <button
                  v-if="conflict.status === 'open'"
                  @click="resolveConflict(conflict.conflictId)"
                  class="btn-success px-3 py-1.5 text-sm"
                >
                  <Check class="w-4 h-4 mr-1.5" />
                  解决
                </button>
                <button
                  v-if="conflict.status === 'open'"
                  @click="ignoreConflict(conflict.conflictId)"
                  class="btn-secondary px-3 py-1.5 text-sm"
                >
                  <X class="w-4 h-4 mr-1.5" />
                  忽略
                </button>
                <button
                  @click="toggleExpand(conflict.conflictId)"
                  class="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <ChevronDown v-if="expandedConflictId !== conflict.conflictId" class="w-4 h-4 text-slate-400" />
                  <ChevronUp v-else class="w-4 h-4 text-slate-400" />
                </button>
              </div>
            </div>
            
            <div
              v-if="expandedConflictId === conflict.conflictId"
              class="mt-4 ml-14 p-4 bg-slate-50 rounded-lg border border-slate-200"
            >
              <h5 class="text-sm font-medium text-slate-700 mb-2">原始数据</h5>
              <div class="overflow-x-auto">
                <table class="text-sm">
                  <tbody>
                    <tr v-for="(value, key) in conflict.conflictingData" :key="key">
                      <td class="pr-4 py-1 font-medium text-slate-600">{{ key }}</td>
                      <td class="py-1 font-mono text-slate-800">
                        {{ typeof value === 'object' ? JSON.stringify(value, null, 2) : value }}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <Teleport to="body">
      <div
        v-if="showDetailModal"
        class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
        @click.self="showDetailModal = false"
      >
        <div class="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col animate-slide-in">
          <div class="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <h3 class="font-semibold text-slate-900">冲突详情</h3>
            <button
              @click="showDetailModal = false"
              class="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X class="w-5 h-5 text-slate-500" />
            </button>
          </div>
          <div class="flex-1 overflow-y-auto p-6">
            <div v-if="store.selectedConflict" class="space-y-6">
              <div>
                <h4 class="text-sm font-medium text-slate-500 mb-2">冲突信息</h4>
                <p class="text-lg font-semibold text-slate-900">{{ store.selectedConflict.conflictMessage }}</p>
              </div>
              
              <div class="grid grid-cols-2 gap-4">
                <div class="p-4 bg-slate-50 rounded-lg">
                  <p class="text-sm text-slate-500">冲突类型</p>
                  <p class="font-medium text-slate-900 mt-1">{{ getConflictTypeLabel(store.selectedConflict.conflictType) }}</p>
                </div>
                <div class="p-4 bg-slate-50 rounded-lg">
                  <p class="text-sm text-slate-500">严重程度</p>
                  <span
                    :class="[
                      'mt-1 inline-block',
                      store.selectedConflict.severity === 'high' ? 'badge-danger' : '',
                      store.selectedConflict.severity === 'medium' ? 'badge-warning' : '',
                      store.selectedConflict.severity === 'low' ? 'badge-info' : ''
                    ]"
                  >
                    {{ severities.find(s => s.value === store.selectedConflict?.severity)?.label }}
                  </span>
                </div>
                <div class="p-4 bg-slate-50 rounded-lg">
                  <p class="text-sm text-slate-500">原始行号</p>
                  <p class="font-mono font-medium text-slate-900 mt-1">{{ store.selectedConflict.originalLineNo }}</p>
                </div>
                <div class="p-4 bg-slate-50 rounded-lg">
                  <p class="text-sm text-slate-500">发现时间</p>
                  <p class="font-medium text-slate-900 mt-1">{{ formatDate(store.selectedConflict.createdAt) }}</p>
                </div>
              </div>
              
              <div>
                <h4 class="text-sm font-medium text-slate-500 mb-2">冲突数据</h4>
                <div class="p-4 bg-slate-900 rounded-lg overflow-x-auto">
                  <pre class="text-sm text-green-400 font-mono">{{ JSON.stringify(store.selectedConflict.conflictingData, null, 2) }}</pre>
                </div>
              </div>
            </div>
          </div>
          <div class="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
            <button @click="showDetailModal = false" class="btn-secondary">
              关闭
            </button>
            <button
              v-if="store.selectedConflict?.status === 'open'"
              @click="resolveConflict(store.selectedConflict!.conflictId); showDetailModal = false"
              class="btn-success"
            >
              标记为已解决
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
