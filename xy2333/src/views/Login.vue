<template>
  <div class="page login-page">
    <div class="login-header">
      <div class="app-logo">🤝</div>
      <h1 class="app-title">邻里互助帮</h1>
      <p class="app-subtitle">远亲不如近邻，互帮互助暖人心</p>
    </div>
    
    <div class="login-form-container">
      <div class="form-card">
        <h2 class="form-title">登录</h2>
        
        <form @submit.prevent="handleLogin">
          <div class="form-group">
            <label class="form-label">手机号</label>
            <input 
              type="tel" 
              v-model="phone" 
              class="form-input" 
              placeholder="请输入手机号"
              required
            />
          </div>
          
          <div class="form-group">
            <label class="form-label">密码</label>
            <input 
              type="password" 
              v-model="password" 
              class="form-input" 
              placeholder="请输入密码"
              required
            />
          </div>
          
          <div v-if="errorMessage" class="error-message">
            {{ errorMessage }}
          </div>
          
          <button type="submit" class="btn btn-primary full-width" :disabled="loading">
            {{ loading ? '登录中...' : '登录' }}
          </button>
        </form>
        
        <div class="divider">
          <span>还没有账号？</span>
        </div>
        
        <button type="button" class="btn btn-secondary full-width" @click="goToRegister">
          立即注册
        </button>
        
        <div class="test-accounts">
          <p class="test-title">测试账号：</p>
          <p class="test-info">手机号: 13800138001 | 密码: 123456</p>
          <p class="test-info">手机号: 13800138002 | 密码: 123456</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useUserStore } from '../stores/user'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()

const phone = ref('')
const password = ref('')
const errorMessage = ref('')
const loading = ref(false)

async function handleLogin() {
  if (!phone.value || !password.value) {
    errorMessage.value = '请输入手机号和密码'
    return
  }
  
  loading.value = true
  errorMessage.value = ''
  
  // 模拟登录延迟
  setTimeout(() => {
    const result = userStore.login(phone.value, password.value)
    
    if (result.success) {
      // 检查是否有重定向URL
      const redirect = route.query.redirect || '/home'
      router.push(redirect)
    } else {
      errorMessage.value = result.message
    }
    
    loading.value = false
  }, 500)
}

function goToRegister() {
  router.push('/register')
}
</script>

<style scoped>
.login-page {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding-bottom: 0;
}

.login-header {
  text-align: center;
  padding: 60px 20px 40px;
  color: white;
}

.app-logo {
  font-size: 64px;
  margin-bottom: 16px;
}

.app-title {
  font-size: 28px;
  font-weight: 700;
  margin-bottom: 8px;
}

.app-subtitle {
  font-size: 14px;
  opacity: 0.9;
}

.login-form-container {
  flex: 1;
  padding: 0 20px 40px;
}

.form-card {
  background-color: white;
  border-radius: 16px;
  padding: 32px 24px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
}

.form-title {
  font-size: 24px;
  font-weight: 600;
  margin-bottom: 24px;
  text-align: center;
  color: #333;
}

.full-width {
  width: 100%;
  padding: 14px;
  font-size: 16px;
  margin-top: 8px;
}

.divider {
  display: flex;
  align-items: center;
  margin: 24px 0;
  text-align: center;
  color: #999;
  font-size: 14px;
}

.divider::before,
.divider::after {
  content: '';
  flex: 1;
  border-bottom: 1px solid #eee;
}

.divider span {
  padding: 0 16px;
}

.error-message {
  background-color: #fff5f5;
  color: #e74c3c;
  padding: 12px;
  border-radius: 6px;
  margin-bottom: 16px;
  font-size: 14px;
  text-align: center;
}

.test-accounts {
  margin-top: 24px;
  padding: 16px;
  background-color: #f8f9fa;
  border-radius: 8px;
}

.test-title {
  font-size: 14px;
  font-weight: 600;
  color: #333;
  margin-bottom: 8px;
}

.test-info {
  font-size: 12px;
  color: #666;
  margin-bottom: 4px;
}
</style>
