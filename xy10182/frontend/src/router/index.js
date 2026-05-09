import { createRouter, createWebHashHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    redirect: '/dashboard'
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: () => import('../views/Dashboard.vue'),
    meta: { title: '工作台概览', icon: 'DataBoard' }
  },
  {
    path: '/reagents',
    name: 'Reagents',
    component: () => import('../views/ReagentList.vue'),
    meta: { title: '试剂管理', icon: 'Box' }
  },
  {
    path: '/reagents/:id',
    name: 'ReagentDetail',
    component: () => import('../views/ReagentDetail.vue'),
    meta: { title: '试剂详情', hidden: true }
  },
  {
    path: '/batches',
    name: 'Batches',
    component: () => import('../views/BatchList.vue'),
    meta: { title: '批次库存', icon: 'ShoppingBag' }
  },
  {
    path: '/batches/:id',
    name: 'BatchDetail',
    component: () => import('../views/BatchDetail.vue'),
    meta: { title: '批次详情', hidden: true }
  },
  {
    path: '/records',
    name: 'Records',
    component: () => import('../views/RecordList.vue'),
    meta: { title: '操作记录', icon: 'Document' }
  },
  {
    path: '/scan',
    name: 'Scan',
    component: () => import('../views/ScanOperation.vue'),
    meta: { title: '扫码操作', icon: 'Camera' }
  },
  {
    path: '/alerts',
    name: 'Alerts',
    component: () => import('../views/AlertList.vue'),
    meta: { title: '预警中心', icon: 'Bell' }
  },
  {
    path: '/import-export',
    name: 'ImportExport',
    component: () => import('../views/ImportExport.vue'),
    meta: { title: '导入导出', icon: 'Download' }
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  if (to.meta.title) {
    document.title = `${to.meta.title} - 实验室试剂领用追溯台`
  }
  next()
})

export default router
