<script setup lang="ts">
import { RouterView, useRoute, useRouter } from 'vue-router';
import { computed } from 'vue';
import { Layers, BookOpen, Upload, Gauge } from 'lucide-vue-next';

const route = useRoute();
const router = useRouter();

const navItems = computed(() => [
  { path: '/import', name: '数据导入', icon: Upload },
  { path: '/gate', name: '闸门评估', icon: BookOpen },
  { path: '/timeline', name: '时间线', icon: Layers }
]);

const currentPath = computed(() => route.path);
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <div class="fixed left-0 top-0 bottom-0 w-64 bg-white border-r border-gray-200 z-40">
      <div class="p-6 border-b border-gray-100">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center">
            <Gauge class="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 class="font-bold text-gray-900">培训评估工具</h1>
            <p class="text-xs text-gray-500">水利闸门操作考核</p>
          </div>
        </div>
      </div>

      <nav class="p-4 space-y-1">
        <button
          v-for="item in navItems"
          :key="item.path"
          class="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all"
          :class="[
            currentPath === item.path || (item.path !== '/import' && currentPath.startsWith(item.path))
              ? 'bg-primary-50 text-primary-700 border border-primary-200'
              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
          ]"
          @click="router.push(item.path)"
        >
          <component :is="item.icon" class="w-5 h-5" />
          {{ item.name }}
        </button>
      </nav>

      <div class="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-100">
        <div class="p-4 bg-gradient-to-br from-primary-50 to-white rounded-xl border border-primary-100">
          <div class="text-xs text-primary-600 font-medium mb-1">使用提示</div>
          <p class="text-xs text-gray-600">
            1. 导入数据 → 2. 自动判断 → 3. 人工确认 → 4. 查看时间线
          </p>
        </div>
      </div>
    </div>

    <div class="ml-64">
      <RouterView v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </RouterView>
    </div>
  </div>
</template>

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
