<script setup lang="ts">
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-vue-next';
import { useNotificationStore } from '@/stores/notification';
import type { Notification } from '@/types';

const store = useNotificationStore();

const iconMap: Record<Notification['type'], any> = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const colorMap: Record<Notification['type'], string> = {
  success: 'bg-green-50 border-green-200 text-green-800',
  error: 'bg-red-50 border-red-200 text-red-800',
  warning: 'bg-amber-50 border-amber-200 text-amber-800',
  info: 'bg-blue-50 border-blue-200 text-blue-800',
};

const iconColorMap: Record<Notification['type'], string> = {
  success: 'text-green-500',
  error: 'text-red-500',
  warning: 'text-amber-500',
  info: 'text-blue-500',
};
</script>

<template>
  <div class="fixed top-4 right-4 z-50 space-y-3 w-96">
    <TransitionGroup name="notification">
      <div
        v-for="notification in store.state.notifications"
        :key="notification.id"
        class="flex items-start p-4 border rounded-lg shadow-lg backdrop-blur-sm"
        :class="colorMap[notification.type]"
      >
        <component
          :is="iconMap[notification.type]"
          class="w-5 h-5 mt-0.5 flex-shrink-0"
          :class="iconColorMap[notification.type]"
        />
        <p class="ml-3 text-sm flex-1">{{ notification.message }}</p>
        <button
          class="ml-2 text-slate-400 hover:text-slate-600 transition-colors"
          @click="store.removeNotification(notification.id)"
        >
          <X class="w-4 h-4" />
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.notification-enter-active,
.notification-leave-active {
  transition: all 0.3s ease;
}
.notification-enter-from {
  opacity: 0;
  transform: translateX(100%);
}
.notification-leave-to {
  opacity: 0;
  transform: translateX(100%);
}
</style>
