import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'DrillList',
    component: () => import('@/views/DrillList.vue')
  },
  {
    path: '/create',
    name: 'CreateDrill',
    component: () => import('@/views/CreateDrill.vue')
  },
  {
    path: '/drill/:id',
    name: 'DrillDetail',
    component: () => import('@/views/DrillDetail.vue'),
    children: [
      {
        path: '',
        redirect: { name: 'DrillOverview' }
      },
      {
        path: 'overview',
        name: 'DrillOverview',
        component: () => import('@/components/drill/OverviewTab.vue')
      },
      {
        path: 'analysis',
        name: 'DrillAnalysis',
        component: () => import('@/components/drill/AnalysisTab.vue')
      },
      {
        path: 'bottlenecks',
        name: 'DrillBottlenecks',
        component: () => import('@/components/drill/BottlenecksTab.vue')
      },
      {
        path: 'suggestions',
        name: 'DrillSuggestions',
        component: () => import('@/components/drill/SuggestionsTab.vue')
      },
      {
        path: 'report',
        name: 'DrillReport',
        component: () => import('@/components/drill/ReportTab.vue')
      }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
