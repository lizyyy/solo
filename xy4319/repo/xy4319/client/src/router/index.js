import { createRouter, createWebHistory } from 'vue-router'
import Dashboard from '../views/Dashboard.vue'
import Patients from '../views/Patients.vue'
import Transfers from '../views/Transfers.vue'
import Departments from '../views/Departments.vue'
import Logs from '../views/Logs.vue'
import Reports from '../views/Reports.vue'
import Settings from '../views/Settings.vue'

const routes = [
  {
    path: '/',
    redirect: '/dashboard'
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: Dashboard,
    meta: { title: '仪表板', icon: '📊' }
  },
  {
    path: '/patients',
    name: 'Patients',
    component: Patients,
    meta: { title: '患者管理', icon: '👥' }
  },
  {
    path: '/transfers',
    name: 'Transfers',
    component: Transfers,
    meta: { title: '转运队列', icon: '🚑' }
  },
  {
    path: '/departments',
    name: 'Departments',
    component: Departments,
    meta: { title: '科室床位', icon: '🏥' }
  },
  {
    path: '/logs',
    name: 'Logs',
    component: Logs,
    meta: { title: '操作日志', icon: '📝' }
  },
  {
    path: '/reports',
    name: 'Reports',
    component: Reports,
    meta: { title: '报表导出', icon: '📄' }
  },
  {
    path: '/settings',
    name: 'Settings',
    component: Settings,
    meta: { title: '系统设置', icon: '⚙️' }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  document.title = to.meta.title ? `${to.meta.title} - 分诊转运压测台` : '分诊转运压测台'
  next()
})

export default router
