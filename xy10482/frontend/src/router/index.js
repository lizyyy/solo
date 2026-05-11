import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    redirect: '/dashboard'
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: () => import('../views/Dashboard.vue')
  },
  {
    path: '/plots',
    name: 'Plots',
    component: () => import('../views/Plots.vue')
  },
  {
    path: '/harvest-tasks',
    name: 'HarvestTasks',
    component: () => import('../views/HarvestTasks.vue')
  },
  {
    path: '/batches',
    name: 'Batches',
    component: () => import('../views/Batches.vue')
  },
  {
    path: '/inspections',
    name: 'Inspections',
    component: () => import('../views/Inspections.vue')
  },
  {
    path: '/settings',
    name: 'Settings',
    component: () => import('../views/Settings.vue')
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
