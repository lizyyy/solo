import { createRouter, createWebHistory } from 'vue-router'
import SyncDashboard from '../views/SyncDashboard.vue'

const routes = [
  {
    path: '/',
    name: 'SyncDashboard',
    component: SyncDashboard
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
