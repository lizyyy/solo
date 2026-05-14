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
    meta: { title: '数据概览' }
  },
  {
    path: '/templates',
    name: 'Templates',
    component: () => import('@/views/Templates.vue'),
    meta: { title: '模板管理' }
  },
  {
    path: '/templates/:id',
    name: 'TemplateDetail',
    component: () => import('@/views/TemplateDetail.vue'),
    meta: { title: '模板详情' }
  },
  {
    path: '/batches',
    name: 'Batches',
    component: () => import('@/views/Batches.vue'),
    meta: { title: '批次管理' }
  },
  {
    path: '/batches/:id',
    name: 'BatchDetail',
    component: () => import('@/views/BatchDetail.vue'),
    meta: { title: '批次详情' }
  },
  {
    path: '/approvals',
    name: 'Approvals',
    component: () => import('@/views/Approvals.vue'),
    meta: { title: '审批中心' }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
