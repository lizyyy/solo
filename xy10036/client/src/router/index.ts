import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: '/devices'
  },
  {
    path: '/devices',
    name: 'Devices',
    component: () => import('../views/Devices.vue'),
    meta: { title: '设备管理' }
  },
  {
    path: '/borrow',
    name: 'Borrow',
    component: () => import('../views/BorrowRecords.vue'),
    meta: { title: '借用记录' }
  },
  {
    path: '/audit',
    name: 'Audit',
    component: () => import('../views/AuditLogs.vue'),
    meta: { title: '操作日志' }
  },
  {
    path: '/reports',
    name: 'Reports',
    component: () => import('../views/Reports.vue'),
    meta: { title: '报表导出' }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, _from, next) => {
  document.title = `${to.meta.title || '设备借用管理系统'}`
  next()
})

export default router
