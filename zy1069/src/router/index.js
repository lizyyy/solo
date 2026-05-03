import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    redirect: '/today'
  },
  {
    path: '/today',
    name: 'Today',
    component: () => import('@/views/TodayView.vue'),
    meta: { title: '今日用药' }
  },
  {
    path: '/family',
    name: 'Family',
    component: () => import('@/views/FamilyView.vue'),
    meta: { title: '家庭成员' }
  },
  {
    path: '/medicines',
    name: 'Medicines',
    component: () => import('@/views/MedicinesView.vue'),
    meta: { title: '药品管理' }
  },
  {
    path: '/plans',
    name: 'Plans',
    component: () => import('@/views/PlansView.vue'),
    meta: { title: '用药计划' }
  },
  {
    path: '/check',
    name: 'Check',
    component: () => import('@/views/CheckView.vue'),
    meta: { title: '规则检查' }
  },
  {
    path: '/import-export',
    name: 'ImportExport',
    component: () => import('@/views/ImportExportView.vue'),
    meta: { title: '导入导出' }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, _from, next) => {
  document.title = `${to.meta.title || '家庭药箱'} - 用药核对工具`
  next()
})

export default router
