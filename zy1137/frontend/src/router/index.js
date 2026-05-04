import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'Dashboard',
    component: () => import('@/views/Dashboard.vue'),
    meta: { title: '设备看板' }
  },
  {
    path: '/devices',
    name: 'Devices',
    component: () => import('@/views/Devices.vue'),
    meta: { title: '设备管理' }
  },
  {
    path: '/devices/:id',
    name: 'DeviceDetail',
    component: () => import('@/views/DeviceDetail.vue'),
    meta: { title: '设备详情' }
  },
  {
    path: '/zones',
    name: 'Zones',
    component: () => import('@/views/Zones.vue'),
    meta: { title: '区域视图' }
  },
  {
    path: '/zones/:id',
    name: 'ZoneDetail',
    component: () => import('@/views/ZoneDetail.vue'),
    meta: { title: '区域详情' }
  },
  {
    path: '/anomalies',
    name: 'Anomalies',
    component: () => import('@/views/Anomalies.vue'),
    meta: { title: '异常队列' }
  },
  {
    path: '/import',
    name: 'Import',
    component: () => import('@/views/Import.vue'),
    meta: { title: '数据导入' }
  },
  {
    path: '/reports',
    name: 'Reports',
    component: () => import('@/views/Reports.vue'),
    meta: { title: '报告导出' }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior() {
    return { top: 0 }
  }
})

router.beforeEach((to, from, next) => {
  document.title = to.meta.title ? `${to.meta.title} - 蓝牙巡检工具` : '蓝牙巡检工具'
  next()
})

export default router
