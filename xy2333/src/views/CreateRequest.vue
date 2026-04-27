<template>
  <div class="page">
    <div class="page-header">
      <div class="header-content">
        <span class="back-btn" @click="goBack">‹</span>
        <span class="header-title">发布求助</span>
        <span></span>
      </div>
    </div>
    
    <div class="content">
      <form @submit.prevent="handleSubmit" class="form-container">
        <!-- 分类选择 -->
        <div class="form-section">
          <h3 class="section-title">选择分类</h3>
          <div class="category-grid">
            <div 
              v-for="(category, key) in CATEGORIES" 
              :key="key"
              class="category-option" 
              :class="{ selected: selectedCategory === category.id }"
              @click="selectCategory(category.id)"
              :style="{ borderColor: selectedCategory === category.id ? category.color : '#eee' }"
            >
              <span class="category-icon">{{ category.icon }}</span>
              <span class="category-name">{{ category.name }}</span>
            </div>
          </div>
          
          <!-- 子分类 -->
          <div v-if="selectedCategory && currentSubcategories.length > 0" class="subcategory-section">
            <h4 class="subcategory-title">选择具体类型</h4>
            <div class="subcategory-grid">
              <div 
                v-for="subcategory in currentSubcategories" 
                :key="subcategory.id"
                class="subcategory-option" 
                :class="{ selected: selectedSubcategory === subcategory.id }"
                @click="selectSubcategory(subcategory.id)"
              >
                <span class="subcategory-icon">{{ subcategory.icon }}</span>
                <span class="subcategory-name">{{ subcategory.name }}</span>
              </div>
            </div>
          </div>
        </div>
        
        <!-- 基本信息 -->
        <div class="form-section">
          <h3 class="section-title">基本信息</h3>
          
          <div class="form-group">
            <label class="form-label">标题 *</label>
            <input 
              type="text" 
              v-model="title" 
              class="form-input" 
              placeholder="请输入求助标题（简短描述您的需求）"
              required
            />
          </div>
          
          <div class="form-group">
            <label class="form-label">详细描述 *</label>
            <textarea 
              v-model="description" 
              class="form-input form-textarea" 
              placeholder="请详细描述您的需求，包括具体要求、时间安排等..."
              required
            ></textarea>
          </div>
        </div>
        
        <!-- 位置与时间 -->
        <div class="form-section">
          <h3 class="section-title">位置与时间</h3>
          
          <div class="form-group">
            <label class="form-label">详细地址</label>
            <input 
              type="text" 
              v-model="location" 
              class="form-input" 
              placeholder="请输入详细地址（如：阳光花园1号楼3单元）"
            />
          </div>
          
          <div class="form-group">
            <label class="form-label">期望完成时间</label>
            <select v-model="estimatedTime" class="form-select">
              <option value="尽快">尽快</option>
              <option value="今天上午">今天上午</option>
              <option value="今天下午">今天下午</option>
              <option value="今天晚上">今天晚上</option>
              <option value="明天">明天</option>
              <option value="本周内">本周内</option>
              <option value="其他">其他</option>
            </select>
          </div>
        </div>
        
        <!-- 感谢与优先级 -->
        <div class="form-section">
          <h3 class="section-title">感谢与优先级</h3>
          
          <div class="form-group">
            <label class="form-label">感谢方式</label>
            <input 
              type="text" 
              v-model="reward" 
              class="form-input" 
              placeholder="如：感谢费50元、请喝奶茶等"
            />
          </div>
          
          <div class="form-group">
            <label class="form-label">优先级</label>
            <div class="priority-options">
              <div 
                class="priority-option" 
                :class="{ selected: priority === 'low' }"
                @click="setPriority('low')"
              >
                <span class="priority-icon">📋</span>
                <span class="priority-name">低</span>
              </div>
              <div 
                class="priority-option" 
                :class="{ selected: priority === 'medium' }"
                @click="setPriority('medium')"
              >
                <span class="priority-icon">⏰</span>
                <span class="priority-name">中</span>
              </div>
              <div 
                class="priority-option" 
                :class="{ selected: priority === 'high' }"
                @click="setPriority('high')"
              >
                <span class="priority-icon">🚨</span>
                <span class="priority-name">紧急</span>
              </div>
            </div>
          </div>
        </div>
        
        <!-- 标签 -->
        <div class="form-section">
          <h3 class="section-title">相关标签（可选）</h3>
          <div class="tags-container">
            <div 
              v-for="tag in suggestedTags" 
              :key="tag"
              class="tag-option" 
              :class="{ selected: selectedTags.includes(tag) }"
              @click="toggleTag(tag)"
            >
              {{ tag }}
            </div>
          </div>
          <p class="form-tip">选择相关标签可以让更多合适的邻居看到您的求助</p>
        </div>
        
        <!-- 错误提示 -->
        <div v-if="errorMessage" class="error-message">
          {{ errorMessage }}
        </div>
        
        <!-- 成功提示 -->
        <div v-if="successMessage" class="success-message">
          {{ successMessage }}
        </div>
        
        <!-- 提交按钮 -->
        <div class="action-buttons">
          <button 
            type="button" 
            class="btn btn-secondary full-width" 
            @click="resetForm"
          >
            重置
          </button>
          <button 
            type="submit" 
            class="btn btn-primary full-width" 
            :disabled="loading"
          >
            {{ loading ? '发布中...' : '发布求助' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '../stores/user'
import { useHelpRequestsStore } from '../stores/helpRequests'
import { CATEGORIES } from '../utils/helpers'

const router = useRouter()
const userStore = useUserStore()
const helpRequestsStore = useHelpRequestsStore()

// 表单数据
const selectedCategory = ref('')
const selectedSubcategory = ref('')
const title = ref('')
const description = ref('')
const location = ref('')
const estimatedTime = ref('尽快')
const reward = ref('')
const priority = ref('medium')
const selectedTags = ref([])
const errorMessage = ref('')
const successMessage = ref('')
const loading = ref(false)

onMounted(() => {
  if (!userStore.checkAuth()) {
    router.push('/login')
    return
  }
  
  // 自动填充用户地址
  if (userStore.currentUser && userStore.currentUser.location) {
    location.value = userStore.currentUser.location
  }
})

// 获取当前分类的子分类
const currentSubcategories = computed(() => {
  if (!selectedCategory.value) return []
  
  for (const key in CATEGORIES) {
    if (CATEGORIES[key].id === selectedCategory.value) {
      return CATEGORIES[key].subcategories || []
    }
  }
  return []
})

// 根据分类推荐标签
const suggestedTags = computed(() => {
  const allTags = [
    '紧急', '求助', '维修', '代购', '接送', '陪伴',
    '临时', '老人', '孩子', '宠物', '工具', '闲置',
    '周末', '工作日', '上午', '下午', '晚上'
  ]
  
  // 根据分类添加相关标签
  const categoryTags = {
    emergency: ['紧急', '求助', '老人'],
    daily: ['代购', '接送', '陪伴', '临时'],
    skill: ['维修', '技术', '专业'],
    resource: ['工具', '闲置', '共享']
  }
  
  if (selectedCategory.value && categoryTags[selectedCategory.value]) {
    return [...new Set([...categoryTags[selectedCategory.value], ...allTags])]
  }
  
  return allTags
})

function selectCategory(categoryId) {
  selectedCategory.value = categoryId
  selectedSubcategory.value = ''
}

function selectSubcategory(subcategoryId) {
  selectedSubcategory.value = subcategoryId
}

function setPriority(priorityValue) {
  priority.value = priorityValue
}

function toggleTag(tag) {
  const index = selectedTags.value.indexOf(tag)
  if (index === -1) {
    if (selectedTags.value.length < 5) {
      selectedTags.value.push(tag)
    }
  } else {
    selectedTags.value.splice(index, 1)
  }
}

function goBack() {
  router.back()
}

function resetForm() {
  selectedCategory.value = ''
  selectedSubcategory.value = ''
  title.value = ''
  description.value = ''
  estimatedTime.value = '尽快'
  reward.value = ''
  priority.value = 'medium'
  selectedTags.value = []
  errorMessage.value = ''
  successMessage.value = ''
}

function handleSubmit() {
  // 验证表单
  if (!selectedCategory.value) {
    errorMessage.value = '请选择求助分类'
    return
  }
  
  if (!title.value.trim()) {
    errorMessage.value = '请输入求助标题'
    return
  }
  
  if (!description.value.trim()) {
    errorMessage.value = '请输入详细描述'
    return
  }
  
  loading.value = true
  errorMessage.value = ''
  successMessage.value = ''
  
  // 模拟发布延迟
  setTimeout(() => {
    const requestData = {
      title: title.value.trim(),
      description: description.value.trim(),
      category: selectedCategory.value,
      subcategory: selectedSubcategory.value,
      location: location.value.trim(),
      estimatedTime: estimatedTime.value,
      reward: reward.value.trim() || '感谢帮助',
      priority: priority.value,
      tags: selectedTags.value
    }
    
    const result = helpRequestsStore.createHelpRequest(requestData)
    
    if (result.success) {
      successMessage.value = '发布成功！'
      
      // 延迟后跳转到求助详情页
      setTimeout(() => {
        router.push(`/help-requests/${result.request.id}`)
      }, 1500)
    } else {
      errorMessage.value = result.message
    }
    
    loading.value = false
  }, 800)
}
</script>

<style scoped>
.page {
  padding-bottom: 40px;
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

.header-title {
  font-size: 17px;
  font-weight: 600;
}

.content {
  padding: 16px;
}

.form-container {
  max-width: 600px;
  margin: 0 auto;
}

.form-section {
  background-color: white;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 16px;
  color: #333;
  padding-bottom: 8px;
  border-bottom: 1px solid #f0f0f0;
}

.subcategory-section {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #f0f0f0;
}

.subcategory-title {
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 12px;
  color: #666;
}

.category-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.category-option {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16px;
  background-color: #f8f9fa;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 2px solid #eee;
}

.category-option:hover {
  background-color: #e8f4fd;
  transform: translateY(-2px);
}

.category-option.selected {
  background-color: #e8f4fd;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.category-icon {
  font-size: 32px;
  margin-bottom: 8px;
}

.category-name {
  font-size: 14px;
  font-weight: 500;
  color: #333;
}

.subcategory-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.subcategory-option {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  background-color: #f5f5f5;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 1px solid #eee;
}

.subcategory-option:hover {
  background-color: #e8f4fd;
  border-color: #4a90e2;
}

.subcategory-option.selected {
  background-color: #4a90e2;
  border-color: #4a90e2;
  color: white;
}

.subcategory-icon {
  margin-right: 4px;
}

.subcategory-name {
  font-size: 13px;
}

.priority-options {
  display: flex;
  gap: 12px;
}

.priority-option {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px;
  background-color: #f8f9fa;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 2px solid transparent;
}

.priority-option:hover {
  background-color: #e8f4fd;
}

.priority-option.selected {
  background-color: #e8f4fd;
  border-color: #4a90e2;
}

.priority-option.selected[data-priority="high"] {
  background-color: #fff5f5;
  border-color: #e74c3c;
}

.priority-icon {
  font-size: 24px;
  margin-bottom: 4px;
}

.priority-name {
  font-size: 13px;
  font-weight: 500;
  color: #333;
}

.tags-container {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
}

.tag-option {
  padding: 6px 12px;
  background-color: #f5f5f5;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 1px solid #eee;
  color: #666;
}

.tag-option:hover {
  background-color: #e8f4fd;
  border-color: #4a90e2;
  color: #4a90e2;
}

.tag-option.selected {
  background-color: #4a90e2;
  border-color: #4a90e2;
  color: white;
}

.form-tip {
  font-size: 12px;
  color: #999;
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

.action-buttons {
  display: flex;
  gap: 12px;
  margin-top: 24px;
}

.full-width {
  flex: 1;
  padding: 14px;
  font-size: 16px;
}
</style>
