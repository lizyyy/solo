import { createRouter, createWebHistory } from 'vue-router'
import Dashboard from '../views/Dashboard.vue'
import Applications from '../views/Applications.vue'
import Tokens from '../views/Tokens.vue'
import Revocations from '../views/Revocations.vue'
import Tasks from '../views/Tasks.vue'
import AuditLog from '../views/AuditLog.vue'

const routes = [
  {
    path: '/',
    name: 'Dashboard',
    component: Dashboard
  },
  {
    path: '/applications',
    name: 'Applications',
    component: Applications
  },
  {
    path: '/tokens',
    name: 'Tokens',
    component: Tokens
  },
  {
    path: '/revocations',
    name: 'Revocations',
    component: Revocations
  },
  {
    path: '/tasks',
    name: 'Tasks',
    component: Tasks
  },
  {
    path: '/audit',
    name: 'AuditLog',
    component: AuditLog
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
