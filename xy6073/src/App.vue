<script setup>
import { onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { foodManager } from '@/utils/foodManager'
import { FOOD_STATUS } from '@/utils/foodManager'

const router = useRouter()
const route = useRoute()

const navItems = [
  { path: '/index', text: '首页', icon: '🏠' },
  { path: '/add-food', text: '添加', icon: '➕' },
  { path: '/recipe', text: '菜谱', icon: '📖' },
  { path: '/manage', text: '管理', icon: '⚙️' }
]

const isActive = (path) => {
  return route.path === path
}

const navigateTo = (path) => {
  router.push(path)
}

const checkExpiredFoods = () => {
  const foods = foodManager.getFoods()
  const expiringFoods = foods.filter(food => {
    const status = foodManager.calculateFoodStatus(food.expireDate)
    return status.status === FOOD_STATUS.EXPIRING || status.status === FOOD_STATUS.EXPIRED
  })
  
  if (expiringFoods.length > 0) {
    const expiredCount = expiringFoods.filter(f => 
      foodManager.calculateFoodStatus(f.expireDate).status === FOOD_STATUS.EXPIRED
    ).length
    const expiringCount = expiringFoods.length - expiredCount
    
    let message = ''
    if (expiredCount > 0 && expiringCount > 0) {
      message = `您有 ${expiredCount} 种食材已过期，${expiringCount} 种食材即将过期，请及时处理！`
    } else if (expiredCount > 0) {
      message = `您有 ${expiredCount} 种食材已过期，请及时处理！`
    } else {
      message = `您有 ${expiringCount} 种食材即将过期，请及时处理！`
    }
    
    setTimeout(() => {
      alert('食材提醒\n\n' + message)
    }, 500)
  }
}

onMounted(() => {
  checkExpiredFoods()
})
</script>

<template>
  <div class="app">
    <header class="app-header">
      <h1>{{ route.meta.title || '冰箱小管家' }}</h1>
    </header>
    
    <main class="app-content">
      <router-view />
    </main>
    
    <footer class="app-footer">
      <div class="tabbar">
        <div 
          v-for="item in navItems" 
          :key="item.path"
          class="tabbar-item"
          :class="{ active: isActive(item.path) }"
          @click="navigateTo(item.path)"
        >
          <span class="tabbar-icon">{{ item.icon }}</span>
          <span class="tabbar-text">{{ item.text }}</span>
        </div>
      </div>
    </footer>
  </div>
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
  font-size: 14px;
  color: #333;
  background-color: #f5f5f5;
  height: 100%;
}

#app {
  height: 100%;
}

.app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  max-width: 430px;
  margin: 0 auto;
  background-color: #f5f5f5;
  position: relative;
}

.app-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  padding: 16px;
  text-align: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  flex-shrink: 0;
}

.app-header h1 {
  font-size: 18px;
  font-weight: 600;
}

.app-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  padding-bottom: 80px;
}

.app-footer {
  position: fixed;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 100%;
  max-width: 430px;
  background-color: #fff;
  border-top: 1px solid #e0e0e0;
  flex-shrink: 0;
  z-index: 100;
}

.tabbar {
  display: flex;
  justify-content: space-around;
  align-items: center;
  height: 60px;
  padding: 0 8px;
}

.tabbar-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  cursor: pointer;
  padding: 8px;
  transition: all 0.2s;
}

.tabbar-item:active {
  opacity: 0.7;
}

.tabbar-icon {
  font-size: 24px;
  margin-bottom: 4px;
}

.tabbar-text {
  font-size: 12px;
  color: #7A7E83;
  transition: color 0.2s;
}

.tabbar-item.active .tabbar-text {
  color: #667eea;
  font-weight: 500;
}

/* 全局样式 */
.container {
  padding: 0;
}

.card {
  background-color: #fff;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 16px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
}

/* 按钮样式 */
.btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 12px 24px;
  font-size: 14px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary:active {
  opacity: 0.8;
}

.btn-danger {
  background-color: #FF3B30;
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 12px 24px;
  font-size: 14px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-danger:active {
  opacity: 0.8;
}

.btn-success {
  background-color: #34C759;
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 12px 24px;
  font-size: 14px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-success:active {
  opacity: 0.8;
}

.btn-secondary {
  background-color: #f0f0f0;
  color: #333;
  border: none;
  border-radius: 8px;
  padding: 12px 24px;
  font-size: 14px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-secondary:active {
  background-color: #e0e0e0;
}

/* 表单样式 */
.form-group {
  margin-bottom: 20px;
}

.form-label {
  display: block;
  font-size: 14px;
  color: #333;
  margin-bottom: 8px;
  font-weight: 500;
}

.form-input {
  width: 100%;
  height: 48px;
  padding: 0 16px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 14px;
  background-color: #fff;
  box-sizing: border-box;
  transition: border-color 0.2s;
}

.form-input:focus {
  border-color: #667eea;
  outline: none;
}

.form-textarea {
  width: 100%;
  min-height: 100px;
  padding: 16px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 14px;
  background-color: #fff;
  box-sizing: border-box;
  resize: none;
  font-family: inherit;
}

.form-textarea:focus {
  border-color: #667eea;
  outline: none;
}

/* 状态标签 */
.status-expired {
  color: #FF3B30;
  font-weight: 600;
}

.status-expiring {
  color: #FF9500;
  font-weight: 600;
}

.status-normal {
  color: #34C759;
  font-weight: 600;
}

/* 空状态 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 0;
  text-align: center;
}

.empty-state span {
  font-size: 48px;
  margin-bottom: 16px;
}

.empty-state p {
  font-size: 14px;
  color: #999;
}

/* 列表项 */
.list-item {
  display: flex;
  align-items: center;
  padding: 12px;
  background-color: #fff;
  border-bottom: 1px solid #f0f0f0;
}

.list-item:last-child {
  border-bottom: none;
}

/* 图片占位 */
.image-placeholder {
  width: 60px;
  height: 60px;
  background-color: #f0f0f0;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #999;
  font-size: 12px;
  margin-right: 12px;
}

/* 加载动画 */
.loading {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 30px;
}

.loading span {
  font-size: 14px;
  color: #999;
}

/* 复选框样式 */
.checkbox {
  width: 20px;
  height: 20px;
  border: 2px solid #ddd;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
}

.checkbox.checked {
  background-color: #667eea;
  border-color: #667eea;
}

.checkbox.checked::after {
  content: '✓';
  color: #fff;
  font-size: 14px;
  font-weight: bold;
}

/* 分类标签 */
.category-tag {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  margin-right: 8px;
  margin-bottom: 8px;
}

/* 搜索框 */
.search-box {
  display: flex;
  align-items: center;
  background-color: #fff;
  border-radius: 20px;
  padding: 8px 16px;
  margin-bottom: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.search-box input {
  flex: 1;
  border: none;
  outline: none;
  font-size: 14px;
  background: transparent;
}

.search-box span {
  margin-left: 8px;
  color: #999;
}

/* 弹窗样式 */
.modal-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background-color: #fff;
  border-radius: 12px;
  width: 90%;
  max-width: 360px;
  max-height: 80vh;
  overflow-y: auto;
  animation: modalIn 0.3s ease;
}

@keyframes modalIn {
  from {
    opacity: 0;
    transform: scale(0.9);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid #f0f0f0;
}

.modal-header h3 {
  font-size: 16px;
  font-weight: 600;
}

.modal-close {
  font-size: 24px;
  color: #999;
  cursor: pointer;
}

.modal-body {
  padding: 16px;
}

.modal-footer {
  padding: 16px;
  border-top: 1px solid #f0f0f0;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

/* 统计卡片 */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}

.stat-card {
  background-color: #fff;
  border-radius: 12px;
  padding: 16px;
  text-align: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.stat-card .stat-icon {
  font-size: 28px;
  margin-bottom: 8px;
}

.stat-card .stat-value {
  font-size: 24px;
  font-weight: 700;
  margin-bottom: 4px;
}

.stat-card .stat-label {
  font-size: 12px;
  color: #999;
}

/* 食材卡片 */
.food-card {
  display: flex;
  align-items: center;
  background-color: #fff;
  border-radius: 12px;
  padding: 12px;
  margin-bottom: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.food-card.expired {
  border-left: 4px solid #FF3B30;
}

.food-card.expiring {
  border-left: 4px solid #FF9500;
}

.food-card.normal {
  border-left: 4px solid #34C759;
}

.food-image {
  width: 60px;
  height: 60px;
  border-radius: 8px;
  object-fit: cover;
  margin-right: 12px;
  background-color: #f0f0f0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
}

.food-info {
  flex: 1;
}

.food-name {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 4px;
}

.food-meta {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: #666;
}

.food-status {
  font-size: 12px;
  margin-top: 4px;
}

/* 菜谱卡片 */
.recipe-card {
  background-color: #fff;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.recipe-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
}

.recipe-name {
  font-size: 16px;
  font-weight: 600;
}

.recipe-match {
  font-size: 12px;
  padding: 4px 12px;
  border-radius: 12px;
  font-weight: 500;
}

.recipe-match.high {
  background-color: #e6f7ff;
  color: #1890ff;
}

.recipe-match.medium {
  background-color: #fff7e6;
  color: #fa8c16;
}

.recipe-match.low {
  background-color: #f5f5f5;
  color: #999;
}

.recipe-ingredients {
  margin-bottom: 12px;
}

.recipe-ingredients-title {
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 8px;
}

.recipe-ingredients-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.recipe-ingredient {
  font-size: 12px;
  padding: 4px 12px;
  border-radius: 12px;
}

.recipe-ingredient.available {
  background-color: #e6ffed;
  color: #52c41a;
}

.recipe-ingredient.missing {
  background-color: #fff1f0;
  color: #ff4d4f;
}

.recipe-steps {
  font-size: 14px;
  color: #666;
  line-height: 1.6;
}

/* 筛选标签 */
.filter-tabs {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
  overflow-x: auto;
  padding-bottom: 4px;
}

.filter-tab {
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 14px;
  white-space: nowrap;
  cursor: pointer;
  background-color: #fff;
  color: #666;
  transition: all 0.2s;
  border: 1px solid #e0e0e0;
}

.filter-tab.active {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  border-color: transparent;
}

/* 图片上传区域 */
.image-upload-area {
  width: 100%;
  height: 120px;
  border: 2px dashed #ddd;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  background-color: #fafafa;
}

.image-upload-area:active {
  border-color: #667eea;
  background-color: #f5f3ff;
}

.image-upload-area.has-image {
  border: none;
  background-color: transparent;
}

.image-upload-area .upload-icon {
  font-size: 36px;
  margin-bottom: 8px;
}

.image-upload-area .upload-text {
  font-size: 14px;
  color: #999;
}

.image-preview {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 12px;
}

/* 语音按钮 */
.voice-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  font-size: 20px;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.voice-btn:active {
  opacity: 0.8;
}

.voice-btn.listening {
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.1);
  }
}

/* 操作按钮组 */
.action-buttons {
  display: flex;
  gap: 12px;
  margin-top: 24px;
}

.action-buttons button {
  flex: 1;
}

/* 全选栏 */
.select-all-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background-color: #fff;
  border-radius: 12px;
  margin-bottom: 16px;
}

.select-all-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.select-all-text {
  font-size: 14px;
  color: #333;
}

.quick-select-btns {
  display: flex;
  gap: 8px;
}

.quick-select-btn {
  padding: 6px 12px;
  font-size: 12px;
  border-radius: 12px;
  border: 1px solid #e0e0e0;
  background-color: #fff;
  color: #666;
  cursor: pointer;
  transition: all 0.2s;
}

.quick-select-btn:active {
  background-color: #f5f5f5;
}

/* 底部操作栏 */
.bottom-actions {
  position: fixed;
  bottom: 70px;
  left: 50%;
  transform: translateX(-50%);
  width: 100%;
  max-width: 430px;
  background-color: #fff;
  padding: 12px 16px;
  border-top: 1px solid #e0e0e0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  z-index: 99;
}

.selected-count {
  font-size: 14px;
  color: #666;
}

.bottom-action-btns {
  display: flex;
  gap: 12px;
}

/* 分类图标 */
.category-icon {
  font-size: 20px;
  margin-right: 8px;
}
</style>
