import { createRouter, createWebHistory } from 'vue-router'
import Dashboard from '../views/Dashboard.vue'
import CaseList from '../views/CaseList.vue'
import CaseDetail from '../views/CaseDetail.vue'
import ImportView from '../views/ImportView.vue'

const routes = [
  {
    path: '/',
    name: 'Dashboard',
    component: Dashboard
  },
  {
    path: '/cases',
    name: 'CaseList',
    component: CaseList
  },
  {
    path: '/cases/:id',
    name: 'CaseDetail',
    component: CaseDetail,
    props: true
  },
  {
    path: '/import',
    name: 'Import',
    component: ImportView
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
