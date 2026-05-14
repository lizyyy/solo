import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    redirect: '/translation'
  },
  {
    path: '/translation',
    name: 'Translation',
    component: () => import('@/views/Translation.vue')
  },
  {
    path: '/version',
    name: 'Version',
    component: () => import('@/views/Version.vue')
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
