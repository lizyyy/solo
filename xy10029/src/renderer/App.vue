<template>
  <div class="app">
    <router-view />
    <div class="toast-container" v-if="toastStore.toasts.length > 0">
      <div
        v-for="toast in toastStore.toasts"
        :key="toast.id"
        class="toast"
        :class="{
          'alert-success': toast.type === 'success',
          'alert-error': toast.type === 'error',
          'alert-warning': toast.type === 'warning',
          'alert-info': toast.type === 'info'
        }"
      >
        {{ toast.message }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useAuthStore } from './stores/auth'
import { useToastStore } from './stores/toast'

const authStore = useAuthStore()
const toastStore = useToastStore()

onMounted(() => {
  authStore.restoreAuth()
})
</script>
