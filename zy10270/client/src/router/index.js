import { createRouter, createWebHistory } from 'vue-router'
import LinenList from '../views/LinenList.vue'
import BatchList from '../views/BatchList.vue'
import BatchDetail from '../views/BatchDetail.vue'
import RoomList from '../views/RoomList.vue'
import ClaimList from '../views/ClaimList.vue'
import InventoryList from '../views/InventoryList.vue'

const routes = [
  { path: '/', redirect: '/batches' },
  { path: '/linens', name: 'LinenList', component: LinenList },
  { path: '/batches', name: 'BatchList', component: BatchList },
  { path: '/batches/:id', name: 'BatchDetail', component: BatchDetail },
  { path: '/rooms', name: 'RoomList', component: RoomList },
  { path: '/claims', name: 'ClaimList', component: ClaimList },
  { path: '/inventory', name: 'InventoryList', component: InventoryList }
]

const router = createRouter({
  history: createWebHistory(process.env.BASE_URL),
  routes
})

export default router
