import { createRouter, createWebHistory } from 'vue-router'
import RepairList from '../views/RepairList.vue'
import RepairDetail from '../views/RepairDetail.vue'

const routes = [
  { path: '/', redirect: '/repairs' },
  { path: '/repairs', component: RepairList },
  { path: '/repairs/:id', component: RepairDetail },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
