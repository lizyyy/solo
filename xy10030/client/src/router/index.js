import { createRouter, createWebHistory } from 'vue-router'
import EventList from '../views/EventList.vue'
import EventDetail from '../views/EventDetail.vue'
import RegistrationList from '../views/RegistrationList.vue'
import TaskList from '../views/TaskList.vue'
import LogList from '../views/LogList.vue'
import ReportPage from '../views/ReportPage.vue'
import PendingRequests from '../views/PendingRequests.vue'

const routes = [
  {
    path: '/',
    name: 'EventList',
    component: EventList
  },
  {
    path: '/events/:id',
    name: 'EventDetail',
    component: EventDetail
  },
  {
    path: '/registrations',
    name: 'RegistrationList',
    component: RegistrationList
  },
  {
    path: '/tasks',
    name: 'TaskList',
    component: TaskList
  },
  {
    path: '/logs',
    name: 'LogList',
    component: LogList
  },
  {
    path: '/reports',
    name: 'ReportPage',
    component: ReportPage
  },
  {
    path: '/pending',
    name: 'PendingRequests',
    component: PendingRequests
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
