import { createApp } from 'vue';
import { createRouter, createWebHistory } from 'vue-router';
import App from './App.vue';
import './assets/style.css';

import Dashboard from './views/Dashboard.vue';
import DataImport from './views/DataImport.vue';
import ExhibitionManagement from './views/ExhibitionManagement.vue';
import HeatmapAnalysis from './views/HeatmapAnalysis.vue';
import SecurityPatrol from './views/SecurityPatrol.vue';
import ProblemList from './views/ProblemList.vue';

const routes = [
  { path: '/', component: Dashboard, meta: { title: '仪表盘' } },
  { path: '/import', component: DataImport, meta: { title: '数据导入' } },
  { path: '/exhibitions', component: ExhibitionManagement, meta: { title: '展区管理' } },
  { path: '/heatmap', component: HeatmapAnalysis, meta: { title: '热区分析' } },
  { path: '/security', component: SecurityPatrol, meta: { title: '安保建议' } },
  { path: '/problems', component: ProblemList, meta: { title: '问题列表' } }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

router.beforeEach((to, from, next) => {
  document.title = to.meta.title ? `${to.meta.title} - 美术馆观众动线热区台` : '美术馆观众动线热区台';
  next();
});

createApp(App).use(router).mount('#app');
