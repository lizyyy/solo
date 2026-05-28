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
    path: '/invoices',
    name: 'Invoices',
    component: () => import('@/views/Invoices.vue')
  },
  {
    path: '/redemption',
    name: 'Redemption',
    component: () => import('@/views/Redemption.vue')
  },
  {
    path: '/credit',
    name: 'Credit',
    component: () => import('@/views/Credit.vue')
  },
  {
    path: '/payment',
    name: 'Payment',
    component: () => import('@/views/Payment.vue')
  },
  {
    path: '/audit',
    name: 'Audit',
    component: () => import('@/views/Audit.vue')
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
