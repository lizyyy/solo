import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'TicketList',
    component: () => import('@/views/TicketList.vue')
  },
  {
    path: '/ticket/:id',
    name: 'TicketDetail',
    component: () => import('@/views/TicketDetail.vue')
  },
  {
    path: '/config',
    name: 'Config',
    component: () => import('@/views/Config.vue')
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
