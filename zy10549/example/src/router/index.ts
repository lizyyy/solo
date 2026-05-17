import { createRouter, createWebHistory } from 'vue-router';
import Home from '../views/Home.vue';
import NotFound from '../views/NotFound.vue';

const routes = [
  {
    path: '/',
    name: 'Home',
    component: Home
  },
  {
    path: '/about',
    name: 'About',
    component: () => import('../views/About.vue')
  },
  {
    path: '/user/:id',
    name: 'User',
    component: () => import('../views/User.vue')
  },
  {
    path: '/deleted-page',
    name: 'DeletedPage',
    component: () => import('../views/DeletedPage.vue')
  },
  {
    path: '/nested',
    name: 'Nested',
    children: [
      {
        path: 'child',
        name: 'NestedChild',
        component: () => import('../views/NestedChild.vue')
      }
    ]
  },
  {
    path: '/no-component',
    name: 'NoComponent'
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: NotFound
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

export default router;