import { createRouter, createWebHashHistory } from 'vue-router'
import Dashboard from '../views/Dashboard.vue'
import Specimens from '../views/Specimens.vue'
import Import from '../views/Import.vue'
import SpecimenDetail from '../views/SpecimenDetail.vue'

const routes = [
  {
    path: '/',
    name: 'Dashboard',
    component: Dashboard
  },
  {
    path: '/specimens',
    name: 'Specimens',
    component: Specimens
  },
  {
    path: '/specimens/:id',
    name: 'SpecimenDetail',
    component: SpecimenDetail,
    props: true
  },
  {
    path: '/import',
    name: 'Import',
    component: Import
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router
