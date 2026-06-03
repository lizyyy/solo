import { reactive } from 'vue';
import type { Notification } from '../types';

interface NotificationStoreState {
  notifications: Notification[];
}

const state = reactive<NotificationStoreState>({
  notifications: [],
});

export function useNotificationStore() {
  const addNotification = (type: Notification['type'], message: string) => {
    const id = Math.random().toString(36).substring(2, 11);
    const notification: Notification = {
      id,
      type,
      message,
      timestamp: Date.now(),
    };
    state.notifications.push(notification);
    setTimeout(() => {
      removeNotification(id);
    }, 5000);
  };

  const removeNotification = (id: string) => {
    const index = state.notifications.findIndex(n => n.id === id);
    if (index !== -1) {
      state.notifications.splice(index, 1);
    }
  };

  const clearAll = () => {
    state.notifications = [];
  };

  return {
    state,
    addNotification,
    removeNotification,
    clearAll,
  };
}
