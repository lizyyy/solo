import { createRouter, createWebHistory } from 'vue-router'
import Dashboard from '../views/Dashboard.vue'
import Boxes from '../views/Boxes.vue'
import Batches from '../views/Batches.vue'
import Borrows from '../views/Borrows.vue'
import Returns from '../views/Returns.vue'
import Supplies from '../views/Supplies.vue'
import ExpiryRisks from '../views/ExpiryRisks.vue'
import Logs from '../views/Logs.vue'

const routes = [
  { path: '/', component: Dashboard },
  { path: '/boxes', component: Boxes },
  { path: '/batches', component: Batches },
  { path: '/borrows', component: Borrows },
  { path: '/returns', component: Returns },
  { path: '/supplies', component: Supplies },
  { path: '/expiry-risks', component: ExpiryRisks },
  { path: '/logs', component: Logs }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
