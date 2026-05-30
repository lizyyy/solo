<template>
  <div class="app-container">
    <aside class="sidebar">
      <div class="sidebar-header">
        <h1>票据管理系统</h1>
        <p>银行承兑到期提醒</p>
      </div>
      <nav class="sidebar-nav">
        <div 
          v-for="item in navItems" 
          :key="item.key"
          class="nav-item"
          :class="{ active: currentPage === item.key }"
          @click="currentPage = item.key"
        >
          <span class="icon">{{ item.icon }}</span>
          <span>{{ item.label }}</span>
        </div>
      </nav>
    </aside>
    <main class="main-content">
      <header class="header">
        <div class="header-title">{{ currentPageTitle }}</div>
        <div class="header-actions">
          <slot name="header-actions"></slot>
        </div>
      </header>
      <div class="content">
        <Dashboard v-if="currentPage === 'dashboard'" />
        <BillList v-else-if="currentPage === 'bills'" />
        <ReminderList v-else-if="currentPage === 'reminders'" />
        <CollectionList v-else-if="currentPage === 'collections'" />
        <DiscountList v-else-if="currentPage === 'discounts'" />
        <EndorseList v-else-if="currentPage === 'endorses'" />
        <ReportList v-else-if="currentPage === 'reports'" />
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import Dashboard from './pages/Dashboard.vue'
import BillList from './pages/BillList.vue'
import ReminderList from './pages/ReminderList.vue'
import CollectionList from './pages/CollectionList.vue'
import DiscountList from './pages/DiscountList.vue'
import EndorseList from './pages/EndorseList.vue'
import ReportList from './pages/ReportList.vue'

const currentPage = ref('dashboard')

const navItems = [
  { key: 'dashboard', label: '工作台', icon: '📊' },
  { key: 'bills', label: '票据管理', icon: '📋' },
  { key: 'reminders', label: '到期提醒', icon: '🔔' },
  { key: 'collections', label: '托收管理', icon: '🏦' },
  { key: 'discounts', label: '贴现管理', icon: '💰' },
  { key: 'endorses', label: '背书追踪', icon: '🔗' },
  { key: 'reports', label: '报表中心', icon: '📈' }
]

const currentPageTitle = computed(() => {
  const item = navItems.find(i => i.key === currentPage.value)
  return item ? item.label : ''
})
</script>
