import { createRouter, createWebHashHistory, RouteRecordRaw } from 'vue-router'
import { useAuthStore } from './stores/auth'

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('./views/Login.vue')
  },
  {
    path: '/',
    component: () => import('./views/MainLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        redirect: '/dashboard'
      },
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('./views/Dashboard.vue'),
        meta: { permission: 'view_devices' }
      },
      {
        path: 'devices',
        name: 'Devices',
        component: () => import('./views/Devices.vue'),
        meta: { permission: 'view_devices' }
      },
      {
        path: 'borrows',
        name: 'Borrows',
        component: () => import('./views/Borrows.vue'),
        meta: { permission: 'view_history' }
      },
      {
        path: 'logs',
        name: 'Logs',
        component: () => import('./views/Logs.vue'),
        meta: { permission: 'view_logs' }
      },
      {
        path: 'users',
        name: 'Users',
        component: () => import('./views/Users.vue'),
        meta: { permission: 'manage_users' }
      },
      {
        path: 'batch',
        name: 'Batch',
        component: () => import('./views/BatchOperations.vue'),
        meta: { permission: 'batch_operations' }
      },
      {
        path: 'retry',
        name: 'Retry',
        component: () => import('./views/RetryQueue.vue'),
        meta: { permission: 'system_settings' }
      }
    ]
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

router.beforeEach(async (to, _from, next) => {
  const authStore = useAuthStore()

  if (to.path === '/login') {
    if (authStore.isAuthenticated) {
      next('/')
    } else {
      next()
    }
    return
  }

  if (!authStore.isAuthenticated) {
    next('/login')
    return
  }

  if (to.meta?.permission && authStore.currentUser) {
    const hasPermission = authStore.permissions.includes(to.meta.permission as any)
    if (!hasPermission) {
      next('/dashboard')
      return
    }
  }

  next()
})

export default router
