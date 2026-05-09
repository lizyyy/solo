import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue'),
    meta: { requiresAuth: false },
  },
  {
    path: '/',
    component: () => import('@/layouts/MainLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        redirect: '/dashboard',
      },
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('@/views/Dashboard.vue'),
        meta: { title: '仪表盘' },
      },
      {
        path: 'push',
        name: 'PushList',
        component: () => import('@/views/PushList.vue'),
        meta: { title: '推送管理' },
      },
      {
        path: 'push/create',
        name: 'PushCreate',
        component: () => import('@/views/PushForm.vue'),
        meta: { title: '创建推送', requiresRole: ['admin', 'operator'] },
      },
      {
        path: 'push/:id/edit',
        name: 'PushEdit',
        component: () => import('@/views/PushForm.vue'),
        meta: { title: '编辑推送', requiresRole: ['admin', 'operator'] },
      },
      {
        path: 'push/:id',
        name: 'PushDetail',
        component: () => import('@/views/PushDetail.vue'),
        meta: { title: '推送详情' },
      },
      {
        path: 'audit',
        name: 'Audit',
        component: () => import('@/views/AuditLog.vue'),
        meta: { title: '操作日志', requiresRole: ['admin', 'viewer'] },
      },
    ],
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach(async (to, _from, next) => {
  const authStore = useAuthStore()
  
  if (!authStore.user && authStore.token) {
    await authStore.fetchProfile()
  }
  
  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    next({ path: '/login', query: { redirect: to.fullPath } })
    return
  }
  
  if (to.path === '/login' && authStore.isAuthenticated) {
    next('/')
    return
  }
  
  const requiredRoles = to.meta.requiresRole as string[] | undefined
  if (requiredRoles && authStore.user && !requiredRoles.includes(authStore.user.role)) {
    next('/dashboard')
    return
  }
  
  next()
})

export default router
