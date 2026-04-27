<template>
  <div class="tab-bar">
    <div 
      class="tab-item" 
      :class="{ active: currentRoute === '/home' }"
      @click="navigateTo('/home')"
    >
      <span class="tab-icon">🏠</span>
      <span>首页</span>
    </div>
    <div 
      class="tab-item" 
      :class="{ active: currentRoute === '/help-requests' }"
      @click="navigateTo('/help-requests')"
    >
      <span class="tab-icon">🤝</span>
      <span>互助</span>
    </div>
    <div 
      class="tab-item" 
      :class="{ active: currentRoute === '/community' }"
      @click="navigateTo('/community')"
    >
      <span class="tab-icon">💬</span>
      <span>邻里圈</span>
    </div>
    <div 
      class="tab-item" 
      :class="{ active: currentRoute === '/profile' }"
      @click="navigateTo('/profile')"
    >
      <span class="tab-icon">👤</span>
      <span>我的</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'

const router = useRouter()
const route = useRoute()

const currentRoute = computed(() => route.path)

function navigateTo(path) {
  if (currentRoute.value !== path) {
    router.push(path)
  }
}
</script>

<style scoped>
/* TabBar styles are in global style.css */
</style>
