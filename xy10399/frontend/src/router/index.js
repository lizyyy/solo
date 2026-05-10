import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    redirect: '/calendar'
  },
  {
    path: '/calendar',
    name: 'Calendar',
    component: () => import('../views/Calendar.vue')
  },
  {
    path: '/requests',
    name: 'Requests',
    component: () => import('../views/Requests.vue')
  },
  {
    path: '/approval',
    name: 'Approval',
    component: () => import('../views/Approval.vue')
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
