import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: () => import('../views/Home.vue')
  },
  {
    path: '/batches',
    name: 'Batches',
    component: () => import('../views/Batches.vue')
  },
  {
    path: '/transactions',
    name: 'Transactions',
    component: () => import('../views/Transactions.vue')
  },
  {
    path: '/snapshots',
    name: 'Snapshots',
    component: () => import('../views/Snapshots.vue')
  },
  {
    path: '/review',
    name: 'Review',
    component: () => import('../views/Review.vue')
  },
  {
    path: '/chain/:batchId',
    name: 'ProcessChain',
    component: () => import('../views/ProcessChain.vue')
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
