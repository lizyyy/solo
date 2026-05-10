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
    meta: { title: '工作台', icon: 'DataBoard' }
  },
  {
    path: '/patients',
    name: 'Patients',
    component: () => import('@/views/Patients.vue'),
    meta: { title: '患者列表', icon: 'User' }
  },
  {
    path: '/certificates',
    name: 'Certificates',
    component: () => import('@/views/Certificates.vue'),
    meta: { title: '证件办理', icon: 'Document' }
  },
  {
    path: '/replacements',
    name: 'Replacements',
    component: () => import('@/views/Replacements.vue'),
    meta: { title: '换人申请', icon: 'RefreshRight' }
  },
  {
    path: '/expiring',
    name: 'Expiring',
    component: () => import('@/views/Expiring.vue'),
    meta: { title: '过期提醒', icon: 'AlarmClock' }
  },
  {
    path: '/audit',
    name: 'Audit',
    component: () => import('@/views/Audit.vue'),
    meta: { title: '审计导出', icon: 'Download' }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
