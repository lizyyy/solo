import { createRouter, createWebHistory } from 'vue-router'
import Dashboard from '../views/Dashboard.vue'
import Orders from '../views/Orders.vue'
import OrderDetail from '../views/OrderDetail.vue'
import Inventory from '../views/Inventory.vue'
import Freezers from '../views/Freezers.vue'
import PickupSlots from '../views/PickupSlots.vue'
import Exceptions from '../views/Exceptions.vue'
import ExceptionDetail from '../views/ExceptionDetail.vue'
import Export from '../views/Export.vue'
import Products from '../views/Products.vue'
import GroupBatches from '../views/GroupBatches.vue'

const routes = [
  {
    path: '/',
    name: 'Dashboard',
    component: Dashboard
  },
  {
    path: '/products',
    name: 'Products',
    component: Products
  },
  {
    path: '/group-batches',
    name: 'GroupBatches',
    component: GroupBatches
  },
  {
    path: '/orders',
    name: 'Orders',
    component: Orders
  },
  {
    path: '/orders/:id',
    name: 'OrderDetail',
    component: OrderDetail,
    props: true
  },
  {
    path: '/inventory',
    name: 'Inventory',
    component: Inventory
  },
  {
    path: '/freezers',
    name: 'Freezers',
    component: Freezers
  },
  {
    path: '/pickup-slots',
    name: 'PickupSlots',
    component: PickupSlots
  },
  {
    path: '/exceptions',
    name: 'Exceptions',
    component: Exceptions
  },
  {
    path: '/exceptions/:id',
    name: 'ExceptionDetail',
    component: ExceptionDetail,
    props: true
  },
  {
    path: '/export',
    name: 'Export',
    component: Export
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
