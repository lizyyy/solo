import Vue from 'vue'
import VueRouter from 'vue-router'
import Dashboard from '../views/Dashboard.vue'
import PlanDetail from '../views/PlanDetail.vue'

Vue.use(VueRouter)

const routes = [
  {
    path: '/',
    name: 'Dashboard',
    component: Dashboard
  },
  {
    path: '/plan/:id',
    name: 'PlanDetail',
    component: PlanDetail
  }
]

const router = new VueRouter({
  mode: 'history',
  routes
})

export default router