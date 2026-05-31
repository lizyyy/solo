import { createRouter, createWebHistory } from 'vue-router';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      redirect: '/timeline'
    },
    {
      path: '/timeline',
      name: 'Timeline',
      component: () => import('@/views/TimelineView.vue'),
      meta: { title: '时间线' }
    },
    {
      path: '/gate',
      name: 'Gate',
      component: () => import('@/views/GateView.vue'),
      meta: { title: '水利闸门操作' }
    },
    {
      path: '/import',
      name: 'Import',
      component: () => import('@/views/ImportView.vue'),
      meta: { title: '数据导入' }
    }
  ]
});

router.beforeEach((to, _from, next) => {
  document.title = `${to.meta.title || '培训评估时间线'} - 培训评估工具`;
  next();
});

export default router;
