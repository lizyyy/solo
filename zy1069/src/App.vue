<template>
  <div class="min-h-screen flex flex-col">
    <nav class="bg-white shadow-sm border-b">
      <div class="max-w-7xl mx-auto px-4">
        <div class="flex items-center justify-between h-16">
          <div class="flex items-center gap-3">
            <div class="text-2xl">💊</div>
            <span class="font-bold text-xl text-primary-600">家庭药箱</span>
          </div>
          <div class="flex items-center gap-1">
            <router-link
              v-for="item in navItems"
              :key="item.path"
              :to="item.path"
              class="px-3 py-2 rounded-md text-sm font-medium transition-colors"
              :class="{
                'bg-primary-100 text-primary-700': $route.path === item.path,
                'text-gray-600 hover:bg-gray-100': $route.path !== item.path
              }"
            >
              <span class="mr-1">{{ item.icon }}</span>
              <span class="hidden sm:inline">{{ item.label }}</span>
            </router-link>
          </div>
        </div>
      </div>
    </nav>
    
    <main class="flex-1">
      <router-view />
    </main>
    
    <footer class="bg-white border-t py-4 mt-8">
      <div class="max-w-7xl mx-auto px-4 text-center text-sm text-gray-500">
        家庭药箱 - 本地用药核对工具 | 数据安全保存在本地浏览器
      </div>
    </footer>
  </div>
</template>

<script setup>
const navItems = [
  { path: '/today', label: '今日用药', icon: '📅' },
  { path: '/family', label: '家庭成员', icon: '👨‍👩‍👧‍👦' },
  { path: '/medicines', label: '药品管理', icon: '💊' },
  { path: '/plans', label: '用药计划', icon: '📋' },
  { path: '/check', label: '规则检查', icon: '⚠️' },
  { path: '/import-export', label: '导入导出', icon: '📤' }
]
</script>
