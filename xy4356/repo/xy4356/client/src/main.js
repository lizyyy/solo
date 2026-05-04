import { createApp } from 'vue';
import { createRouter, createWebHistory } from 'vue-router';
import App from './App.vue';
import MissionList from './views/MissionList.vue';
import MissionDetail from './views/MissionDetail.vue';
import './styles/main.css';

const routes = [
  { path: '/', name: 'Home', component: MissionList },
  { path: '/mission/:id', name: 'MissionDetail', component: MissionDetail, props: true },
  { path: '/new', name: 'NewMission', component: MissionDetail }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

const app = createApp(App);
app.use(router);
app.mount('#app');
