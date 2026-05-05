import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import ImportView from '../views/ImportView.vue'
import AssessmentView from '../views/AssessmentView.vue'
import GreenhouseView from '../views/GreenhouseView.vue'
import DetailView from '../views/DetailView.vue'

const routes = [
  {
    path: '/',
    name: 'home',
    component: HomeView
  },
  {
    path: '/import',
    name: 'import',
    component: ImportView
  },
  {
    path: '/assessment',
    name: 'assessment',
    component: AssessmentView
  },
  {
    path: '/greenhouse',
    name: 'greenhouse',
    component: GreenhouseView
  },
  {
    path: '/detail/:id',
    name: 'detail',
    component: DetailView
  }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
})

export default router
