<template>
  <div class="page register-page">
    <div class="register-header">
      <div class="app-logo">🤝</div>
      <h1 class="app-title">邻里互助帮</h1>
      <p class="app-subtitle">加入我们，成为互帮互助的好邻居</p>
    </div>
    
    <div class="register-form-container">
      <div class="form-card">
        <h2 class="form-title">注册</h2>
        
        <form @submit.prevent="handleRegister">
          <div class="form-group">
            <label class="form-label">姓名</label>
            <input 
              type="text" 
              v-model="name" 
              class="form-input" 
              placeholder="请输入您的姓名"
              required
            />
          </div>
          
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
          
          <div class="form-group">
            <label class="form-label">确认密码</label>
            <input 
              type="password" 
              v-model="confirmPassword" 
              class="form-input" 
              placeholder="请再次输入密码"
              required
            />
          </div>
          
          <div class="form-group">
            <label class="form-label">居住地址</label>
            <input 
              type="text" 
              v-model="location" 
              class="form-input" 
              placeholder="请输入您的居住地址（如：阳光花园1号楼）"
            />
          </div>
          
          <div class="form-group">
            <label class="form-label">技能标签（可多选）</label>
            <div class="skills-container">
              <div 
                v-for="skill in displaySkills" 
                :key="skill" 
                class="skill-option"
                :class="{ selected: selectedSkills.includes(skill) }"
                @click="toggleSkill(skill)"
              >
                {{ skill }}
              </div>
            </div>
          </div>
          
          <div v-if="errorMessage" class="error-message">
            {{ errorMessage }}
          </div>
          
          <button type="submit" class="btn btn-primary full-width" :disabled="loading">
            {{ loading ? '注册中...' : '注册' }}
          </button>
        </form>
        
        <div class="divider">
          <span>已有账号？</span>
        </div>
        
        <button type="button" class="btn btn-secondary full-width" @click="goToLogin">
          立即登录
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '../stores/user'
import { ALL_SKILLS } from '../utils/helpers'

const router = useRouter()
const userStore = useUserStore()

const name = ref('')
const phone = ref('')
const password = ref('')
const confirmPassword = ref('')
const location = ref('')
const selectedSkills = ref([])
const errorMessage = ref('')
const loading = ref(false)

const displaySkills = computed(() => ALL_SKILLS.slice(0, 15))

function toggleSkill(skill) {
  const index = selectedSkills.value.indexOf(skill)
  if (index === -1) {
    if (selectedSkills.value.length < 5) {
      selectedSkills.value.push(skill)
    }
  } else {
    selectedSkills.value.splice(index, 1)
  }
}

async function handleRegister() {
  if (!name.value || !phone.value || !password.value || !confirmPassword.value) {
    errorMessage.value = '请填写所有必填项'
    return
  }
  
  if (password.value !== confirmPassword.value) {
    errorMessage.value = '两次输入的密码不一致'
    return
  }
  
  if (password.value.length < 6) {
    errorMessage.value = '密码长度至少为6位'
    return
  }
  
  loading.value = true
  errorMessage.value = ''
  
  // 模拟注册延迟
  setTimeout(() => {
    const result = userStore.register({
      name: name.value,
      phone: phone.value,
      password: password.value,
      location: location.value,
      skills: selectedSkills.value
    })
    
    if (result.success) {
      router.push('/home')
    } else {
      errorMessage.value = result.message
    }
    
    loading.value = false
  }, 500)
}

function goToLogin() {
  router.push('/login')
}
</script>

<style scoped>
.register-page {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding-bottom: 0;
}

.register-header {
  text-align: center;
  padding: 40px 20px 20px;
  color: white;
}

.app-logo {
  font-size: 48px;
  margin-bottom: 12px;
}

.app-title {
  font-size: 24px;
  font-weight: 700;
  margin-bottom: 6px;
}

.app-subtitle {
  font-size: 13px;
  opacity: 0.9;
}

.register-form-container {
  flex: 1;
  padding: 0 20px 40px;
  overflow-y: auto;
}

.form-card {
  background-color: white;
  border-radius: 16px;
  padding: 24px 20px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
}

.form-title {
  font-size: 22px;
  font-weight: 600;
  margin-bottom: 20px;
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
  margin: 20px 0;
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

.skills-container {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.skill-option {
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 12px;
  background-color: #f5f5f5;
  color: #666;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 1px solid #eee;
}

.skill-option:hover {
  background-color: #e8f4fd;
  border-color: #4a90e2;
  color: #4a90e2;
}

.skill-option.selected {
  background-color: #4a90e2;
  border-color: #4a90e2;
  color: white;
}
</style>
