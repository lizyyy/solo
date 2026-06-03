import { createRouter, createWebHistory } from 'vue-router'
import WorkflowHome from '@/pages/WorkflowHome.vue'
import CadImport from '@/pages/CadImport.vue'
import RangefinderReview from '@/pages/RangefinderReview.vue'
import SafetyReport from '@/pages/SafetyReport.vue'
import ManagerReview from '@/pages/ManagerReview.vue'
import ResultComparison from '@/pages/ResultComparison.vue'

const routes = [
  {
    path: '/',
    name: 'home',
    component: WorkflowHome,
  },
  {
    path: '/cad-import/:recordId',
    name: 'cad-import',
    component: CadImport,
  },
  {
    path: '/rangefinder/:recordId',
    name: 'rangefinder',
    component: RangefinderReview,
  },
  {
    path: '/safety-report/:recordId',
    name: 'safety-report',
    component: SafetyReport,
  },
  {
    path: '/manager-review',
    name: 'manager-review',
    component: ManagerReview,
  },
  {
    path: '/result-comparison',
    name: 'result-comparison',
    component: ResultComparison,
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
