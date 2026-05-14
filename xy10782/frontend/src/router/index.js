import { createRouter, createWebHistory } from 'vue-router'
import AudioList from '../views/AudioList.vue'
import AudioDetail from '../views/AudioDetail.vue'
import ExportPanel from '../views/ExportPanel.vue'
import Statistics from '../views/Statistics.vue'

const routes = [
  {
    path: '/',
    redirect: '/audio'
  },
  {
    path: '/audio',
    name: 'AudioList',
    component: AudioList
  },
  {
    path: '/audio/:id',
    name: 'AudioDetail',
    component: AudioDetail
  },
  {
    path: '/export',
    name: 'ExportPanel',
    component: ExportPanel
  },
  {
    path: '/statistics',
    name: 'Statistics',
    component: Statistics
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
