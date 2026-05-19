import { createRouter, createWebHistory } from 'vue-router'
import OrderList from '../views/OrderList.vue'
import OrderCreate from '../views/OrderCreate.vue'
import OrderDetail from '../views/OrderDetail.vue'
import WarehouseList from '../views/WarehouseList.vue'

const routes = [
  {
    path: '/',
    name: 'OrderList',
    component: OrderList
  },
  {
    path: '/order-create',
    name: 'OrderCreate',
    component: OrderCreate
  },
  {
    path: '/order/:id',
    name: 'OrderDetail',
    component: OrderDetail
  },
  {
    path: '/warehouses',
    name: 'WarehouseList',
    component: WarehouseList
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
