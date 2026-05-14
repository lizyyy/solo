import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'dashboard',
    component: () => import('@/views/Dashboard.vue')
  },
  {
    path: '/rules',
    name: 'rules',
    component: () => import('@/views/Rules.vue')
  },
  {
    path: '/rules/:id',
    name: 'rule-detail',
    component: () => import('@/views/RuleDetail.vue')
  },
  {
    path: '/reports',
    name: 'reports',
    component: () => import('@/views/Reports.vue')
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
