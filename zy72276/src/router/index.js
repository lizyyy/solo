import { createRouter, createWebHistory } from 'vue-router'
import SimulationView from '../views/SimulationView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'simulation',
      component: SimulationView
    }
  ]
})

export default router
