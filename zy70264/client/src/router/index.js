import { createRouter, createWebHistory } from 'vue-router';

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
    path: '/batches',
    name: 'Batches',
    component: () => import('@/views/Batches.vue'),
    meta: { title: '配送批次管理' }
  },
  {
    path: '/batches/:id',
    name: 'BatchDetail',
    component: () => import('@/views/BatchDetail.vue'),
    meta: { title: '批次详情' }
  },
  {
    path: '/receipts',
    name: 'Receipts',
    component: () => import('@/views/Receipts.vue'),
    meta: { title: '签收回执' }
  },
  {
    path: '/return-review',
    name: 'ReturnReview',
    component: () => import('@/views/ReturnReview.vue'),
    meta: { title: '退餐审核' }
  },
  {
    path: '/compensation-review',
    name: 'CompensationReview',
    component: () => import('@/views/CompensationReview.vue'),
    meta: { title: '补偿审核' }
  },
  {
    path: '/compensation-rules',
    name: 'CompensationRules',
    component: () => import('@/views/CompensationRules.vue'),
    meta: { title: '补偿规则配置' }
  },
  {
    path: '/safety-incidents',
    name: 'SafetyIncidents',
    component: () => import('@/views/SafetyIncidents.vue'),
    meta: { title: '食品安全事件' }
  },
  {
    path: '/exports',
    name: 'Exports',
    component: () => import('@/views/Exports.vue'),
    meta: { title: '数据导出' }
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

router.beforeEach((to, from, next) => {
  document.title = to.meta.title ? `${to.meta.title} - 养老餐配送温度追踪台` : '养老餐配送温度追踪台';
  next();
});

export default router;
