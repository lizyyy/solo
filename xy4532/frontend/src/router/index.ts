import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: '/dashboard',
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: () => import('@/views/Dashboard.vue'),
    meta: { title: '仪表盘', icon: 'DataLine' },
  },
  {
    path: '/turbines',
    name: 'Turbines',
    component: () => import('@/views/Turbines/index.vue'),
    meta: { title: '风机管理', icon: 'Cpu' },
  },
  {
    path: '/turbines/:id',
    name: 'TurbineDetail',
    component: () => import('@/views/Turbines/Detail.vue'),
    meta: { title: '风机详情', hidden: true },
  },
  {
    path: '/inspections',
    name: 'Inspections',
    component: () => import('@/views/Inspections/index.vue'),
    meta: { title: '巡检管理', icon: 'Document' },
  },
  {
    path: '/inspections/:id',
    name: 'InspectionDetail',
    component: () => import('@/views/Inspections/Detail.vue'),
    meta: { title: '巡检详情', hidden: true },
  },
  {
    path: '/risk-assessments',
    name: 'RiskAssessments',
    component: () => import('@/views/RiskAssessments/index.vue'),
    meta: { title: '风险评估', icon: 'Warning' },
  },
  {
    path: '/risk-assessments/:id',
    name: 'RiskAssessmentDetail',
    component: () => import('@/views/RiskAssessments/Detail.vue'),
    meta: { title: '评估详情', hidden: true },
  },
  {
    path: '/data-import',
    name: 'DataImport',
    component: () => import('@/views/DataManagement/Import.vue'),
    meta: { title: '数据导入', icon: 'Upload' },
  },
  {
    path: '/data-export',
    name: 'DataExport',
    component: () => import('@/views/DataManagement/Export.vue'),
    meta: { title: '数据导出', icon: 'Download' },
  },
  {
    path: '/alarms',
    name: 'Alarms',
    component: () => import('@/views/DataManagement/Alarms.vue'),
    meta: { title: 'SCADA告警', icon: 'Bell' },
  },
  {
    path: '/work-orders',
    name: 'WorkOrders',
    component: () => import('@/views/DataManagement/WorkOrders.vue'),
    meta: { title: '维修工单', icon: 'List' },
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach((to, _from, next) => {
  document.title = to.meta.title ? `${to.meta.title} - 海上风电运维AI初筛工具` : '海上风电运维AI初筛工具'
  next()
})

export default router
