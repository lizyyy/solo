import { createRouter, createWebHistory } from 'vue-router'
import DataImport from '@/views/DataImport.vue'
import Scheduling from '@/views/Scheduling.vue'
import ScheduleList from '@/views/ScheduleList.vue'

const routes = [
  {
    path: '/',
    redirect: '/import'
  },
  {
    path: '/import',
    name: 'DataImport',
    component: DataImport,
    meta: { title: '数据导入' }
  },
  {
    path: '/scheduling',
    name: 'Scheduling',
    component: Scheduling,
    meta: { title: '排程调整' }
  },
  {
    path: '/schedules',
    name: 'ScheduleList',
    component: ScheduleList,
    meta: { title: '历史排程' }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  document.title = `${to.meta.title || '潮汐排程'} - 潮汐装卸排程工具`
  next()
})

export default router
