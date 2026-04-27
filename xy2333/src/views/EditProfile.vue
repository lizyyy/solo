<template>
  <div class="page">
    <div class="page-header">
      <div class="header-content">
        <span class="back-btn" @click="goBack">‹</span>
        <span class="header-title">编辑资料</span>
        <span class="save-btn" @click="handleSave">保存</span>
      </div>
    </div>
    
    <div class="content">
      <div class="form-container">
        <div class="avatar-section">
          <div class="user-avatar-large">{{ avatar }}</div>
          <p class="avatar-tip">头像为名字首字母</p>
        </div>
        
        <div class="form-card">
          <div class="form-group">
            <label class="form-label">姓名</label>
            <input 
              type="text" 
              v-model="name" 
              class="form-input" 
              placeholder="请输入您的姓名"
            />
          </div>
          
          <div class="form-group">
            <label class="form-label">手机号</label>
            <input 
              type="tel" 
              v-model="phone" 
              class="form-input" 
              placeholder="请输入手机号"
              disabled
            />
            <p class="form-tip">手机号不可修改</p>
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
            <label class="form-label">个人简介</label>
            <textarea 
              v-model="bio" 
              class="form-input form-textarea" 
              placeholder="简单介绍一下自己吧..."
            ></textarea>
          </div>
          
          <div class="form-group">
            <label class="form-label">技能标签（最多选择5项）</label>
            <div class="skills-container">
              <div 
                v-for="skill in allSkills" 
                :key="skill" 
                class="skill-option"
                :class="{ selected: skills.includes(skill) }"
                @click="toggleSkill(skill)"
              >
                {{ skill }}
              </div>
            </div>
            <p class="form-tip">已选择 {{ skills.length }}/5</p>
          </div>
        </div>
        
        <div v-if="errorMessage" class="error-message">
          {{ errorMessage }}
        </div>
        
        <div v-if="successMessage" class="success-message">
          {{ successMessage }}
        </div>
        
        <button type="button" class="btn btn-primary full-width" @click="handleSave" :disabled="loading">
          {{ loading ? '保存中...' : '保存修改' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '../stores/user'
import { ALL_SKILLS } from '../utils/helpers'

const router = useRouter()
const userStore = useUserStore()

const allSkills = ref(ALL_SKILLS)
const name = ref('')
const phone = ref('')
const location = ref('')
const bio = ref('')
const skills = ref([])
const errorMessage = ref('')
const successMessage = ref('')
const loading = ref(false)

const avatar = computed(() => name.value ? name.value.charAt(0) : '')

onMounted(() => {
  if (userStore.checkAuth() && userStore.currentUser) {
    name.value = userStore.currentUser.name
    phone.value = userStore.currentUser.phone
    location.value = userStore.currentUser.location || ''
    bio.value = userStore.currentUser.bio || ''
    skills.value = [...(userStore.currentUser.skills || [])]
  } else {
    router.push('/login')
  }
})

function toggleSkill(skill) {
  const index = skills.value.indexOf(skill)
  if (index === -1) {
    if (skills.value.length < 5) {
      skills.value.push(skill)
    }
  } else {
    skills.value.splice(index, 1)
  }
}

function goBack() {
  router.back()
}

async function handleSave() {
  if (!name.value) {
    errorMessage.value = '请输入姓名'
    return
  }
  
  loading.value = true
  errorMessage.value = ''
  successMessage.value = ''
  
  setTimeout(() => {
    const result = userStore.updateProfile({
      name: name.value,
      location: location.value,
      bio: bio.value,
      skills: skills.value
    })
    
    if (result.success) {
      successMessage.value = '保存成功'
      setTimeout(() => {
        successMessage.value = ''
      }, 2000)
    } else {
      errorMessage.value = result.message
    }
    
    loading.value = false
  }, 500)
}
</script>

<style scoped>
.page {
  padding-bottom: 0;
}

.header-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.back-btn {
  font-size: 24px;
  cursor: pointer;
  padding: 0 8px;
}

.save-btn {
  cursor: pointer;
  padding: 6px 12px;
  background-color: rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  font-size: 14px;
}

.save-btn:hover {
  background-color: rgba(255, 255, 255, 0.3);
}

.header-title {
  font-size: 17px;
  font-weight: 600;
}

.content {
  padding: 16px;
}

.avatar-section {
  text-align: center;
  padding: 20px 0;
}

.user-avatar-large {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background-color: #4a90e2;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 32px;
  font-weight: 700;
  margin: 0 auto 12px;
}

.avatar-tip {
  font-size: 12px;
  color: #999;
}

.form-container {
  max-width: 500px;
  margin: 0 auto;
}

.form-card {
  background-color: white;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.form-tip {
  font-size: 12px;
  color: #999;
  margin-top: 4px;
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

.error-message {
  background-color: #fff5f5;
  color: #e74c3c;
  padding: 12px;
  border-radius: 6px;
  margin-bottom: 16px;
  font-size: 14px;
  text-align: center;
}

.success-message {
  background-color: #d4edda;
  color: #155724;
  padding: 12px;
  border-radius: 6px;
  margin-bottom: 16px;
  font-size: 14px;
  text-align: center;
}

.full-width {
  width: 100%;
  padding: 14px;
  font-size: 16px;
}
</style>
