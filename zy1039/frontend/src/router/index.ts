import { createRouter, createWebHistory } from 'vue-router';
import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'Home',
    component: () => import('@/views/Home.vue'),
    meta: { title: '项目列表' }
  },
  {
    path: '/editor/:projectId?',
    name: 'Editor',
    component: () => import('@/views/Editor.vue'),
    meta: { title: '状态机编辑器' }
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

router.beforeEach((to, _from, next) => {
  document.title = `${to.meta.title || 'Stateflow Rehearsal'} - 状态机演练工具`;
  next();
});

export default router;
