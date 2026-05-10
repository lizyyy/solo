import { createApp } from 'vue';
import { createPinia } from 'pinia';
import './style.css';
import App from './App.vue';

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
app.mount('#app');

console.log('[系统] 玻璃幕墙巡检缺陷标注器 已启动');
console.log('[系统] 请按 F12 打开开发者工具查看详细操作日志');
