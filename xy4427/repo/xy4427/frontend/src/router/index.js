import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'

const routes = [
  {
    path: '/',
    name: 'home',
    component: HomeView,
    meta: { title: '首页概览' }
  },
  {
    path: '/import',
    name: 'import',
    component: () => import('../views/ImportView.vue'),
    meta: { title: '数据导入' }
  },
  {
    path: '/risks',
    name: 'risks',
    component: () => import('../views/RisksView.vue'),
    meta: { title: '风险检测' }
  },
  {
    path: '/review',
    name: 'review',
    component: () => import('../views/ReviewView.vue'),
    meta: { title: '复核处理' }
  },
  {
    path: '/export',
    name: 'export',
    component: () => import('../views/ExportView.vue'),
    meta: { title: '导出放行' }
  }
]

const router = createRouter({
  history: createWebHistory(process.env.BASE_URL),
  routes
})

router.beforeEach((to, from, next) => {
  document.title = `${to.meta.title || '盲文教材转印放行工具'}`
  next()
})

export default router
