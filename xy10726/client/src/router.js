import { createRouter, createWebHistory } from 'vue-router'
import Dashboard from './views/Dashboard.vue'
import InvoiceDetail from './views/InvoiceDetail.vue'

const routes = [
  { path: '/', name: 'Dashboard', component: Dashboard },
  { path: '/invoice/:id', name: 'InvoiceDetail', component: Dashboard }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
