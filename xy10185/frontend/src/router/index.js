import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'ProjectList',
    component: () => import('@/views/ProjectList.vue'),
    meta: { title: '项目列表' }
  },
  {
    path: '/project/:id',
    name: 'ProjectDetail',
    component: () => import('@/views/ProjectDetail.vue'),
    meta: { title: '项目详情' }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  document.title = to.meta.title ? `${to.meta.title} - 外包交付验收门户` : '外包交付验收门户'
  next()
})

export default router