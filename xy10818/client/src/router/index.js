import { createRouter, createWebHistory } from 'vue-router';
import SubscriptionList from '../views/SubscriptionList.vue';
import SubscriptionDetail from '../views/SubscriptionDetail.vue';

const routes = [
  { path: '/', name: 'List', component: SubscriptionList },
  { path: '/subscription/:id', name: 'Detail', component: SubscriptionDetail }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

export default router;
