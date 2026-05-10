import { createApp } from 'vue'
import { createRouter, createWebHashHistory } from 'vue-router'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import zhCn from 'element-plus/es/locale/lang/zh-cn'

import App from './App.vue'
import OrderList from './views/OrderList.vue'
import OrderDetail from './views/OrderDetail.vue'
import Dashboard from './views/Dashboard.vue'

const routes = [
  { path: '/', redirect: '/orders' },
  { path: '/orders', name: 'OrderList', component: OrderList },
  { path: '/orders/:id', name: 'OrderDetail', component: OrderDetail },
  { path: '/dashboard', name: 'Dashboard', component: Dashboard }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

const app = createApp(App)
app.use(router)
app.use(ElementPlus, { locale: zhCn })

for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

app.mount('#app')
