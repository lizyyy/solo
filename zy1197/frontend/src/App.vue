<template>
  <div class="min-h-screen bg-gray-50">
    <nav class="bg-white shadow-sm border-b border-gray-200">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between h-16">
          <div class="flex items-center">
            <router-link to="/" class="flex items-center space-x-3">
              <div class="w-10 h-10 bg-gradient-to-br from-primary-500 to-accent-reactor rounded-lg flex items-center justify-center">
                <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                </svg>
              </div>
              <span class="text-xl font-bold text-gray-900">Reactor/Proactor 实验台</span>
            </router-link>
            
            <div class="hidden md:flex ml-10 space-x-4">
              <router-link 
                to="/" 
                class="px-3 py-2 rounded-md text-sm font-medium transition-colors"
                :class="isActive('/') ? 'text-primary-600 bg-primary-50' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'"
              >
                实验列表
              </router-link>
              <router-link 
                to="/create" 
                class="px-3 py-2 rounded-md text-sm font-medium transition-colors"
                :class="isActive('/create') ? 'text-primary-600 bg-primary-50' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'"
              >
                创建实验
              </router-link>
              <router-link 
                to="/learning" 
                class="px-3 py-2 rounded-md text-sm font-medium transition-colors"
                :class="isActive('/learning') ? 'text-primary-600 bg-primary-50' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'"
              >
                学习资源
              </router-link>
            </div>
          </div>
          
          <div class="flex items-center space-x-4">
            <div class="flex items-center space-x-2 text-sm">
              <span class="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              <span class="text-gray-600">服务正常</span>
            </div>
          </div>
        </div>
      </div>
    </nav>

    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </main>

    <footer class="bg-white border-t border-gray-200 mt-auto">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div class="flex flex-col md:flex-row justify-between items-center">
          <p class="text-sm text-gray-500">
            Reactor/Proactor 网络模型实验台 - 用于教学演示两种 I/O 多路复用模型
          </p>
          <div class="flex items-center space-x-6 mt-4 md:mt-0">
            <div class="flex items-center space-x-2">
              <span class="w-3 h-3 bg-accent-reactor rounded-full"></span>
              <span class="text-xs text-gray-500">Reactor</span>
            </div>
            <div class="flex items-center space-x-2">
              <span class="w-3 h-3 bg-accent-proactor rounded-full"></span>
              <span class="text-xs text-gray-500">Proactor</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  </div>
</template>

<script setup>
import { useRoute } from 'vue-router'
import { computed } from 'vue'

const route = useRoute()

const isActive = (path) => {
  return computed(() => route.path === path).value
}
</script>

<style>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
