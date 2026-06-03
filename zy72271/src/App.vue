<script setup lang="ts">
import NotificationToast from '@/components/common/NotificationToast.vue';
</script>

<template>
  <div class="min-h-screen bg-slate-50">
    <router-view />
    <NotificationToast />
  </div>
</template>
