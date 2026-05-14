import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'Tasks',
    component: () => import('@/views/TaskList.vue')
  },
  {
    path: '/task/:id',
    name: 'TaskDetail',
    component: () => import('@/views/TaskDetail.vue')
  },
  {
    path: '/create',
    name: 'CreateTask',
    component: () => import('@/views/CreateTask.vue')
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
