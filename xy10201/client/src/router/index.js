import { createRouter, createWebHistory } from 'vue-router';

const routes = [
  {
    path: '/',
    name: 'Dashboard',
    component: () => import('../views/Dashboard.vue'),
    meta: { title: '工作台', icon: 'HomeFilled' }
  },
  {
    path: '/treatments',
    name: 'Treatments',
    component: () => import('../views/Treatments.vue'),
    meta: { title: '诊疗项目', icon: 'List' }
  },
  {
    path: '/consumption',
    name: 'Consumption',
    component: () => import('../views/Consumption.vue'),
    meta: { title: '耗材消耗', icon: 'Minus' }
  },
  {
    path: '/materials',
    name: 'Materials',
    component: () => import('../views/Materials.vue'),
    meta: { title: '库存管理', icon: 'Box' }
  },
  {
    path: '/replenishment',
    name: 'Replenishment',
    component: () => import('../views/Replenishment.vue'),
    meta: { title: '补货申请', icon: 'Plus' }
  },
  {
    path: '/audit',
    name: 'Audit',
    component: () => import('../views/Audit.vue'),
    meta: { title: '审核中心', icon: 'DocumentChecked' }
  },
  {
    path: '/history',
    name: 'History',
    component: () => import('../views/History.vue'),
    meta: { title: '历史追溯', icon: 'Clock' }
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

router.beforeEach((to, from, next) => {
  document.title = `${to.meta.title || '牙科椅旁耗材补货台'} - 牙科椅旁耗材补货台`;
  next();
});

export default router;
