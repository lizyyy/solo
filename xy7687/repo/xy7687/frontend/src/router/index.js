import { createRouter, createWebHistory } from 'vue-router'
import KanbanView from '../views/KanbanView.vue'
import TicketDetail from '../views/TicketDetail.vue'
import TicketForm from '../views/TicketForm.vue'

const routes = [
  {
    path: '/',
    name: 'kanban',
    component: KanbanView,
    meta: { title: '工单看板' }
  },
  {
    path: '/ticket/:id',
    name: 'ticketDetail',
    component: TicketDetail,
    meta: { title: '工单详情' }
  },
  {
    path: '/ticket/new',
    name: 'newTicket',
    component: TicketForm,
    meta: { title: '新建工单' }
  },
  {
    path: '/ticket/edit/:id',
    name: 'editTicket',
    component: TicketForm,
    meta: { title: '编辑工单' }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  document.title = to.meta.title || '维修工单系统'
  next()
})

export default router
