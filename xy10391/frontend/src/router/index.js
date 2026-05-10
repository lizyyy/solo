import { createRouter, createWebHistory } from 'vue-router'
import { useUserStore } from '@/stores/user'

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
        meta: { title: '工作总览', icon: 'Odometer', roles: ['admin', 'manager', 'staff'] }
      },
      {
        path: 'members',
        name: 'Members',
        component: () => import('@/views/Members.vue'),
        meta: { title: '会员管理', icon: 'User', roles: ['admin', 'manager', 'staff'] }
      },
      {
        path: 'members/:id',
        name: 'MemberDetail',
        component: () => import('@/views/MemberDetail.vue'),
        meta: { title: '会员详情', icon: 'User', roles: ['admin', 'manager', 'staff'], hidden: true }
      },
      {
        path: 'payments',
        name: 'Payments',
        component: () => import('@/views/Payments.vue'),
        meta: { title: '缴费记录', icon: 'Money', roles: ['admin', 'manager', 'staff'] }
      },
      {
        path: 'reductions',
        name: 'Reductions',
        component: () => import('@/views/Reductions.vue'),
        meta: { title: '减免审批', icon: 'Discount', roles: ['admin', 'manager', 'staff'] }
      },
      {
        path: 'fee-rules',
        name: 'FeeRules',
        component: () => import('@/views/FeeRules.vue'),
        meta: { title: '会费规则', icon: 'Tickets', roles: ['admin', 'manager'] }
      },
      {
        path: 'reports',
        name: 'Reports',
        component: () => import('@/views/Reports.vue'),
        meta: { title: '年度报表', icon: 'DataLine', roles: ['admin', 'manager', 'staff'] }
      }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  const userStore = useUserStore()

  if (to.meta.requiresAuth !== false) {
    if (!userStore.isLoggedIn) {
      next({ path: '/login', query: { redirect: to.fullPath } })
      return
    }

    if (to.meta.roles && !to.meta.roles.includes(userStore.role)) {
      next('/dashboard')
      return
    }
  } else if (to.path === '/login' && userStore.isLoggedIn) {
    next('/dashboard')
    return
  }

  next()
})

export default router
