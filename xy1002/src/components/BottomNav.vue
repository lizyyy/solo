<template>
  <div class="bottom-nav">
    <router-link 
      v-for="item in navItems" 
      :key="item.path"
      :to="item.path"
      class="nav-item"
      :class="{ active: isActive(item.path) }"
    >
      <div class="nav-icon">
        <span v-if="item.badge && cartCount > 0" class="badge-dot">{{ cartCount > 99 ? '99+' : cartCount }}</span>
        <component :is="item.icon" />
      </div>
      <span class="nav-label">{{ item.label }}</span>
    </router-link>
  </div>
</template>

<script setup lang="ts">
import { computed, h } from 'vue'
import { useRoute } from 'vue-router'
import { useUserStore } from '@/store/userStore'

const route = useRoute()
const userStore = useUserStore()

const cartCount = computed(() => userStore.cartCount)

const navItems = [
  {
    path: '/',
    label: '首页',
    icon: () => h('svg', { viewBox: '0 0 24 24', width: '24', height: '24', fill: 'currentColor' }, [
      h('path', { d: 'M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z' })
    ])
  },
  {
    path: '/team',
    label: '战队',
    icon: () => h('svg', { viewBox: '0 0 24 24', width: '24', height: '24', fill: 'currentColor' }, [
      h('path', { d: 'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z' })
    ])
  },
  {
    path: '/schedule',
    label: '赛程',
    icon: () => h('svg', { viewBox: '0 0 24 24', width: '24', height: '24', fill: 'currentColor' }, [
      h('path', { d: 'M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM9 10H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2zm-8 4H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2z' })
    ])
  },
  {
    path: '/shop',
    label: '商城',
    icon: () => h('svg', { viewBox: '0 0 24 24', width: '24', height: '24', fill: 'currentColor' }, [
      h('path', { d: 'M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z' })
    ]),
    badge: true
  },
  {
    path: '/profile',
    label: '我的',
    icon: () => h('svg', { viewBox: '0 0 24 24', width: '24', height: '24', fill: 'currentColor' }, [
      h('path', { d: 'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z' })
    ])
  }
]

function isActive(path: string): boolean {
  if (path === '/') {
    return route.path === '/'
  }
  return route.path.startsWith(path)
}
</script>

<style lang="scss" scoped>
.bottom-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 70px;
  background: white;
  display: flex;
  justify-content: space-around;
  align-items: center;
  box-shadow: 0 -4px 20px rgba(155, 89, 182, 0.15);
  z-index: 1000;
  padding-bottom: env(safe-area-inset-bottom);
}

.nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  height: 100%;
  color: var(--text-gray);
  text-decoration: none;
  transition: var(--transition);
  position: relative;
  
  &.active {
    color: var(--primary-purple);
    
    .nav-icon {
      transform: scale(1.1);
    }
  }
  
  &:hover {
    color: var(--primary-pink);
  }
}

.nav-icon {
  position: relative;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: var(--transition);
}

.badge-dot {
  position: absolute;
  top: -4px;
  right: -8px;
  min-width: 18px;
  height: 18px;
  background: var(--danger);
  color: white;
  font-size: 10px;
  font-weight: 600;
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
}

.nav-label {
  font-size: 11px;
  margin-top: 4px;
  font-weight: 500;
}
</style>
