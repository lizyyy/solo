import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    redirect: '/preferences'
  },
  {
    path: '/preferences',
    name: 'Preferences',
    component: () => import('../views/Preferences.vue')
  },
  {
    path: '/receipts',
    name: 'Receipts',
    component: () => import('../views/Receipts.vue')
  },
  {
    path: '/retry-records',
    name: 'RetryRecords',
    component: () => import('../views/RetryRecords.vue')
  },
  {
    path: '/exports',
    name: 'Exports',
    component: () => import('../views/Exports.vue')
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router