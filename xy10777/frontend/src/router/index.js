import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    redirect: '/dashboard'
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: () => import('@/views/Dashboard.vue')
  },
  {
    path: '/geofences',
    name: 'Geofences',
    component: () => import('@/views/GeofenceList.vue')
  },
  {
    path: '/devices',
    name: 'Devices',
    component: () => import('@/views/DeviceList.vue')
  },
  {
    path: '/alerts',
    name: 'Alerts',
    component: () => import('@/views/AlertList.vue')
  },
  {
    path: '/trajectory',
    name: 'Trajectory',
    component: () => import('@/views/TrajectoryPlayback.vue')
  },
  {
    path: '/reports',
    name: 'Reports',
    component: () => import('@/views/ReportList.vue')
  },
  {
    path: '/config',
    name: 'Config',
    component: () => import('@/views/ConfigPage.vue')
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router