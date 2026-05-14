import { createRouter, createWebHistory } from 'vue-router'
import IssueList from './views/IssueList.vue'
import IssueDetail from './views/IssueDetail.vue'

const routes = [
  { path: '/', name: 'IssueList', component: IssueList },
  { path: '/issue/:id', name: 'IssueDetail', component: IssueDetail },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
