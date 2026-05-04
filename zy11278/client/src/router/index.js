import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    redirect: '/dashboard'
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: () => import('@/views/Dashboard.vue'),
    meta: { title: '总览看板' }
  },
  {
    path: '/watchlist',
    name: 'Watchlist',
    component: () => import('@/views/Watchlist.vue'),
    meta: { title: '自选股/行情' }
  },
  {
    path: '/trade-plan',
    name: 'TradePlan',
    component: () => import('@/views/TradePlan.vue'),
    meta: { title: '交易计划' }
  },
  {
    path: '/orders',
    name: 'Orders',
    component: () => import('@/views/Orders.vue'),
    meta: { title: '订单流水' }
  },
  {
    path: '/positions',
    name: 'Positions',
    component: () => import('@/views/Positions.vue'),
    meta: { title: '持仓看板' }
  },
  {
    path: '/risk',
    name: 'Risk',
    component: () => import('@/views/Risk.vue'),
    meta: { title: '风险预警' }
  },
  {
    path: '/timeline',
    name: 'Timeline',
    component: () => import('@/views/Timeline.vue'),
    meta: { title: '交易日时间线' }
  },
  {
    path: '/review',
    name: 'Review',
    component: () => import('@/views/Review.vue'),
    meta: { title: '复盘笔记' }
  },
  {
    path: '/export',
    name: 'Export',
    component: () => import('@/views/Export.vue'),
    meta: { title: '报告导出' }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  document.title = to.meta.title ? `${to.meta.title} - 股票模拟交易` : '股票模拟交易复盘和风控预警台'
  next()
})

export default router
