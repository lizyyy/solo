import { createRouter, createWebHashHistory } from 'vue-router'
import Dashboard from '../views/Dashboard.vue'
import Batches from '../views/Batches.vue'
import Appointments from '../views/Appointments.vue'
import Chemicals from '../views/Chemicals.vue'
import DarkBags from '../views/DarkBags.vue'
import Pickup from '../views/Pickup.vue'
import Audit from '../views/Audit.vue'

const routes = [
  {
    path: '/',
    name: 'Dashboard',
    component: Dashboard,
    meta: { title: '仪表盘' }
  },
  {
    path: '/batches',
    name: 'Batches',
    component: Batches,
    meta: { title: '批次管理' }
  },
  {
    path: '/appointments',
    name: 'Appointments',
    component: Appointments,
    meta: { title: '预约管理' }
  },
  {
    path: '/chemicals',
    name: 'Chemicals',
    component: Chemicals,
    meta: { title: '药液管理' }
  },
  {
    path: '/darkbags',
    name: 'DarkBags',
    component: DarkBags,
    meta: { title: '暗袋管理' }
  },
  {
    path: '/pickup',
    name: 'Pickup',
    component: Pickup,
    meta: { title: '取片登记' }
  },
  {
    path: '/audit',
    name: 'Audit',
    component: Audit,
    meta: { title: '审计日志' }
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  document.title = to.meta.title + ' - 胶片暗房管理系统'
  next()
})

export default router
