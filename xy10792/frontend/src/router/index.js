import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'Dashboard',
    component: () => import('@/views/Dashboard.vue')
  },
  {
    path: '/resumes',
    name: 'Resumes',
    component: () => import('@/views/Resumes.vue')
  },
  {
    path: '/resumes/:id',
    name: 'ResumeDetail',
    component: () => import('@/views/ResumeDetail.vue')
  },
  {
    path: '/jobs',
    name: 'Jobs',
    component: () => import('@/views/Jobs.vue')
  },
  {
    path: '/export',
    name: 'Export',
    component: () => import('@/views/Export.vue')
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
