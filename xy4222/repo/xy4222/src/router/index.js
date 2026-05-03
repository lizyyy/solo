import { createRouter, createWebHashHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import ProjectView from '../views/ProjectView.vue'
import CompareView from '../views/CompareView.vue'
import CollageView from '../views/CollageView.vue'
import ExportView from '../views/ExportView.vue'

const routes = [
  {
    path: '/',
    name: 'home',
    component: HomeView
  },
  {
    path: '/project/:id',
    name: 'project',
    component: ProjectView,
    children: [
      {
        path: 'compare',
        name: 'compare',
        component: CompareView
      },
      {
        path: 'collage',
        name: 'collage',
        component: CollageView
      },
      {
        path: 'export',
        name: 'export',
        component: ExportView
      }
    ]
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router
