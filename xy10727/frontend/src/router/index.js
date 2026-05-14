import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'List',
    component: () => import('@/views/AddressList.vue')
  },
  {
    path: '/detail/:id',
    name: 'Detail',
    component: () => import('@/views/AddressDetail.vue')
  },
  {
    path: '/create',
    name: 'Create',
    component: () => import('@/views/AddressForm.vue')
  },
  {
    path: '/edit/:id',
    name: 'Edit',
    component: () => import('@/views/AddressForm.vue')
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
