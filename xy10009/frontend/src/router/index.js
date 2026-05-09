import { createRouter, createWebHistory } from 'vue-router'
import store from '@/store'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/',
    component: () => import('@/views/Layout.vue'),
    redirect: '/dashboard',
    meta: { requiresAuth: true },
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('@/views/Dashboard.vue'),
        meta: { title: '仪表盘' }
      },
      {
        path: 'count-tasks',
        name: 'CountTasks',
        component: () => import('@/views/CountTasks.vue'),
        meta: { title: '盘点任务' }
      },
      {
        path: 'count-tasks/:id',
        name: 'CountTaskDetail',
        component: () => import('@/views/CountTaskDetail.vue'),
        meta: { title: '盘点详情' }
      },
      {
        path: 'count-tasks/:id/perform',
        name: 'CountTaskPerform',
        component: () => import('@/views/CountTaskPerform.vue'),
        meta: { title: '执行盘点' }
      },
      {
        path: 'warehouses',
        name: 'Warehouses',
        component: () => import('@/views/Warehouses.vue'),
        meta: { title: '仓库管理', requiresAdmin: true }
      },
      {
        path: 'products',
        name: 'Products',
        component: () => import('@/views/Products.vue'),
        meta: { title: '商品管理', requiresAdmin: true }
      },
      {
        path: 'history',
        name: 'History',
        component: () => import('@/views/History.vue'),
        meta: { title: '操作日志' }
      }
    ]
  },
  {
    path: '/404',
    name: 'NotFound',
    component: () => import('@/views/NotFound.vue')
  }
]

const router = createRouter({
  history: createWebHistory(process.env.BASE_URL),
  routes
})

router.beforeEach((to, from, next) => {
  const isAuthenticated = store.getters.isAuthenticated
  const isAdmin = store.getters.isAdmin

  if (to.meta.requiresAuth) {
    if (!isAuthenticated) {
      next('/login')
      return
    }

    if (to.meta.requiresAdmin && !isAdmin) {
      next('/dashboard')
      return
    }
  }

  if (to.path === '/login' && isAuthenticated) {
    next('/dashboard')
    return
  }

  next()
})

export default router
