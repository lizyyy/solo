import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: '/simulator'
  },
  {
    path: '/simulator',
    name: 'Simulator',
    component: () => import('@/views/Simulator.vue'),
    meta: { title: '实验工作台' }
  },
  {
    path: '/experiments',
    name: 'Experiments',
    component: () => import('@/views/Experiments.vue'),
    meta: { title: '实验管理' }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, _from, next) => {
  document.title = to.meta.title as string || '操作系统机制实验台'
  next()
})

export default router
