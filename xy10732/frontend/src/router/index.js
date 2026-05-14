import { createRouter, createWebHistory } from 'vue-router'
import Calendar from '../views/Calendar.vue'
import Tasks from '../views/Tasks.vue'
import Dashboard from '../views/Dashboard.vue'

const routes = [
  { path: '/', redirect: '/calendar' },
  { path: '/calendar', component: Calendar },
  { path: '/tasks', component: Tasks },
  { path: '/dashboard', component: Dashboard }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
