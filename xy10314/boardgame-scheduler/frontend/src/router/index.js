import { createRouter, createWebHistory } from 'vue-router'
import ScheduleView from '../views/ScheduleView.vue'
import WaitlistView from '../views/WaitlistView.vue'
import StatsView from '../views/StatsView.vue'
import ManageView from '../views/ManageView.vue'

const routes = [
  {
    path: '/',
    redirect: '/schedule'
  },
  {
    path: '/schedule',
    name: 'schedule',
    component: ScheduleView
  },
  {
    path: '/waitlist',
    name: 'waitlist',
    component: WaitlistView
  },
  {
    path: '/stats',
    name: 'stats',
    component: StatsView
  },
  {
    path: '/manage',
    name: 'manage',
    component: ManageView
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
