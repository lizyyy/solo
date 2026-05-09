import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router';
import { useUserStore } from '@/stores/user';
import NProgress from 'nprogress';
import 'nprogress/nprogress.css';

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/login/index.vue'),
    meta: { title: '登录', requiresAuth: false },
  },
  {
    path: '/',
    component: () => import('@/layout/index.vue'),
    redirect: '/dashboard',
    meta: { requiresAuth: true },
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('@/views/dashboard/index.vue'),
        meta: { title: '仪表盘', icon: 'DataBoard' },
      },
      {
        path: 'inventory',
        name: 'Inventory',
        component: () => import('@/views/inventory/index.vue'),
        meta: { title: '库存管理', icon: 'Goods' },
      },
      {
        path: 'inventory/records',
        name: 'InventoryRecords',
        component: () => import('@/views/inventory/records.vue'),
        meta: { title: '库存变动记录', icon: 'Document' },
      },
      {
        path: 'inventory/transfers',
        name: 'Transfers',
        component: () => import('@/views/inventory/transfers.vue'),
        meta: { title: '门店调拨', icon: 'Transfer' },
      },
      {
        path: 'products',
        name: 'Products',
        component: () => import('@/views/products/index.vue'),
        meta: { title: '商品管理', icon: 'ShoppingBag' },
      },
      {
        path: 'stores',
        name: 'Stores',
        component: () => import('@/views/stores/index.vue'),
        meta: { title: '门店管理', icon: 'OfficeBuilding' },
      },
      {
        path: 'audit',
        name: 'Audit',
        component: () => import('@/views/audit/index.vue'),
        meta: { title: '审计日志', icon: 'List' },
      },
      {
        path: 'export',
        name: 'Export',
        component: () => import('@/views/export/index.vue'),
        meta: { title: '报表导出', icon: 'Download' },
      },
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('@/views/error/404.vue'),
    meta: { title: '页面不存在' },
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
});

router.beforeEach(async (to, from, next) => {
  NProgress.start();

  const userStore = useUserStore();

  if (to.meta.requiresAuth !== false && !userStore.isLoggedIn) {
    next({ path: '/login', query: { redirect: to.fullPath } });
    return;
  }

  if (to.path === '/login' && userStore.isLoggedIn) {
    next('/');
    return;
  }

  if (userStore.isLoggedIn && !userStore.user) {
    userStore.initFromStorage();
  }

  next();
});

router.afterEach((to) => {
  document.title = (to.meta.title as string) || '门店库存管理系统';
  NProgress.done();
});

export default router;
