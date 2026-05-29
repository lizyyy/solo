import { createRouter, createWebHistory } from 'vue-router'
import Layout from '@/components/Layout.vue'
import Dashboard from '@/pages/Dashboard.vue'
import ImportWorkbench from '@/pages/ImportWorkbench.vue'
import ConflictCenter from '@/pages/ConflictCenter.vue'
import RollbackEngine from '@/pages/RollbackEngine.vue'
import HistoryAudit from '@/pages/HistoryAudit.vue'
import ReportCenter from '@/pages/ReportCenter.vue'

const routes = [
  {
    path: '/',
    component: Layout,
    children: [
      {
        path: '',
        name: 'dashboard',
        component: Dashboard
      },
      {
        path: 'import',
        name: 'import',
        component: ImportWorkbench
      },
      {
        path: 'conflicts',
        name: 'conflicts',
        component: ConflictCenter
      },
      {
        path: 'rollback',
        name: 'rollback',
        component: RollbackEngine
      },
      {
        path: 'history',
        name: 'history',
        component: HistoryAudit
      },
      {
        path: 'reports',
        name: 'reports',
        component: ReportCenter
      }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
