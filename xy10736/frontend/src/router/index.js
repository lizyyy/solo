import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'Dashboard',
    component: () => import('@/views/Dashboard.vue')
  },
  {
    path: '/session',
    name: 'Session',
    component: () => import('@/views/Session.vue')
  },
  {
    path: '/session/:id',
    name: 'SessionDetail',
    component: () => import('@/views/SessionDetail.vue')
  },
  {
    path: '/detection',
    name: 'Detection',
    component: () => import('@/views/Detection.vue')
  },
  {
    path: '/tracking',
    name: 'Tracking',
    component: () => import('@/views/Tracking.vue')
  },
  {
    path: '/version',
    name: 'Version',
    component: () => import('@/views/Version.vue')
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
