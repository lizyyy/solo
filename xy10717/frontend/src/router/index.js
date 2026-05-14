import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'MigrationList',
    component: () => import('@/views/MigrationList.vue')
  },
  {
    path: '/create',
    name: 'CreateMigration',
    component: () => import('@/views/CreateMigration.vue')
  },
  {
    path: '/detail/:id',
    name: 'MigrationDetail',
    component: () => import('@/views/MigrationDetail.vue')
  },
  {
    path: '/logs',
    name: 'ExecutionLogs',
    component: () => import('@/views/ExecutionLogs.vue')
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router