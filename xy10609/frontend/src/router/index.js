import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'Dashboard',
    component: () => import('../views/Dashboard.vue')
  },
  {
    path: '/pre-review',
    name: 'PreReview',
    component: () => import('../views/PreReview.vue')
  },
  {
    path: '/matters',
    name: 'Matters',
    component: () => import('../views/Matters.vue')
  },
  {
    path: '/identity',
    name: 'Identity',
    component: () => import('../views/Identity.vue')
  },
  {
    path: '/attachments',
    name: 'Attachments',
    component: () => import('../views/Attachments.vue')
  },
  {
    path: '/correction-opinions',
    name: 'CorrectionOpinions',
    component: () => import('../views/CorrectionOpinions.vue')
  },
  {
    path: '/window-acceptances',
    name: 'WindowAcceptances',
    component: () => import('../views/WindowAcceptances.vue')
  },
  {
    path: '/gaps',
    name: 'Gaps',
    component: () => import('../views/Gaps.vue')
  },
  {
    path: '/exceptions',
    name: 'Exceptions',
    component: () => import('../views/Exceptions.vue')
  },
  {
    path: '/report',
    name: 'Report',
    component: () => import('../views/Report.vue')
  },
  {
    path: '/history',
    name: 'History',
    component: () => import('../views/History.vue')
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
