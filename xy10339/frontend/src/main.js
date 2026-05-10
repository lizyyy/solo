import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import App from './App.vue'
import Home from './views/Home.vue'
import RepairItems from './views/RepairItems.vue'
import Building from './views/Building.vue'
import Owners from './views/Owners.vue'
import Voting from './views/Voting.vue'
import Delegates from './views/Delegates.vue'
import Statistics from './views/Statistics.vue'
import Disputes from './views/Disputes.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: Home, name: 'home' },
    { path: '/repair-items', component: RepairItems, name: 'repair-items' },
    { path: '/building', component: Building, name: 'building' },
    { path: '/owners', component: Owners, name: 'owners' },
    { path: '/voting', component: Voting, name: 'voting' },
    { path: '/delegates', component: Delegates, name: 'delegates' },
    { path: '/statistics', component: Statistics, name: 'statistics' },
    { path: '/disputes', component: Disputes, name: 'disputes' }
  ]
})

const app = createApp(App)
app.use(router)
app.use(ElementPlus)
app.mount('#app')
