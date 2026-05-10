import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    redirect: '/prescriptions'
  },
  {
    path: '/prescriptions',
    name: 'Prescriptions',
    component: () => import('../views/PrescriptionList.vue')
  },
  {
    path: '/prescriptions/:id',
    name: 'PrescriptionDetail',
    component: () => import('../views/PrescriptionDetail.vue')
  },
  {
    path: '/summary',
    name: 'Summary',
    component: () => import('../views/Summary.vue')
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
