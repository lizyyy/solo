import { createRouter, createWebHistory } from 'vue-router'
import LeadList from '@/views/LeadList.vue'
import LeadDetail from '@/views/LeadDetail.vue'
import LeadEdit from '@/views/LeadEdit.vue'

const routes = [
  {
    path: '/',
    name: 'LeadList',
    component: LeadList,
    meta: { title: '线索列表' }
  },
  {
    path: '/leads/:id',
    name: 'LeadDetail',
    component: LeadDetail,
    meta: { title: '线索详情' }
  },
  {
    path: '/leads/:id/edit',
    name: 'LeadEdit',
    component: LeadEdit,
    meta: { title: '编辑线索' }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  document.title = to.meta.title ? `${to.meta.title} - 课程顾问线索管理系统` : '课程顾问线索管理系统'
  next()
})

export default router
