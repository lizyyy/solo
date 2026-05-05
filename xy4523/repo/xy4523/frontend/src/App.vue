<template>
  <div class="app">
    <nav class="navbar">
      <div class="nav-brand">
        <span class="nav-logo">🌿</span>
        <span class="nav-title">温室授粉管理系统</span>
      </div>
      <div class="nav-links">
        <router-link to="/" class="nav-link" active-class="active">
          <span>📊</span> 概览
        </router-link>
        <router-link to="/import" class="nav-link" active-class="active">
          <span>📥</span> 数据导入
        </router-link>
        <router-link to="/assessment" class="nav-link" active-class="active">
          <span>🔍</span> 评估结果
        </router-link>
        <router-link to="/greenhouse" class="nav-link" active-class="active">
          <span>🏠</span> 温室管理
        </router-link>
      </div>
      <div class="nav-actions">
        <input 
          type="date" 
          :value="store.currentDate"
          @change="onDateChange"
          class="form-input nav-date-picker"
        />
      </div>
    </nav>
    
    <main class="main-content">
      <router-view />
    </main>
    
    <div class="toast-container">
      <transition-group name="slide">
        <div 
          v-for="notification in store.notifications" 
          :key="notification.id"
          :class="['toast', 'toast-' + (notification.type === 'error' ? 'error' : notification.type)]"
        >
          {{ notification.message }}
        </div>
      </transition-group>
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { useAppStore } from '@/stores/appStore'

const store = useAppStore()

const onDateChange = (e) => {
  store.setCurrentDate(e.target.value)
}

onMounted(() => {
  store.initializeData()
})
</script>

<style>
@import '@/assets/style.css';

.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.navbar {
  background: linear-gradient(135deg, var(--primary-dark) 0%, var(--primary-color) 100%);
  padding: 0 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 64px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
  position: sticky;
  top: 0;
  z-index: 100;
}

.nav-brand {
  display: flex;
  align-items: center;
  gap: 12px;
}

.nav-logo {
  font-size: 28px;
}

.nav-title {
  color: white;
  font-size: 18px;
  font-weight: 600;
  letter-spacing: 0.5px;
}

.nav-links {
  display: flex;
  align-items: center;
  gap: 4px;
}

.nav-link {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  color: rgba(255, 255, 255, 0.8);
  text-decoration: none;
  border-radius: 8px;
  transition: var(--transition);
  font-weight: 500;
}

.nav-link:hover {
  background: rgba(255, 255, 255, 0.1);
  color: white;
}

.nav-link.active {
  background: rgba(255, 255, 255, 0.2);
  color: white;
}

.nav-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.nav-date-picker {
  background: rgba(255, 255, 255, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: white;
  padding: 8px 12px;
  border-radius: 6px;
  width: 160px;
}

.nav-date-picker:focus {
  background: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.4);
  outline: none;
}

.nav-date-picker::-webkit-calendar-picker-indicator {
  filter: invert(1);
}

.main-content {
  flex: 1;
  padding: 24px;
  max-width: 1400px;
  margin: 0 auto;
  width: 100%;
}

.slide-enter-active,
.slide-leave-active {
  transition: all 0.3s ease;
}

.slide-enter-from {
  opacity: 0;
  transform: translateX(100%);
}

.slide-leave-to {
  opacity: 0;
  transform: translateX(100%);
}

@media (max-width: 900px) {
  .navbar {
    flex-wrap: wrap;
    height: auto;
    padding: 12px;
  }
  
  .nav-links {
    order: 3;
    width: 100%;
    justify-content: center;
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }
  
  .nav-brand {
    order: 1;
  }
  
  .nav-actions {
    order: 2;
  }
}

@media (max-width: 600px) {
  .nav-title {
    display: none;
  }
  
  .nav-link span:first-child {
    font-size: 18px;
  }
  
  .nav-link span:last-child {
    display: none;
  }
}
</style>
