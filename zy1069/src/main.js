import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import './style.css'
import { initializeApp } from '@/utils/storage'

initializeApp()

const app = createApp(App)
app.use(router)
app.mount('#app')
