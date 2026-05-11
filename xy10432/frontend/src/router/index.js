import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: () => import('../views/Home.vue'),
    children: [
      {
        path: '',
        redirect: '/appointments'
      },
      {
        path: 'appointments',
        name: 'Appointments',
        component: () => import('../views/Appointments.vue')
      },
      {
        path: 'appointments/:id',
        name: 'AppointmentDetail',
        component: () => import('../views/AppointmentDetail.vue')
      },
      {
        path: 'customers',
        name: 'Customers',
        component: () => import('../views/Customers.vue')
      },
      {
        path: 'packages',
        name: 'Packages',
        component: () => import('../views/Packages.vue')
      },
      {
        path: 'items',
        name: 'Items',
        component: () => import('../views/Items.vue')
      },
      {
        path: 'departments',
        name: 'Departments',
        component: () => import('../views/Departments.vue')
      },
      {
        path: 'department-usage',
        name: 'DepartmentUsage',
        component: () => import('../views/DepartmentUsage.vue')
      },
      {
        path: 'transactions',
        name: 'Transactions',
        component: () => import('../views/Transactions.vue')
      }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
