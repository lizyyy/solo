import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'ComponentList',
    component: () => import('../views/ComponentList.vue')
  },
  {
    path: '/components/:id',
    name: 'ComponentDetail',
    component: () => import('../views/ComponentDetail.vue')
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
