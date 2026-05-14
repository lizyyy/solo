import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import App from './App.vue'
import ExperimentList from './components/ExperimentList.vue'
import ExperimentDetail from './components/ExperimentDetail.vue'
import Dashboard from './components/Dashboard.vue'

const routes = [
  { path: '/', component: Dashboard },
  { path: '/experiments', component: ExperimentList },
  { path: '/experiments/:id', component: ExperimentDetail }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

const app = createApp(App)

for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

app.use(router)
app.use(ElementPlus)
app.mount('#app')
