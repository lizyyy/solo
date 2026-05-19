import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'Dashboard',
      component: () => import('@/views/Dashboard.vue')
    },
    {
      path: '/progress',
      name: 'Progress',
      component: () => import('@/views/Progress.vue')
    },
    {
      path: '/remedial',
      name: 'Remedial',
      component: () => import('@/views/Remedial.vue')
    },
    {
      path: '/certificates',
      name: 'Certificates',
      component: () => import('@/views/Certificates.vue')
    },
    {
      path: '/reports',
      name: 'Reports',
      component: () => import('@/views/Reports.vue')
    },
    {
      path: '/logs',
      name: 'Logs',
      component: () => import('@/views/Logs.vue')
    }
  ]
})

export default router
