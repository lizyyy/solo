import { createRouter, createWebHistory } from 'vue-router';

const routes = [
  {
    path: '/',
    name: 'Dashboard',
    component: () => import('@/views/Dashboard.vue')
  },
  {
    path: '/booths',
    name: 'Booths',
    component: () => import('@/views/Booths.vue')
  },
  {
    path: '/merchants',
    name: 'Merchants',
    component: () => import('@/views/Merchants.vue')
  },
  {
    path: '/schedules',
    name: 'Schedules',
    component: () => import('@/views/Schedules.vue')
  },
  {
    path: '/applications',
    name: 'Applications',
    component: () => import('@/views/Applications.vue')
  },
  {
    path: '/deposits',
    name: 'Deposits',
    component: () => import('@/views/Deposits.vue')
  },
  {
    path: '/electricity',
    name: 'Electricity',
    component: () => import('@/views/Electricity.vue')
  },
  {
    path: '/acceptance',
    name: 'Acceptance',
    component: () => import('@/views/Acceptance.vue')
  },
  {
    path: '/reports/calendar',
    name: 'CalendarReport',
    component: () => import('@/views/reports/Calendar.vue')
  },
  {
    path: '/reports/electricity-risk',
    name: 'ElectricityRiskReport',
    component: () => import('@/views/reports/ElectricityRisk.vue')
  },
  {
    path: '/reports/income',
    name: 'IncomeReport',
    component: () => import('@/views/reports/Income.vue')
  },
  {
    path: '/reports/deduction',
    name: 'DeductionReport',
    component: () => import('@/views/reports/Deduction.vue')
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

export default router;