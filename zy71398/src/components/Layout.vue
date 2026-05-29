<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  LayoutDashboard,
  FileUp,
  AlertTriangle,
  RotateCcw,
  History,
  FileBarChart,
  Database
} from 'lucide-vue-next'

const route = useRoute()
const router = useRouter()

const navItems = [
  { path: '/', label: '仪表盘概览', icon: LayoutDashboard },
  { path: '/import', label: '导入预演工作台', icon: FileUp },
  { path: '/conflicts', label: '冲突队列中心', icon: AlertTriangle },
  { path: '/rollback', label: '回滚计划引擎', icon: RotateCcw },
  { path: '/history', label: '历史审计追踪', icon: History },
  { path: '/reports', label: '演练报告中心', icon: FileBarChart }
]

const activePath = computed(() => route.path)
</script>

<template>
  <div class="flex h-screen bg-slate-50">
    <aside class="w-64 bg-white border-r border-slate-200 flex flex-col">
      <div class="h-16 flex items-center px-6 border-b border-slate-200">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center">
            <Database class="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 class="font-bold text-slate-900">数据导入</h1>
            <p class="text-xs text-slate-500">回滚演练系统</p>
          </div>
        </div>
      </div>
      
      <nav class="flex-1 p-4 space-y-1 overflow-y-auto scrollbar-thin">
        <button
          v-for="item in navItems"
          :key="item.path"
          @click="router.push(item.path)"
          :class="activePath === item.path ? 'nav-item-active' : 'nav-item'"
        >
          <component :is="item.icon" class="w-5 h-5" />
          <span>{{ item.label }}</span>
        </button>
      </nav>
      
      <div class="p-4 border-t border-slate-200">
        <div class="flex items-center gap-3 px-4 py-3">
          <div class="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center">
            <span class="text-sm font-medium text-slate-600">运</span>
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-slate-900 truncate">运营专员</p>
            <p class="text-xs text-slate-500 truncate">operator@company.com</p>
          </div>
        </div>
      </div>
    </aside>
    
    <main class="flex-1 flex flex-col overflow-hidden">
      <header class="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6">
        <div>
          <h2 class="text-lg font-semibold text-slate-900">
            {{ navItems.find(n => n.path === activePath)?.label || '数据导入回滚演练系统' }}
          </h2>
        </div>
        <div class="flex items-center gap-3">
          <span class="text-sm text-slate-500">{{ new Date().toLocaleDateString('zh-CN') }}</span>
        </div>
      </header>
      
      <div class="flex-1 overflow-y-auto p-6 scrollbar-thin">
        <slot />
      </div>
    </main>
  </div>
</template>
