import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: '/sessions',
  },
  {
    path: '/sessions',
    name: 'Sessions',
    component: () => import('@/views/SessionsView.vue'),
    meta: { title: '赛事管理' },
  },
  {
    path: '/import',
    name: 'Import',
    component: () => import('@/views/ImportView.vue'),
    meta: { title: '数据导入' },
  },
  {
    path: '/review',
    name: 'Review',
    component: () => import('@/views/ReviewView.vue'),
    meta: { title: '风险复核' },
  },
  {
    path: '/export',
    name: 'Export',
    component: () => import('@/views/ExportView.vue'),
    meta: { title: '报告导出' },
  },
  {
    path: '/settings',
    name: 'Settings',
    component: () => import('@/views/SettingsView.vue'),
    meta: { title: '设置' },
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach((to, _from, next) => {
  document.title = `${to.meta.title || '马术俱乐部赛前预检工具'} - 马术俱乐部`
  next()
})

export default router
