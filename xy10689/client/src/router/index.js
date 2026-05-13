import { createRouter, createWebHistory } from 'vue-router'
import Dashboard from '../views/Dashboard.vue'
import Booking from '../views/Booking.vue'
import Device from '../views/Device.vue'
import TeaService from '../views/TeaService.vue'
import FaultTicket from '../views/FaultTicket.vue'
import Anomaly from '../views/Anomaly.vue'
import Report from '../views/Report.vue'

const routes = [
  {
    path: '/',
    name: 'Dashboard',
    component: Dashboard
  },
  {
    path: '/booking',
    name: 'Booking',
    component: Booking
  },
  {
    path: '/device',
    name: 'Device',
    component: Device
  },
  {
    path: '/tea-service',
    name: 'TeaService',
    component: TeaService
  },
  {
    path: '/fault-ticket',
    name: 'FaultTicket',
    component: FaultTicket
  },
  {
    path: '/anomaly',
    name: 'Anomaly',
    component: Anomaly
  },
  {
    path: '/report',
    name: 'Report',
    component: Report
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
