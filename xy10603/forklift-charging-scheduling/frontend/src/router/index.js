import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    redirect: '/dashboard'
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: () => import('@/views/Dashboard.vue')
  },
  {
    path: '/tasks',
    name: 'Tasks',
    component: () => import('@/views/Tasks.vue')
  },
  {
    path: '/stations',
    name: 'Stations',
    component: () => import('@/views/Stations.vue')
  },
  {
    path: '/batteries',
    name: 'Batteries',
    component: () => import('@/views/Batteries.vue')
  },
  {
    path: '/waves',
    name: 'Waves',
    component: () => import('@/views/Waves.vue')
  },
  {
    path: '/anomalies',
    name: 'Anomalies',
    component: () => import('@/views/Anomalies.vue')
  },
  {
    path: '/import',
    name: 'Import',
    component: () => import('@/views/Import.vue')
  },
  {
    path: '/reports',
    name: 'Reports',
    component: () => import('@/views/Reports.vue')
  },
  {
    path: '/history',
    name: 'History',
    component: () => import('@/views/History.vue')
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
