<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  RotateCcw,
  Plus,
  Play,
  AlertTriangle,
  CheckCircle,
  Clock,
  User,
  FileText,
  ChevronRight,
  Shield,
  AlertOctagon,
  Info
} from 'lucide-vue-next'
import { useImportStore } from '../stores/importStore'
import { formatDate } from '../utils'

const store = useImportStore()

const showCreateModal = ref(false)
const newRollbackDescription = ref('')
const simulatingRollbackId = ref<string | null>(null)
const simulationResult = ref<{ valid: boolean; errors: string[]; impact: string } | null>(null)

const sortedRollbackPoints = computed(() => {
  return [...store.rollbackPoints].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )
})

function openCreateModal() {
  newRollbackDescription.value = ''
  simulationResult.value = null
  showCreateModal.value = true
}

function createRollbackPoint() {
  if (!store.currentSessionId || !newRollbackDescription.value.trim()) return
  
  store.createRollbackPoint(store.currentSessionId, newRollbackDescription.value)
  showCreateModal.value = false
}

function simulateRollback(rollbackId: string) {
  simulatingRollbackId.value = rollbackId
  simulationResult.value = null
  
  setTimeout(() => {
    simulationResult.value = store.simulateRollback(rollbackId)
    simulatingRollbackId.value = null
  }, 1000)
}

function getRiskColor(level: 'high' | 'medium' | 'low') {
  const colors = {
    high: 'danger',
    medium: 'warning',
    low: 'info'
  }
  return colors[level]
}

function getRiskLabel(level: 'high' | 'medium' | 'low') {
  const labels = {
    high: '高风险',
    medium: '中风险',
    low: '低风险'
  }
  return labels[level]
}
</script>

<template>
  <div class="space-y-6 animate-fade-in">
    <div class="flex items-center justify-between">
      <div>
        <p class="text-slate-500">管理回滚点，模拟回滚操作，确保数据安全</p>
      </div>
      <button
        @click="openCreateModal"
        :disabled="!store.currentSessionId"
        class="btn-primary"
      >
        <Plus class="w-4 h-4 mr-2" />
        创建回滚点
      </button>
    </div>
    
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div class="card">
        <div class="card-body">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-slate-500">回滚点总数</p>
              <p class="text-2xl font-bold text-slate-900 mt-1">{{ store.rollbackPoints.length }}</p>
            </div>
            <div class="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center">
              <Shield class="w-6 h-6 text-primary-600" />
            </div>
          </div>
        </div>
      </div>
      <div class="card">
        <div class="card-body">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-slate-500">可回滚记录</p>
              <p class="text-2xl font-bold text-slate-900 mt-1">
                {{ store.rollbackPoints.reduce((sum, p) => sum + p.scopes.reduce((s, sc) => s + sc.affectedCount, 0), 0) }}
              </p>
            </div>
            <div class="w-12 h-12 bg-success-100 rounded-xl flex items-center justify-center">
              <RotateCcw class="w-6 h-6 text-success-600" />
            </div>
          </div>
        </div>
      </div>
      <div class="card">
        <div class="card-body">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-slate-500">高风险点</p>
              <p class="text-2xl font-bold text-danger-600 mt-1">
                {{ store.rollbackPoints.filter(p => p.scopes.some(s => s.riskLevel === 'high')).length }}
              </p>
            </div>
            <div class="w-12 h-12 bg-danger-100 rounded-xl flex items-center justify-center">
              <AlertOctagon class="w-6 h-6 text-danger-600" />
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <div class="card">
      <div class="card-header">
        <h3 class="font-semibold text-slate-900 flex items-center gap-2">
          <RotateCcw class="w-5 h-5 text-primary-600" />
          回滚点时间线
        </h3>
      </div>
      <div class="card-body">
        <div v-if="sortedRollbackPoints.length === 0" class="text-center py-12">
          <Shield class="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <p class="text-slate-500 mb-2">暂无回滚点</p>
          <p class="text-sm text-slate-400">创建回滚点以保护您的数据</p>
        </div>
        
        <div v-else class="relative">
          <div class="absolute left-6 top-0 bottom-0 w-0.5 bg-slate-200" />
          
          <div class="space-y-6">
            <div
              v-for="point in sortedRollbackPoints"
              :key="point.rollbackId"
              class="relative pl-16"
            >
              <div class="absolute left-4 w-5 h-5 bg-white border-4 border-primary-500 rounded-full -translate-x-1/2" />
              
              <div class="border border-slate-200 rounded-xl p-5 hover:shadow-md transition-shadow">
                <div class="flex items-start justify-between mb-4">
                  <div>
                    <div class="flex items-center gap-3">
                      <h4 class="font-semibold text-slate-900">{{ point.versionTag }}</h4>
                      <span
                        :class="[
                          'badge',
                          getRiskColor(point.scopes[0]?.riskLevel || 'low') === 'danger' ? 'badge-danger' : '',
                          getRiskColor(point.scopes[0]?.riskLevel || 'low') === 'warning' ? 'badge-warning' : '',
                          getRiskColor(point.scopes[0]?.riskLevel || 'low') === 'info' ? 'badge-info' : ''
                        ]"
                      >
                        {{ getRiskLabel(point.scopes[0]?.riskLevel || 'low') }}
                      </span>
                      <span v-if="point.isExecuted" class="badge-success">已执行</span>
                    </div>
                    <p class="text-sm text-slate-500 mt-1">{{ point.description }}</p>
                  </div>
                  <div class="text-right">
                    <p class="text-sm text-slate-500">{{ formatDate(point.createdAt) }}</p>
                    <div class="flex items-center gap-1 text-sm text-slate-500 mt-1 justify-end">
                      <User class="w-3.5 h-3.5" />
                      <span>{{ point.createdBy }}</span>
                    </div>
                  </div>
                </div>
                
                <div class="grid grid-cols-3 gap-4 mb-4">
                  <div class="p-3 bg-slate-50 rounded-lg">
                    <p class="text-xs text-slate-500">回滚范围</p>
                    <p class="font-medium text-slate-900 mt-0.5">
                      {{ point.scopes[0]?.scopeType === 'full' ? '全量回滚' : '部分回滚' }}
                    </p>
                  </div>
                  <div class="p-3 bg-slate-50 rounded-lg">
                    <p class="text-xs text-slate-500">影响记录数</p>
                    <p class="font-medium text-slate-900 mt-0.5">
                      {{ point.scopes[0]?.affectedCount || 0 }} 条
                    </p>
                  </div>
                  <div class="p-3 bg-slate-50 rounded-lg">
                    <p class="text-xs text-slate-500">关联会话</p>
                    <p class="font-mono text-sm text-slate-900 mt-0.5 truncate">
                      {{ point.sessionId.slice(0, 12) }}...
                    </p>
                  </div>
                </div>
                
                <div v-if="simulatingRollbackId === point.rollbackId" class="p-4 bg-slate-50 rounded-lg flex items-center gap-3">
                  <div class="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                  <span class="text-slate-600">正在模拟回滚...</span>
                </div>
                
                <div v-else-if="simulationResult && simulatingRollbackId === null" class="p-4 rounded-lg" :class="simulationResult.valid ? 'bg-success-50' : 'bg-danger-50'">
                  <div class="flex items-start gap-3">
                    <CheckCircle v-if="simulationResult.valid" class="w-5 h-5 text-success-600 flex-shrink-0 mt-0.5" />
                    <AlertTriangle v-else class="w-5 h-5 text-danger-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p class="font-medium" :class="simulationResult.valid ? 'text-success-800' : 'text-danger-800'">
                        {{ simulationResult.valid ? '回滚模拟通过' : '发现潜在问题' }}
                      </p>
                      <p class="text-sm mt-1" :class="simulationResult.valid ? 'text-success-600' : 'text-danger-600'">
                        {{ simulationResult.impact }}
                      </p>
                      <ul v-if="simulationResult.errors.length > 0" class="mt-2 text-sm text-danger-600 list-disc list-inside">
                        <li v-for="(error, index) in simulationResult.errors" :key="index">{{ error }}</li>
                      </ul>
                    </div>
                  </div>
                </div>
                
                <div class="flex items-center justify-between pt-4 border-t border-slate-100">
                  <button class="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1">
                    <FileText class="w-4 h-4" />
                    查看快照详情
                    <ChevronRight class="w-4 h-4" />
                  </button>
                  <div class="flex items-center gap-2">
                    <button
                      @click="simulateRollback(point.rollbackId)"
                      :disabled="point.isExecuted"
                      class="btn-secondary px-3 py-1.5 text-sm"
                    >
                      <Play class="w-4 h-4 mr-1.5" />
                      模拟执行
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <Teleport to="body">
      <div
        v-if="showCreateModal"
        class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
        @click.self="showCreateModal = false"
      >
        <div class="bg-white rounded-2xl shadow-xl w-full max-w-md animate-slide-in">
          <div class="px-6 py-4 border-b border-slate-200">
            <h3 class="font-semibold text-slate-900 flex items-center gap-2">
              <Shield class="w-5 h-5 text-primary-600" />
              创建回滚点
            </h3>
          </div>
          <div class="p-6 space-y-4">
            <div v-if="!store.currentSessionId" class="p-4 bg-warning-50 border border-warning-200 rounded-lg">
              <div class="flex items-start gap-3">
                <AlertTriangle class="w-5 h-5 text-warning-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p class="font-medium text-warning-800">请先执行预演导入</p>
                  <p class="text-sm text-warning-600 mt-1">需要有活动的导入会话才能创建回滚点</p>
                </div>
              </div>
            </div>
            
            <div v-else>
              <label class="label">回滚点描述</label>
              <textarea
                v-model="newRollbackDescription"
                placeholder="描述此回滚点的用途和包含的数据范围..."
                rows="3"
                class="input"
              />
            </div>
            
            <div class="p-4 bg-info-50 border border-info-200 rounded-lg">
              <div class="flex items-start gap-3">
                <Info class="w-5 h-5 text-info-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p class="font-medium text-info-800">回滚点将包含</p>
                  <ul class="text-sm text-info-600 mt-1 space-y-1">
                    <li>• 当前会话的所有配置信息</li>
                    <li>• 冲突检测结果快照</li>
                    <li>• 成功导入记录状态</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
          <div class="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
            <button @click="showCreateModal = false" class="btn-secondary">
              取消
            </button>
            <button
              @click="createRollbackPoint"
              :disabled="!store.currentSessionId || !newRollbackDescription.trim()"
              class="btn-primary"
            >
              创建回滚点
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
