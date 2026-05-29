<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import {
  FileUp,
  AlertTriangle,
  CheckCircle,
  RotateCcw,
  FileBarChart,
  ArrowRight,
  Clock
} from 'lucide-vue-next'
import { useImportStore } from '../stores/importStore'
import StatCard from '../components/StatCard.vue'

const router = useRouter()
const store = useImportStore()

const stats = computed(() => [
  {
    title: '已上传文件',
    value: store.csvFiles.length,
    icon: FileUp,
    color: 'primary' as const
  },
  {
    title: '冲突总数',
    value: store.conflictStats.total,
    icon: AlertTriangle,
    color: 'danger' as const
  },
  {
    title: '回滚点数量',
    value: store.rollbackPoints.length,
    icon: RotateCcw,
    color: 'warning' as const
  },
  {
    title: '演练报告',
    value: store.reports.length,
    icon: FileBarChart,
    color: 'success' as const
  }
])

const quickActions = [
  {
    title: '开始导入预演',
    description: '上传CSV文件并配置字段映射',
    icon: FileUp,
    path: '/import',
    color: 'primary'
  },
  {
    title: '查看冲突队列',
    description: '检查并处理数据冲突',
    icon: AlertTriangle,
    path: '/conflicts',
    color: 'danger'
  },
  {
    title: '创建回滚点',
    description: '为当前会话创建安全回滚点',
    icon: RotateCcw,
    path: '/rollback',
    color: 'warning'
  }
]

const recentActivity = computed(() => {
  const activities: { type: string; message: string; time: Date; icon: any }[] = []
  
  store.csvFiles.slice(0, 3).forEach(file => {
    activities.push({
      type: 'upload',
      message: `上传文件 ${file.fileName} (${file.versionNo})`,
      time: file.uploadedAt,
      icon: FileUp
    })
  })
  
  store.importSessions.slice(0, 3).forEach(session => {
    activities.push({
      type: 'session',
      message: `完成预演: ${session.sessionName}`,
      time: session.finishedAt || session.startedAt,
      icon: CheckCircle
    })
  })
  
  return activities.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 5)
})

function formatTime(date: Date): string {
  const now = new Date()
  const diff = now.getTime() - new Date(date).getTime()
  const minutes = Math.floor(diff / 60000)
  
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟前`
  
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小时前`
  
  return new Date(date).toLocaleDateString('zh-CN')
}
</script>

<template>
  <div class="space-y-6 animate-fade-in">
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <StatCard
        v-for="stat in stats"
        :key="stat.title"
        :title="stat.title"
        :value="stat.value"
        :icon="stat.icon"
        :color="stat.color"
      />
    </div>
    
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div class="lg:col-span-2">
        <div class="card">
          <div class="card-header">
            <h3 class="font-semibold text-slate-900">快速操作</h3>
          </div>
          <div class="card-body">
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                v-for="action in quickActions"
                :key="action.path"
                @click="router.push(action.path)"
                class="p-4 rounded-xl border border-slate-200 hover:border-primary-300 hover:bg-primary-50 transition-all text-left group"
              >
                <div
                  :class="[
                    'w-10 h-10 rounded-lg flex items-center justify-center mb-3',
                    action.color === 'primary' ? 'bg-primary-100' : '',
                    action.color === 'danger' ? 'bg-danger-100' : '',
                    action.color === 'warning' ? 'bg-warning-100' : ''
                  ]"
                >
                  <component
                    :is="action.icon"
                    :class="[
                      'w-5 h-5',
                      action.color === 'primary' ? 'text-primary-600' : '',
                      action.color === 'danger' ? 'text-danger-600' : '',
                      action.color === 'warning' ? 'text-warning-600' : ''
                    ]"
                  />
                </div>
                <h4 class="font-medium text-slate-900 group-hover:text-primary-700 transition-colors">
                  {{ action.title }}
                </h4>
                <p class="text-sm text-slate-500 mt-1">{{ action.description }}</p>
                <div class="flex items-center gap-1 mt-3 text-sm font-medium text-primary-600 opacity-0 group-hover:opacity-100 transition-opacity">
                  <span>进入</span>
                  <ArrowRight class="w-4 h-4" />
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <div class="card">
        <div class="card-header">
          <h3 class="font-semibold text-slate-900">最近活动</h3>
        </div>
        <div class="card-body">
          <div v-if="recentActivity.length === 0" class="text-center py-8">
            <Clock class="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p class="text-slate-500">暂无活动记录</p>
          </div>
          <div v-else class="space-y-4">
            <div
              v-for="(activity, index) in recentActivity"
              :key="index"
              class="flex items-start gap-3"
            >
              <div class="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <component :is="activity.icon" class="w-4 h-4 text-slate-500" />
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm text-slate-900 truncate">{{ activity.message }}</p>
                <p class="text-xs text-slate-500 mt-0.5">{{ formatTime(activity.time) }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <div class="card">
      <div class="card-header">
        <h3 class="font-semibold text-slate-900">系统状态概览</h3>
      </div>
      <div class="card-body">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <h4 class="text-sm font-medium text-slate-600 mb-3">冲突类型分布</h4>
            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <span class="text-sm text-slate-500">主键重复</span>
                <span class="text-sm font-medium text-slate-900">{{ store.conflictStats.breakdown.duplicate_primary_key }}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-sm text-slate-500">字段验证</span>
                <span class="text-sm font-medium text-slate-900">{{ store.conflictStats.breakdown.field_validation }}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-sm text-slate-500">类型不匹配</span>
                <span class="text-sm font-medium text-slate-900">{{ store.conflictStats.breakdown.data_type_mismatch }}</span>
              </div>
            </div>
          </div>
          
          <div>
            <h4 class="text-sm font-medium text-slate-600 mb-3">严重程度分布</h4>
            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <span class="text-sm text-slate-500">高风险</span>
                <span class="badge-danger">{{ store.conflictStats.bySeverity.high }}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-sm text-slate-500">中风险</span>
                <span class="badge-warning">{{ store.conflictStats.bySeverity.medium }}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-sm text-slate-500">低风险</span>
                <span class="badge-info">{{ store.conflictStats.bySeverity.low }}</span>
              </div>
            </div>
          </div>
          
          <div>
            <h4 class="text-sm font-medium text-slate-600 mb-3">处理状态</h4>
            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <span class="text-sm text-slate-500">待处理</span>
                <span class="badge-warning">{{ store.conflictStats.byStatus.open }}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-sm text-slate-500">已解决</span>
                <span class="badge-success">{{ store.conflictStats.byStatus.resolved }}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-sm text-slate-500">已忽略</span>
                <span class="badge-secondary">{{ store.conflictStats.byStatus.ignored }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
