import { createRouter, createWebHistory } from 'vue-router'
import Layout from '@/layout/index.vue'

const routes = [
  {
    path: '/',
    component: Layout,
    redirect: '/dashboard',
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('@/views/Dashboard/index.vue'),
        meta: { title: '数据概览', icon: 'Odometer' }
      },
      {
        path: 'import',
        name: 'DataImport',
        component: () => import('@/views/DataImport/index.vue'),
        meta: { title: '数据导入', icon: 'Upload' }
      },
      {
        path: 'risk',
        name: 'RiskManagement',
        component: () => import('@/views/RiskManagement/index.vue'),
        meta: { title: '风险管理', icon: 'Warning' }
      },
      {
        path: 'escalator',
        name: 'EscalatorList',
        component: () => import('@/views/EscalatorList/index.vue'),
        meta: { title: '扶梯列表', icon: 'SetUp' }
      },
      {
        path: 'export',
        name: 'DataExport',
        component: () => import('@/views/DataExport/index.vue'),
        meta: { title: '数据导出', icon: 'Download' }
      }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
