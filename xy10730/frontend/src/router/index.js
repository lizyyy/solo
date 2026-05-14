import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'HealthRecords',
    component: () => import('@/views/HealthRecords.vue')
  },
  {
    path: '/services',
    name: 'Services',
    component: () => import('@/views/Services.vue')
  },
  {
    path: '/duty-reports',
    name: 'DutyReports',
    component: () => import('@/views/DutyReports.vue')
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
