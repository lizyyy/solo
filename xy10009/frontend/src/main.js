import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import store from './store'

import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'

import offlineStorage from './services/offlineStorage'
import syncService from './services/syncService'

async function initApp() {
  const app = createApp(App)

  for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
    app.component(key, component)
  }

  app.use(ElementPlus, { locale: zhCn })
  app.use(store)
  app.use(router)

  store.dispatch('checkAuth')

  await offlineStorage.init()

  if (store.getters.isAuthenticated) {
    await store.dispatch('loadOfflineData')
    syncService.start()
  }

  window.addEventListener('online', () => {
    store.dispatch('updateOnlineStatus', true)
  })
  window.addEventListener('offline', () => {
    store.dispatch('updateOnlineStatus', false)
  })

  app.mount('#app')
}

initApp()
