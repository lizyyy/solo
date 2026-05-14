import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'Dashboard',
    component: () => import('@/views/Dashboard.vue')
  },
  {
    path: '/sessions',
    name: 'Sessions',
    component: () => import('@/views/Sessions.vue')
  },
  {
    path: '/session/:id',
    name: 'SessionDetail',
    component: () => import('@/views/SessionDetail.vue')
  },
  {
    path: '/session/new',
    name: 'NewSession',
    component: () => import('@/views/NewSession.vue')
  },
  {
    path: '/diff',
    name: 'DiffCompare',
    component: () => import('@/views/DiffCompare.vue')
  },
  {
    path: '/exports',
    name: 'Exports',
    component: () => import('@/views/Exports.vue')
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
