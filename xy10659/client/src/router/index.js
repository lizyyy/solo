import { createRouter, createWebHistory } from 'vue-router';
import Dashboard from '../views/Dashboard.vue';
import Vehicles from '../views/Vehicles.vue';
import Orders from '../views/Orders.vue';
import Items from '../views/Items.vue';
import Verifications from '../views/Verifications.vue';
import Exceptions from '../views/Exceptions.vue';
import Reminders from '../views/Reminders.vue';
import Reports from '../views/Reports.vue';

const routes = [
  {
    path: '/',
    name: 'Dashboard',
    component: Dashboard
  },
  {
    path: '/vehicles',
    name: 'Vehicles',
    component: Vehicles
  },
  {
    path: '/orders',
    name: 'Orders',
    component: Orders
  },
  {
    path: '/items',
    name: 'Items',
    component: Items
  },
  {
    path: '/verifications',
    name: 'Verifications',
    component: Verifications
  },
  {
    path: '/exceptions',
    name: 'Exceptions',
    component: Exceptions
  },
  {
    path: '/reminders',
    name: 'Reminders',
    component: Reminders
  },
  {
    path: '/reports',
    name: 'Reports',
    component: Reports
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

export default router;
