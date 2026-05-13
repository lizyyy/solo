import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  { path: '/', redirect: '/screenings' },
  { path: '/screenings', component: () => import('../views/Screenings.vue') },
  { path: '/cleaning', component: () => import('../views/Cleaning.vue') },
  { path: '/cleaning/:id', component: () => import('../views/CleaningDetail.vue') },
  { path: '/inspections', component: () => import('../views/Inspections.vue') },
  { path: '/inspections/:id', component: () => import('../views/InspectionDetail.vue') },
  { path: '/shifts', component: () => import('../views/Shifts.vue') },
  { path: '/positions', component: () => import('../views/Positions.vue') },
  { path: '/uncovered', component: () => import('../views/Uncovered.vue') },
  { path: '/staff', component: () => import('../views/Staff.vue') },
  { path: '/reports', component: () => import('../views/Reports.vue') }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
