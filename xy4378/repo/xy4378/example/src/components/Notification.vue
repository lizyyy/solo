<template>
  <div class="notification">
    <div v-if="hasNotifications" class="badge">
      {{ t('notification.new_message', { count: unreadCount }) }}
    </div>
    <div v-else class="no-notifications">
      {{ t('notification.count_zero') }}
    </div>
    <ul v-if="notifications.length > 0">
      <li v-for="notification in notifications" :key="notification.id">
        {{ notification.message }}
      </li>
    </ul>
    <p>您有 {{ unreadCount }} 条未读消息</p>
  </div>
</template>

<script lang="ts">
import { defineComponent, computed } from 'vue';
import { useI18n } from 'vue-i18n';

interface Notification {
  id: string;
  message: string;
  read: boolean;
}

export default defineComponent({
  name: 'Notification',
  setup() {
    const { t } = useI18n();
    
    const notifications: Notification[] = [
      { id: '1', message: '系统消息', read: false },
      { id: '2', message: '您的订单已发货', read: true },
    ];
    
    const unreadCount = computed(() => 
      notifications.filter(n => !n.read).length
    );
    
    const hasNotifications = computed(() => unreadCount.value > 0);
    
    return {
      t,
      notifications,
      unreadCount,
      hasNotifications,
    };
  },
});
</script>
