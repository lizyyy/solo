import { createRouter, createWebHistory } from 'vue-router';

const routes = [
  {
    path: '/',
    redirect: '/dashboard',
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: () => import('@/views/Dashboard.vue'),
    meta: { title: '总览' },
  },
  {
    path: '/tenants',
    name: 'Tenants',
    component: () => import('@/views/Tenants.vue'),
    meta: { title: '租户管理' },
  },
  {
    path: '/interface-groups',
    name: 'InterfaceGroups',
    component: () => import('@/views/InterfaceGroups.vue'),
    meta: { title: '接口分组' },
  },
  {
    path: '/rules',
    name: 'Rules',
    component: () => import('@/views/Rules.vue'),
    meta: { title: '规则管理' },
  },
  {
    path: '/releases',
    name: 'Releases',
    component: () => import('@/views/Releases.vue'),
    meta: { title: '发布批次' },
  },
  {
    path: '/preview',
    name: 'Preview',
    component: () => import('@/views/Preview.vue'),
    meta: { title: '策略预演' },
  },
  {
    path: '/hit-logs',
    name: 'HitLogs',
    component: () => import('@/views/HitLogs.vue'),
    meta: { title: '命中日志' },
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach((to, from, next) => {
  document.title = `${to.meta.title || '错峰限流策略台'} - 错峰限流策略台`;
  next();
});

export default router;
