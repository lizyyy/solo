import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '@/views/HomeView.vue'
import ExperimentCreateView from '@/views/ExperimentCreateView.vue'
import ExperimentDetailView from '@/views/ExperimentDetailView.vue'
import LearningView from '@/views/LearningView.vue'

const routes = [
  {
    path: '/',
    name: 'home',
    component: HomeView,
    meta: { title: '实验台首页' }
  },
  {
    path: '/create',
    name: 'create',
    component: ExperimentCreateView,
    meta: { title: '创建实验' }
  },
  {
    path: '/experiment/:id',
    name: 'experiment-detail',
    component: ExperimentDetailView,
    meta: { title: '实验详情' }
  },
  {
    path: '/learning',
    name: 'learning',
    component: LearningView,
    meta: { title: '学习资源' }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) {
      return savedPosition
    } else {
      return { top: 0 }
    }
  }
})

router.beforeEach((to, from, next) => {
  document.title = `Reactor/Proactor 实验台 - ${to.meta.title || '首页'}`
  next()
})

export default router
