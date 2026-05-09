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
    path: '/circuit-breaker',
    name: 'CircuitBreaker',
    component: () => import('@/views/CircuitBreaker.vue')
  },
  {
    path: '/rate-limit',
    name: 'RateLimit',
    component: () => import('@/views/RateLimit.vue')
  },
  {
    path: '/fault-injection',
    name: 'FaultInjection',
    component: () => import('@/views/FaultInjection.vue')
  },
  {
    path: '/simulation',
    name: 'Simulation',
    component: () => import('@/views/Simulation.vue')
  },
  {
    path: '/problems',
    name: 'Problems',
    component: () => import('@/views/Problems.vue')
  },
  {
    path: '/report',
    name: 'Report',
    component: () => import('@/views/Report.vue')
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
