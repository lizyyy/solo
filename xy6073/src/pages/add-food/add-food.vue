<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { foodManager, FOOD_CATEGORIES, CATEGORY_NAMES } from '@/utils/foodManager'
import { 
  getToday, 
  getDateAfterDays, 
  getDefaultShelfLife
} from '@/utils/dateUtils'

const router = useRouter()

const foodImage = ref('')
const isListening = ref(false)
const suggestedExpireDate = ref('')
const today = ref(getToday())
const unitIndex = ref(0)
const units = ['个', '斤', '克', '千克', '包', '袋', '瓶', '盒', '碗', '份']

const quickDates = [
  { label: '3天', days: 3 },
  { label: '7天', days: 7 },
  { label: '14天', days: 14 },
  { label: '30天', days: 30 }
]

const foodForm = ref({
  name: '',
  quantity: 1,
  unit: '个',
  category: FOOD_CATEGORIES.OTHER,
  expireDate: '',
  notes: ''
})

const categories = computed(() => {
  const iconMap = {
    [FOOD_CATEGORIES.VEGETABLE]: '🥬',
    [FOOD_CATEGORIES.FRUIT]: '🍎',
    [FOOD_CATEGORIES.MEAT]: '🥩',
    [FOOD_CATEGORIES.SEAFOOD]: '🦐',
    [FOOD_CATEGORIES.DAIRY]: '🥛',
    [FOOD_CATEGORIES.GRAIN]: '🍚',
    [FOOD_CATEGORIES.CONDIMENT]: '🧂',
    [FOOD_CATEGORIES.OTHER]: '🍽️'
  }
  
  return Object.entries(FOOD_CATEGORIES).map(([key, value]) => ({
    value: value,
    label: CATEGORY_NAMES[value],
    icon: iconMap[value]
  }))
})

// 拍照/选择图片
const takePhoto = () => {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.onchange = (e) => {
    const file = e.target.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (event) => {
        foodImage.value = event.target.result
        alert('图片选择成功')
      }
      reader.readAsDataURL(file)
    }
  }
  input.click()
}

// 预览图片
const previewImage = () => {
  if (foodImage.value) {
    const img = document.createElement('img')
    img.src = foodImage.value
    img.style.maxWidth = '90%'
    img.style.maxHeight = '90%'
    
    const modal = document.createElement('div')
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
    `
    modal.onclick = () => modal.remove()
    modal.appendChild(img)
    document.body.appendChild(modal)
  }
}

// 移除图片
const removeImage = () => {
  if (confirm('确定要删除这张图片吗？')) {
    foodImage.value = ''
  }
}

// 语音输入
const startVoiceInput = () => {
  if (isListening.value) {
    stopVoiceInput()
    return
  }
  
  isListening.value = true
  
  // 使用 prompt 让用户实际输入食材名称
  const input = prompt('请输入食材名称和数量（例如：土豆 3个 或 西红柿 2个）：', '')
  
  isListening.value = false
  
  if (input && input.trim()) {
    // 解析用户输入
    parseVoiceResult(input.trim())
    alert(`已输入：${input.trim()}`)
  }
}

const stopVoiceInput = () => {
  isListening.value = false
}

// 解析语音识别结果
const parseVoiceResult = (text) => {
  // 简单的解析逻辑：提取名称和数量
  const parts = text.trim().split(/\s+/)
  
  if (parts.length >= 1) {
    foodForm.value.name = parts[0]
    
    // 尝试提取数量
    if (parts.length >= 2) {
      const quantityMatch = parts[1].match(/(\d+)(.*)/)
      if (quantityMatch) {
        foodForm.value.quantity = parseInt(quantityMatch[1]) || 1
        if (quantityMatch[2]) {
          const unit = quantityMatch[2].trim()
          const idx = units.indexOf(unit)
          if (idx !== -1) {
            unitIndex.value = idx
            foodForm.value.unit = unit
          }
        }
      }
    }
    
    // 自动推荐保质期
    updateSuggestedExpireDate()
  }
}

// 名称输入完成时
const onNameBlur = () => {
  updateSuggestedExpireDate()
  autoSelectCategory()
}

// 更新建议保质期（只显示建议，不自动填充）
const updateSuggestedExpireDate = () => {
  if (foodForm.value.name.trim()) {
    const shelfLife = getDefaultShelfLife(foodForm.value.name)
    suggestedExpireDate.value = getDateAfterDays(shelfLife)
  } else {
    suggestedExpireDate.value = ''
  }
}

// 根据食材名称自动选择分类
const autoSelectCategory = () => {
  const name = foodForm.value.name.toLowerCase()
  
  const categoryRules = [
    { keywords: ['白菜', '青菜', '菠菜', '生菜', '芹菜', '胡萝卜', '萝卜', '土豆', '红薯', '西红柿', '番茄', '黄瓜', '茄子', '辣椒', '青椒', '西兰花', '花菜', '洋葱', '大蒜', '生姜'], category: FOOD_CATEGORIES.VEGETABLE },
    { keywords: ['苹果', '梨', '香蕉', '橙子', '橘子', '葡萄', '草莓', '西瓜', '哈密瓜', '芒果', '猕猴桃', '榴莲'], category: FOOD_CATEGORIES.FRUIT },
    { keywords: ['猪肉', '牛肉', '羊肉', '鸡肉', '鸭肉', '五花肉', '瘦肉', '排骨', '鸡翅', '鸡腿'], category: FOOD_CATEGORIES.MEAT },
    { keywords: ['鱼', '虾', '蟹', '海鲜'], category: FOOD_CATEGORIES.SEAFOOD },
    { keywords: ['牛奶', '酸奶', '鸡蛋', '鸭蛋', '奶酪', '黄油'], category: FOOD_CATEGORIES.DAIRY },
    { keywords: ['米饭', '面条', '面粉', '大米', '面包', '馒头'], category: FOOD_CATEGORIES.GRAIN },
    { keywords: ['酱油', '醋', '盐', '糖', '料酒', '蚝油', '豆瓣酱'], category: FOOD_CATEGORIES.CONDIMENT }
  ]
  
  for (const rule of categoryRules) {
    for (const keyword of rule.keywords) {
      if (name.includes(keyword)) {
        foodForm.value.category = rule.category
        return
      }
    }
  }
  
  foodForm.value.category = FOOD_CATEGORIES.OTHER
}

// 数量控制
const increaseQuantity = () => {
  if (foodForm.value.quantity < 999) {
    foodForm.value.quantity++
  }
}

const decreaseQuantity = () => {
  if (foodForm.value.quantity > 1) {
    foodForm.value.quantity--
  }
}

const validateQuantity = () => {
  if (foodForm.value.quantity < 1) {
    foodForm.value.quantity = 1
  } else if (foodForm.value.quantity > 999) {
    foodForm.value.quantity = 999
  }
}

// 单位选择
const onUnitChange = (e) => {
  unitIndex.value = e.target.value
  foodForm.value.unit = units[unitIndex.value]
}

// 分类选择
const selectCategory = (category) => {
  foodForm.value.category = category
}

// 日期选择
const onDateChange = (e) => {
  foodForm.value.expireDate = e.target.value
}

// 快速选择日期
const selectQuickDate = (days) => {
  foodForm.value.expireDate = getDateAfterDays(days)
}

// 验证表单
const validateForm = () => {
  if (!foodForm.value.name.trim()) {
    alert('请输入食材名称')
    return false
  }
  
  if (!foodForm.value.expireDate) {
    alert('请选择过期日期')
    return false
  }
  
  // 检查日期是否在今天之前
  const expireDate = new Date(foodForm.value.expireDate)
  const todayDate = new Date()
  todayDate.setHours(0, 0, 0, 0)
  
  if (expireDate < todayDate) {
    alert('过期日期不能早于今天')
    return false
  }
  
  return true
}

// 保存食材
const saveFood = () => {
  if (!validateForm()) {
    return
  }
  
  try {
    const foodData = {
      ...foodForm.value,
      image: foodImage.value
    }
    
    foodManager.addFood(foodData)
    
    alert('保存成功\n\n食材已添加到冰箱')
    router.push('/index')
  } catch (error) {
    console.error('保存失败:', error)
    alert('保存失败，请重试')
  }
}

// 保存并继续添加
const saveAndContinue = () => {
  if (!validateForm()) {
    return
  }
  
  try {
    const foodData = {
      ...foodForm.value,
      image: foodImage.value
    }
    
    foodManager.addFood(foodData)
    
    // 重置表单，保留部分设置
    const prevUnit = foodForm.value.unit
    const prevCategory = foodForm.value.category
    
    foodForm.value = {
      name: '',
      quantity: 1,
      unit: prevUnit,
      category: prevCategory,
      expireDate: '',
      notes: ''
    }
    foodImage.value = ''
    suggestedExpireDate.value = ''
    
    alert('保存成功，继续添加')
  } catch (error) {
    console.error('保存失败:', error)
    alert('保存失败，请重试')
  }
}
</script>

<template>
  <div class="page-container">
    <div class="form-scroll">
      <!-- 拍照区域 -->
      <div class="photo-section">
        <div class="section-title">
          <span class="title-icon">📷</span>
          <span class="title-text">食材照片（选填）</span>
        </div>
        <div class="photo-area">
          <div v-if="foodImage" class="photo-preview" @click="previewImage">
            <img :src="foodImage" class="preview-image" />
            <div class="photo-remove" @click.stop="removeImage">
              <span class="remove-icon">✕</span>
            </div>
          </div>
          <div v-else class="photo-placeholder" @click="takePhoto">
            <span class="placeholder-icon">📷</span>
            <span class="placeholder-text">点击拍照或选择图片</span>
          </div>
        </div>
      </div>

      <!-- 表单区域 -->
      <div class="form-section">
        <div class="section-title">
          <span class="title-icon">📝</span>
          <span class="title-text">食材信息</span>
        </div>

        <!-- 食材名称 -->
        <div class="form-group">
          <div class="form-label-row">
            <span class="form-label">食材名称</span>
            <span class="required-tag">必填</span>
            <div class="voice-btn" @click="startVoiceInput" :class="{ active: isListening }">
              <span class="voice-icon">{{ isListening ? '🎙️' : '🎤' }}</span>
              <span class="voice-text">{{ isListening ? '识别中...' : '语音输入' }}</span>
            </div>
          </div>
          <input 
            class="form-input" 
            type="text" 
            placeholder="请输入食材名称，如：西红柿、鸡蛋" 
            v-model="foodForm.name"
            @blur="onNameBlur"
          />
          <div v-if="suggestedExpireDate" class="suggestion-hint">
            <span class="hint-icon">💡</span>
            <span class="hint-text">{{ foodForm.name }} 建议保质期至 {{ suggestedExpireDate }}</span>
          </div>
        </div>

        <!-- 数量和单位 -->
        <div class="form-group">
          <span class="form-label">数量</span>
          <div class="quantity-row">
            <div class="quantity-controls">
              <div class="quantity-btn minus" @click="decreaseQuantity">
                <span class="btn-text">−</span>
              </div>
              <input 
                class="quantity-input" 
                type="number" 
                v-model.number="foodForm.quantity"
                @blur="validateQuantity"
                min="1"
                max="999"
              />
              <div class="quantity-btn plus" @click="increaseQuantity">
                <span class="btn-text">+</span>
              </div>
            </div>
            <select 
              :value="unitIndex" 
              @change="onUnitChange"
              class="unit-picker"
            >
              <option v-for="(unit, index) in units" :key="index" :value="index">
                {{ unit }}
              </option>
            </select>
          </div>
        </div>

        <!-- 分类选择 -->
        <div class="form-group">
          <span class="form-label">分类</span>
          <div class="category-grid">
            <div 
              class="category-item" 
              :class="{ active: foodForm.category === category.value }"
              v-for="category in categories" 
              :key="category.value"
              @click="selectCategory(category.value)"
            >
              <span class="category-icon">{{ category.icon }}</span>
              <span class="category-name">{{ category.label }}</span>
            </div>
          </div>
        </div>

        <!-- 保质期 -->
        <div class="form-group">
          <div class="form-label-row">
            <span class="form-label">保质期</span>
            <span class="required-tag">必填</span>
          </div>
          <input 
            type="date" 
            :value="foodForm.expireDate"
            :min="today"
            @input="onDateChange"
            class="date-picker"
            placeholder="请选择过期日期"
          />
          <div class="quick-select">
            <span class="quick-label">快速选择：</span>
            <div class="quick-buttons">
              <div 
                class="quick-btn" 
                v-for="(quick, index) in quickDates" 
                :key="index"
                @click="selectQuickDate(quick.days)"
              >
                {{ quick.label }}
              </div>
            </div>
          </div>
        </div>

        <!-- 备注 -->
        <div class="form-group">
          <span class="form-label">备注（选填）</span>
          <textarea 
            class="form-textarea" 
            placeholder="添加备注信息，如：存储位置、购买渠道等"
            v-model="foodForm.notes"
            maxlength="200"
            rows="4"
          />
          <div class="char-count">
            <span class="count-text">{{ foodForm.notes.length }}/200</span>
          </div>
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="action-section">
        <div class="action-btn save-btn" @click="saveFood">
          <span class="btn-icon">💾</span>
          <span class="btn-text">保存食材</span>
        </div>
        <div class="action-btn continue-btn" @click="saveAndContinue">
          <span class="btn-icon">➕</span>
          <span class="btn-text">保存并继续添加</span>
        </div>
      </div>

      <!-- 底部留白 -->
      <div style="height: 20px;"></div>
    </div>
  </div>
</template>

<style scoped>
.page-container {
  min-height: 100%;
  background-color: #f5f5f5;
}

.form-scroll {
  padding-bottom: 20px;
}

/* 通用区块样式 */
.photo-section,
.form-section,
.action-section {
  background-color: #fff;
  margin-bottom: 12px;
  padding: 16px;
}

.section-title {
  display: flex;
  align-items: center;
  margin-bottom: 16px;
}

.title-icon {
  font-size: 18px;
  margin-right: 4px;
}

.title-text {
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

/* 拍照区域 */
.photo-area {
  display: flex;
  justify-content: center;
}

.photo-placeholder {
  width: 120px;
  height: 120px;
  background-color: #f5f5f5;
  border-radius: 12px;
  border: 2px dashed #ccc;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
}

.photo-placeholder:active {
  border-color: #667eea;
  background-color: #f5f3ff;
}

.placeholder-icon {
  font-size: 36px;
  margin-bottom: 8px;
}

.placeholder-text {
  font-size: 12px;
  color: #999;
}

.photo-preview {
  position: relative;
  width: 120px;
  height: 120px;
  cursor: pointer;
}

.preview-image {
  width: 100%;
  height: 100%;
  border-radius: 12px;
  object-fit: cover;
}

.photo-remove {
  position: absolute;
  top: -8px;
  right: -8px;
  width: 24px;
  height: 24px;
  background-color: #FF3B30;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 10;
}

.remove-icon {
  color: #fff;
  font-size: 12px;
  font-weight: bold;
}

/* 表单样式 */
.form-group {
  margin-bottom: 20px;
}

.form-group:last-child {
  margin-bottom: 0;
}

.form-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  flex-wrap: wrap;
  gap: 8px;
}

.form-label {
  font-size: 14px;
  font-weight: 500;
  color: #333;
  display: flex;
  align-items: center;
}

.required-tag {
  font-size: 11px;
  color: #FF3B30;
  margin-left: 4px;
  padding: 2px 6px;
  background-color: #FFF2F0;
  border-radius: 4px;
}

.voice-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 8px 16px;
  background-color: #667eea;
  border-radius: 20px;
  cursor: pointer;
  transition: all 0.2s;
  user-select: none;
  pointer-events: auto;
  flex-shrink: 0;
  box-sizing: border-box;
  min-width: 90px;
}

.voice-btn:hover {
  background-color: #5a67d8;
}

.voice-btn:active {
  transform: scale(0.95);
}

.voice-btn.active {
  background-color: #FF3B30;
  animation: pulse 1s infinite;
}

.voice-icon {
  font-size: 16px;
  margin-right: 6px;
  line-height: 1;
}

.voice-text {
  font-size: 13px;
  color: #fff;
  font-weight: 500;
  line-height: 1;
  white-space: nowrap;
}

.voice-btn.active .voice-text {
  color: #fff;
}

@keyframes pulse {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
}

.form-input {
  width: 100%;
  height: 48px;
  padding: 0 12px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  font-size: 14px;
  background-color: #fafafa;
  box-sizing: border-box;
  transition: all 0.2s;
}

.form-input:focus {
  border-color: #667eea;
  background-color: #fff;
  outline: none;
}

.suggestion-hint {
  display: flex;
  align-items: center;
  margin-top: 8px;
  padding: 8px 12px;
  background-color: #FFF7E6;
  border-radius: 6px;
}

.hint-icon {
  font-size: 14px;
  margin-right: 4px;
}

.hint-text {
  font-size: 12px;
  color: #B8860B;
}

/* 数量选择 */
.quantity-row {
  display: flex;
  align-items: center;
}

.quantity-controls {
  display: flex;
  align-items: center;
  background-color: #f5f5f5;
  border-radius: 8px;
  padding: 4px;
}

.quantity-btn {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.quantity-btn:active {
  opacity: 0.8;
}

.quantity-btn.minus {
  background-color: #fff;
}

.quantity-btn.plus {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.quantity-btn.minus .btn-text {
  color: #666;
  font-size: 20px;
  font-weight: 300;
}

.quantity-btn.plus .btn-text {
  color: #fff;
  font-size: 20px;
  font-weight: 300;
}

.quantity-input {
  width: 60px;
  height: 40px;
  text-align: center;
  font-size: 16px;
  font-weight: 600;
  background: transparent;
  border: none;
  outline: none;
}

/* 隐藏数字输入框的箭头 */
.quantity-input::-webkit-outer-spin-button,
.quantity-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.unit-picker {
  margin-left: 12px;
  padding: 0 12px;
  height: 44px;
  background-color: #f5f5f5;
  border-radius: 8px;
  border: none;
  font-size: 14px;
  color: #333;
  cursor: pointer;
}

.unit-picker:focus {
  outline: none;
  background-color: #fff;
  border: 1px solid #667eea;
}

/* 分类选择 */
.category-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.category-item {
  width: calc(25% - 6px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 12px 0;
  background-color: #f5f5f5;
  border-radius: 8px;
  border: 2px solid transparent;
  cursor: pointer;
  transition: all 0.2s;
}

.category-item:active {
  opacity: 0.8;
}

.category-item.active {
  background-color: #F0F7FF;
  border-color: #667eea;
}

.category-icon {
  font-size: 28px;
  margin-bottom: 4px;
}

.category-name {
  font-size: 12px;
  color: #666;
}

.category-item.active .category-name {
  color: #667eea;
  font-weight: 500;
}

/* 日期选择 */
.date-picker {
  width: 100%;
  height: 48px;
  padding: 0 12px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  font-size: 14px;
  background-color: #fafafa;
  cursor: pointer;
}

.date-picker:focus {
  outline: none;
  border-color: #667eea;
  background-color: #fff;
}

.quick-select {
  margin-top: 12px;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
}

.quick-label {
  font-size: 12px;
  color: #999;
  margin-right: 8px;
}

.quick-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.quick-btn {
  padding: 6px 12px;
  background-color: #f5f5f5;
  border-radius: 16px;
  font-size: 12px;
  color: #666;
  cursor: pointer;
  transition: all 0.2s;
}

.quick-btn:active {
  background-color: #e0e0e0;
}

/* 备注 */
.form-textarea {
  width: 100%;
  min-height: 80px;
  padding: 12px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  font-size: 14px;
  background-color: #fafafa;
  box-sizing: border-box;
  line-height: 1.6;
  resize: vertical;
  font-family: inherit;
}

.form-textarea:focus {
  outline: none;
  border-color: #667eea;
  background-color: #fff;
}

.char-count {
  text-align: right;
  margin-top: 4px;
}

.count-text {
  font-size: 11px;
  color: #999;
}

/* 操作按钮 */
.action-section {
  padding-bottom: 24px;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 50px;
  border-radius: 12px;
  margin-bottom: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.action-btn:active {
  opacity: 0.8;
}

.action-btn:last-child {
  margin-bottom: 0;
}

.save-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.continue-btn {
  background-color: #34C759;
}

.btn-icon {
  font-size: 20px;
  margin-right: 8px;
}

.btn-text {
  font-size: 16px;
  font-weight: 500;
  color: #fff;
}
</style>
