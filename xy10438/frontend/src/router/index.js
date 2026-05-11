import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    redirect: '/dashboard'
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: () => import('@/views/Dashboard.vue'),
    meta: { title: '任务看板' }
  },
  {
    path: '/adjustments',
    name: 'Adjustments',
    component: () => import('@/views/Adjustments.vue'),
    meta: { title: '调价单管理' }
  },
  {
    path: '/adjustments/create',
    name: 'CreateAdjustment',
    component: () => import('@/views/AdjustmentForm.vue'),
    meta: { title: '创建调价单' }
  },
  {
    path: '/adjustments/:id',
    name: 'AdjustmentDetail',
    component: () => import('@/views/AdjustmentDetail.vue'),
    meta: { title: '调价单详情' }
  },
  {
    path: '/store-tasks',
    name: 'StoreTasks',
    component: () => import('@/views/StoreTasks.vue'),
    meta: { title: '门店任务' }
  },
  {
    path: '/store-tasks/:id',
    name: 'StoreTaskDetail',
    component: () => import('@/views/StoreTaskDetail.vue'),
    meta: { title: '任务详情' }
  },
  {
    path: '/exceptions',
    name: 'Exceptions',
    component: () => import('@/views/Exceptions.vue'),
    meta: { title: '异常管理' }
  },
  {
    path: '/products',
    name: 'Products',
    component: () => import('@/views/Products.vue'),
    meta: { title: '商品管理' }
  },
  {
    path: '/stores',
    name: 'Stores',
    component: () => import('@/views/Stores.vue'),
    meta: { title: '门店管理' }
  },
  {
    path: '/regions',
    name: 'Regions',
    component: () => import('@/views/Regions.vue'),
    meta: { title: '区域管理' }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, _from, next) => {
  document.title = to.meta.title ? `${to.meta.title} - 门店价签生效台` : '门店价签生效台'
  next()
})

export default router
