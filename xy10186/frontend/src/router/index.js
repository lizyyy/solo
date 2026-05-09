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
    meta: { title: '工作台', icon: 'DataAnalysis' }
  },
  {
    path: '/referral-orders',
    name: 'ReferralOrders',
    component: () => import('@/views/ReferralOrders.vue'),
    meta: { title: '转诊单管理', icon: 'Document' }
  },
  {
    path: '/referral-orders/:id',
    name: 'ReferralOrderDetail',
    component: () => import('@/views/ReferralOrderDetail.vue'),
    meta: { title: '转诊单详情', hidden: true }
  },
  {
    path: '/appointments',
    name: 'Appointments',
    component: () => import('@/views/Appointments.vue'),
    meta: { title: '预约占用管理', icon: 'Calendar' }
  },
  {
    path: '/exam-results',
    name: 'ExamResults',
    component: () => import('@/views/ExamResults.vue'),
    meta: { title: '检查回传管理', icon: 'Reading' }
  },
  {
    path: '/exceptions',
    name: 'Exceptions',
    component: () => import('@/views/Exceptions.vue'),
    meta: { title: '异常提醒', icon: 'Warning' }
  },
  {
    path: '/patients',
    name: 'Patients',
    component: () => import('@/views/Patients.vue'),
    meta: { title: '患者管理', icon: 'User' }
  },
  {
    path: '/statistics',
    name: 'Statistics',
    component: () => import('@/views/Statistics.vue'),
    meta: { title: '统计分析', icon: 'TrendCharts' }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
