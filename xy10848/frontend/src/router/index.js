import { createRouter, createWebHistory } from 'vue-router'
import Dashboard from '../views/Dashboard.vue'
import Requests from '../views/Requests.vue'
import RequestDetail from '../views/RequestDetail.vue'
import Credits from '../views/Credits.vue'
import Reports from '../views/Reports.vue'

const routes = [
  { path: '/', name: 'Dashboard', component: Dashboard },
  { path: '/requests', name: 'Requests', component: Requests },
  { path: '/requests/:id', name: 'RequestDetail', component: RequestDetail },
  { path: '/credits', name: 'Credits', component: Credits },
  { path: '/reports', name: 'Reports', component: Reports }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
