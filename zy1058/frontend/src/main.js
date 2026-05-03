import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import zhCn from 'element-plus/dist/locale/zh-cn.mjs'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'

import App from './App.vue'
import Dashboard from './views/Dashboard.vue'
import KilnWorkbench from './views/KilnWorkbench.vue'
import Artworks from './views/Artworks.vue'
import Customers from './views/Customers.vue'
import Materials from './views/Materials.vue'
import KilnManagement from './views/KilnManagement.vue'
import FiringTasks from './views/FiringTasks.vue'
import ImportExport from './views/ImportExport.vue'

const routes = [
  { path: '/', redirect: '/dashboard' },
  { path: '/dashboard', name: 'Dashboard', component: Dashboard, meta: { title: '仪表盘' } },
  { path: '/workbench', name: 'KilnWorkbench', component: KilnWorkbench, meta: { title: '排窑工作台' } },
  { path: '/artworks', name: 'Artworks', component: Artworks, meta: { title: '作品管理' } },
  { path: '/customers', name: 'Customers', component: Customers, meta: { title: '客户管理' } },
  { path: '/materials', name: 'Materials', component: Materials, meta: { title: '泥料釉料' } },
  { path: '/kilns', name: 'KilnManagement', component: KilnManagement, meta: { title: '窑炉管理' } },
  { path: '/tasks', name: 'FiringTasks', component: FiringTasks, meta: { title: '烧窑任务' } },
  { path: '/import-export', name: 'ImportExport', component: ImportExport, meta: { title: '导入导出' } }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, _from, next) => {
  document.title = to.meta.title ? `${to.meta.title} - 陶艺工作室窑炉排烧系统` : '陶艺工作室窑炉排烧系统'
  next()
})

const app = createApp(App)

for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

app.use(router)
app.use(ElementPlus, { locale: zhCn })

app.mount('#app')
