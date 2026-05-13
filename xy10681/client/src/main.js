import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import App from './App.vue'
import VolunteerList from './pages/VolunteerList.vue'
import VolunteerDetail from './pages/VolunteerDetail.vue'
import ReportPage from './pages/ReportPage.vue'

const routes = [
  { path: '/', component: VolunteerList },
  { path: '/volunteer/:id', component: VolunteerDetail },
  { path: '/report', component: ReportPage }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

const app = createApp(App)
app.use(router)
app.use(ElementPlus)
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}
app.mount('#app')
