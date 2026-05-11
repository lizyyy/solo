import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

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
        meta: { title: '工作台' }
      },
      {
        path: 'decorations',
        name: 'Decorations',
        component: () => import('@/views/Decorations.vue'),
        meta: { title: '装修管理' }
      },
      {
        path: 'deposits',
        name: 'Deposits',
        component: () => import('@/views/Deposits.vue'),
        meta: { title: '押金流水' }
      },
      {
        path: 'inspections',
        name: 'Inspections',
        component: () => import('@/views/Inspections.vue'),
        meta: { title: '巡查记录' }
      },
      {
        path: 'refunds',
        name: 'Refunds',
        component: () => import('@/views/Refunds.vue'),
        meta: { title: '退押审核' }
      },
      {
        path: 'owners',
        name: 'Owners',
        component: () => import('@/views/Owners.vue'),
        meta: { title: '业主管理' }
      },
      {
        path: 'rooms',
        name: 'Rooms',
        component: () => import('@/views/Rooms.vue'),
        meta: { title: '房号管理' }
      },
      {
        path: 'decoration/:id',
        name: 'DecorationDetail',
        component: () => import('@/views/DecorationDetail.vue'),
        meta: { title: '装修详情' }
      }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  const authStore = useAuthStore()
  
  if (to.meta.requiresAuth && !authStore.isLoggedIn) {
    next('/login')
  } else if (to.path === '/login' && authStore.isLoggedIn) {
    next('/dashboard')
  } else {
    next()
  }
})

export default router
