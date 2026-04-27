<template>
  <div class="page">
    <div class="page-header">
      <div class="header-content">
        <span class="back-btn" @click="goBack">‹</span>
        <span class="header-title">发布动态</span>
        <span 
          class="publish-btn" 
          :class="{ disabled: !canPublish }"
          @click="submitPost"
        >
          发布
        </span>
      </div>
    </div>
    
    <div class="content">
      <!-- 分类选择 -->
      <div class="form-section">
        <label class="form-label">动态分类</label>
        <div class="category-grid">
          <div 
            v-for="(name, key) in CATEGORY_NAMES" 
            :key="key"
            class="category-option"
            :class="{ selected: formData.category === key }"
            @click="selectCategory(key)"
          >
            <span class="category-icon">{{ getCategoryIcon(key) }}</span>
            <span class="category-name">{{ name }}</span>
          </div>
        </div>
      </div>
      
      <!-- 标题输入 -->
      <div class="form-section">
        <label class="form-label">标题</label>
        <input 
          v-model="formData.title"
          type="text" 
          class="form-input" 
          placeholder="请输入标题（最多30字）"
          maxlength="30"
        />
        <div class="char-count">{{ formData.title.length }}/30</div>
      </div>
      
      <!-- 内容输入 -->
      <div class="form-section">
        <label class="form-label">内容</label>
        <textarea 
          v-model="formData.content"
          class="form-textarea" 
          placeholder="分享你的故事或想法..."
          rows="6"
          maxlength="500"
        ></textarea>
        <div class="char-count">{{ formData.content.length }}/500</div>
      </div>
      
      <!-- 添加图片 -->
      <div class="form-section">
        <label class="form-label">添加图片（可选）</label>
        <div class="image-upload-section">
          <div 
            v-for="(image, index) in formData.images" 
            :key="index"
            class="image-preview"
          >
            <img :src="image" :alt="`图片${index + 1}`" />
            <span class="remove-image" @click="removeImage(index)">×</span>
          </div>
          
          <div 
            v-if="formData.images.length < 9"
            class="image-upload-btn"
            @click="addImage"
          >
            <span class="upload-icon">+</span>
            <span class="upload-text">添加图片</span>
          </div>
        </div>
        <p class="form-tip">最多可添加9张图片</p>
      </div>
      
      <!-- 标签输入 -->
      <div class="form-section">
        <label class="form-label">添加标签（可选）</label>
        <div class="tags-section">
          <div class="selected-tags" v-if="formData.tags.length > 0">
            <span 
              v-for="tag in formData.tags" 
              :key="tag"
              class="skill-tag"
            >
              #{{ tag }}
              <span class="remove-tag" @click="removeTag(tag)">×</span>
            </span>
          </div>
          
          <div class="tag-input-row">
            <input 
              v-model="tagInput"
              type="text" 
              class="tag-input" 
              placeholder="输入标签后按回车添加"
              @keyup.enter="addTag"
            />
            <button 
              class="btn btn-secondary small-btn"
              @click="addTag"
              :disabled="!tagInput.trim()"
            >
              添加
            </button>
          </div>
          
          <!-- 推荐标签 -->
          <div class="suggested-tags" v-if="suggestedTags.length > 0">
            <p class="suggested-label">推荐标签：</p>
            <div class="suggested-tag-list">
              <span 
                v-for="tag in suggestedTags" 
                :key="tag"
                class="suggested-tag"
                @click="selectSuggestedTag(tag)"
              >
                {{ tag }}
              </span>
            </div>
          </div>
        </div>
      </div>
      
      <!-- 发布提示 -->
      <div class="tips-section">
        <h4 class="tips-title">📝 发布提示</h4>
        <ul class="tips-list">
          <li>请发布真实、有价值的内容</li>
          <li>互助故事类内容请详细描述你的经历</li>
          <li>社区活动类内容请注明活动时间地点</li>
          <li>请勿发布广告、色情、暴力等违法违规内容</li>
          <li>发布内容将由管理员审核，违规内容将被删除</li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '../stores/user'
import { useCommunityStore } from '../stores/community'
import { generateId } from '../utils/helpers'

const router = useRouter()
const userStore = useUserStore()
const communityStore = useCommunityStore()

const CATEGORY_NAMES = {
  story: '互助故事',
  activity: '社区活动',
  notice: '通知公告',
  life: '生活分享'
}

const CATEGORY_ICONS = {
  story: '🤝',
  activity: '🎉',
  notice: '📢',
  life: '🌈'
}

const SUGGESTED_TAGS = [
  '邻里互助',
  '好人好事',
  '社区活动',
  '生活分享',
  '求助经历',
  '帮助他人',
  '邻里情',
  '温馨时刻',
  '志愿服务',
  '爱心传递'
]

const tagInput = ref('')

const formData = reactive({
  category: 'life',
  title: '',
  content: '',
  images: [],
  tags: []
})

const canPublish = computed(() => {
  return formData.title.trim() && formData.content.trim() && formData.category
})

const suggestedTags = computed(() => {
  return SUGGESTED_TAGS.filter(tag => !formData.tags.includes(tag))
})

onMounted(() => {
  if (!userStore.checkAuth()) {
    router.push('/login')
    return
  }
})

function getCategoryIcon(key) {
  return CATEGORY_ICONS[key] || '📝'
}

function selectCategory(key) {
  formData.category = key
}

function addTag() {
  const tag = tagInput.value.trim()
  if (!tag) return
  
  if (formData.tags.includes(tag)) {
    return
  }
  
  formData.tags.push(tag)
  tagInput.value = ''
}

function removeTag(tag) {
  const index = formData.tags.indexOf(tag)
  if (index > -1) {
    formData.tags.splice(index, 1)
  }
}

function selectSuggestedTag(tag) {
  if (!formData.tags.includes(tag)) {
    formData.tags.push(tag)
  }
}

function addImage() {
  const placeholderImages = [
    'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=社区邻里互助温馨场景%20阳光明媚%20邻里互相帮助%20温暖色调&image_size=square',
    'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=社区活动场景%20邻里聚会%20热闹温馨%20生活化&image_size=square',
    'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=邻里间互帮互助%20友善和谐%20微笑交流&image_size=square'
  ]
  
  if (formData.images.length < 9) {
    const randomImage = placeholderImages[Math.floor(Math.random() * placeholderImages.length)]
    formData.images.push(randomImage)
  }
}

function removeImage(index) {
  formData.images.splice(index, 1)
}

function goBack() {
  router.back()
}

function submitPost() {
  if (!canPublish.value) {
    alert('请填写完整的标题和内容')
    return
  }
  
  const postData = {
    id: generateId(),
    title: formData.title.trim(),
    content: formData.content.trim(),
    images: formData.images,
    authorId: userStore.currentUser.id,
    likes: 0,
    likedBy: [],
    comments: [],
    category: formData.category,
    tags: formData.tags,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
  
  communityStore.createPost(postData)
  
  // 重置表单
  formData.category = 'life'
  formData.title = ''
  formData.content = ''
  formData.images = []
  formData.tags = []
  
  // 跳转到邻里圈
  router.push('/community')
}
</script>

<style scoped>
.page {
  padding-bottom: 20px;
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

.publish-btn {
  font-size: 14px;
  color: #4a90e2;
  cursor: pointer;
  padding: 6px 12px;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.publish-btn:hover {
  background-color: rgba(74, 144, 226, 0.1);
}

.publish-btn.disabled {
  color: #ccc;
  cursor: not-allowed;
}

.publish-btn.disabled:hover {
  background-color: transparent;
}

.content {
  padding: 12px;
}

.form-section {
  margin-bottom: 20px;
}

.form-label {
  display: block;
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 8px;
  color: #333;
}

.form-input {
  width: 100%;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 15px;
  outline: none;
  transition: border-color 0.2s ease;
  box-sizing: border-box;
}

.form-input:focus {
  border-color: #4a90e2;
}

.form-textarea {
  width: 100%;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 15px;
  outline: none;
  transition: border-color 0.2s ease;
  resize: none;
  box-sizing: border-box;
  line-height: 1.5;
}

.form-textarea:focus {
  border-color: #4a90e2;
}

.char-count {
  text-align: right;
  font-size: 12px;
  color: #999;
  margin-top: 4px;
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
  justify-content: center;
  padding: 16px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.category-option:hover {
  border-color: #4a90e2;
  background-color: #f8f9fa;
}

.category-option.selected {
  border-color: #4a90e2;
  background-color: #e8f4fd;
}

.category-icon {
  font-size: 28px;
  margin-bottom: 8px;
}

.category-name {
  font-size: 14px;
  font-weight: 500;
  color: #333;
}

.image-upload-section {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.image-preview {
  width: calc(33.33% - 6px);
  aspect-ratio: 1;
  position: relative;
  border-radius: 8px;
  overflow: hidden;
  background-color: #f0f0f0;
}

.image-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.remove-image {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 20px;
  height: 20px;
  background-color: rgba(0, 0, 0, 0.5);
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.remove-image:hover {
  background-color: rgba(0, 0, 0, 0.7);
}

.image-upload-btn {
  width: calc(33.33% - 6px);
  aspect-ratio: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border: 2px dashed #ddd;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.image-upload-btn:hover {
  border-color: #4a90e2;
  background-color: #f8f9fa;
}

.upload-icon {
  font-size: 32px;
  color: #999;
  margin-bottom: 4px;
}

.upload-text {
  font-size: 12px;
  color: #999;
}

.form-tip {
  font-size: 12px;
  color: #999;
  margin-top: 8px;
}

.tags-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.selected-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.remove-tag {
  margin-left: 4px;
  cursor: pointer;
  opacity: 0.7;
  transition: opacity 0.2s ease;
}

.remove-tag:hover {
  opacity: 1;
}

.tag-input-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.tag-input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 20px;
  font-size: 13px;
  outline: none;
  transition: border-color 0.2s ease;
}

.tag-input:focus {
  border-color: #4a90e2;
}

.suggested-tags {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.suggested-label {
  font-size: 12px;
  color: #999;
  margin: 0;
}

.suggested-tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.suggested-tag {
  padding: 4px 12px;
  background-color: #f5f5f5;
  border-radius: 15px;
  font-size: 12px;
  color: #666;
  cursor: pointer;
  transition: all 0.2s ease;
}

.suggested-tag:hover {
  background-color: #4a90e2;
  color: white;
}

.small-btn {
  padding: 6px 16px;
  font-size: 13px;
}

.tips-section {
  background-color: #f8f9fa;
  border-radius: 8px;
  padding: 16px;
  border-left: 4px solid #4a90e2;
}

.tips-title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 12px;
  color: #333;
}

.tips-list {
  margin: 0;
  padding-left: 18px;
}

.tips-list li {
  font-size: 12px;
  color: #666;
  margin-bottom: 6px;
  line-height: 1.5;
}

.tips-list li:last-child {
  margin-bottom: 0;
}
</style>
