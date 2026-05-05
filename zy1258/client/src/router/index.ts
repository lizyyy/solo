import { createRouter, createWebHistory } from 'vue-router'
import Dashboard from '../views/Dashboard.vue'
import DataImport from '../views/DataImport.vue'
import ReleaseBatches from '../views/ReleaseBatches.vue'
import Simulation from '../views/Simulation.vue'
import Risks from '../views/Risks.vue'
import Tasks from '../views/Tasks.vue'
import TaskDetail from '../views/TaskDetail.vue'
import BatchDetail from '../views/BatchDetail.vue'

const routes = [
  { path: '/', name: 'Dashboard', component: Dashboard },
  { path: '/import', name: 'DataImport', component: DataImport },
  { path: '/batches', name: 'ReleaseBatches', component: ReleaseBatches },
  { path: '/batches/:id', name: 'BatchDetail', component: BatchDetail },
  { path: '/simulation', name: 'Simulation', component: Simulation },
  { path: '/risks', name: 'Risks', component: Risks },
  { path: '/tasks', name: 'Tasks', component: Tasks },
  { path: '/tasks/:id', name: 'TaskDetail', component: TaskDetail }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
