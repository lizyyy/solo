import { createRouter, createWebHistory } from 'vue-router'
import ImportView from '@/views/ImportView.vue'
import IssuesView from '@/views/IssuesView.vue'
import ChaptersView from '@/views/ChaptersView.vue'
import ExportView from '@/views/ExportView.vue'

const routes = [
  {
    path: '/',
    name: 'import',
    component: ImportView
  },
  {
    path: '/issues',
    name: 'issues',
    component: IssuesView
  },
  {
    path: '/chapters',
    name: 'chapters',
    component: ChaptersView
  },
  {
    path: '/export',
    name: 'export',
    component: ExportView
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
