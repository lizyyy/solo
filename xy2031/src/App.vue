<template>
  <div class="app-container min-h-screen" :style="{ backgroundColor: currentTheme.bg }">
    <router-view />
    <BottomNavigation v-if="showBottomNav" />
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useThemeStore } from '@/stores/theme'
import BottomNavigation from '@/components/BottomNavigation.vue'

const route = useRoute()
const themeStore = useThemeStore()

const currentTheme = computed(() => themeStore.currentTheme)

const showBottomNav = computed(() => {
  const hiddenRoutes = ['checkout', 'order-detail', 'post-detail', 'product-detail']
  return !hiddenRoutes.includes(route.name)
})

onMounted(() => {
  themeStore.initTheme()
})
</script>

<style>
.app-container {
  max-width: 480px;
  margin: 0 auto;
  position: relative;
  min-height: 100vh;
}

@media (min-width: 481px) {
  .app-container {
    box-shadow: 0 0 20px rgba(0, 0, 0, 0.1);
  }
}
</style>
