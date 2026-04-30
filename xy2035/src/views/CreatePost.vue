<template>
  <div class="page">
    <div class="header">
      <button class="header-btn" @click="goBack">
        ←
      </button>
      <h1 class="header-title">发布动态</h1>
      <button class="btn btn-primary py-1.5 text-sm" @click="submitPost" :disabled="!canSubmit">
        发布
      </button>
    </div>

    <div class="page-content p-4">
      <div class="form-group mb-4">
        <label class="block text-sm font-medium mb-2">标题</label>
        <input 
          v-model="postTitle"
          type="text" 
          class="input"
          placeholder="请输入标题"
          maxlength="50"
        />
        <div class="text-xs text-light text-right mt-1">{{ postTitle.length }}/50</div>
      </div>

      <div class="form-group mb-4">
        <label class="block text-sm font-medium mb-2">内容</label>
        <textarea 
          v-model="postContent"
          class="input textarea"
          placeholder="分享你的美食故事、心得、技巧..."
          rows="6"
          maxlength="500"
        ></textarea>
        <div class="text-xs text-light text-right mt-1">{{ postContent.length }}/500</div>
      </div>

      <div class="form-group mb-4">
        <label class="block text-sm font-medium mb-2">添加图片（最多9张）</label>
        <div class="image-upload-area flex gap-3 flex-wrap">
          <div 
            v-for="(img, idx) in postImages" 
            :key="idx"
            class="uploaded-image w-24 h-24 rounded-lg overflow-hidden relative"
          >
            <img :src="img" class="w-full h-full object-cover" />
            <button 
              class="remove-btn absolute top-1 right-1 w-6 h-6 bg-black/50 rounded-full text-white text-sm"
              @click="removeImage(idx)"
            >
              ×
            </button>
          </div>
          <button 
            v-if="postImages.length < 9"
            class="upload-btn w-24 h-24 border-2 border-dashed border-secondary/30 rounded-lg flex flex-col items-center justify-center text-secondary"
            @click="addImage"
          >
            <span class="text-3xl">+</span>
            <span class="text-xs mt-1">添加图片</span>
          </button>
        </div>
      </div>

      <div class="form-group mb-4">
        <label class="block text-sm font-medium mb-2">关联菜谱（可选）</label>
        <div class="recipe-select">
          <div 
            v-if="selectedRecipe"
            class="selected-recipe flex items-center gap-3 p-3 bg-secondary/10 rounded-lg"
          >
            <div class="recipe-image w-14 h-14 rounded-lg overflow-hidden flex-shrink-0">
              <img :src="selectedRecipe.image" class="w-full h-full object-cover" />
            </div>
            <div class="flex-1 min-w-0">
              <div class="font-medium text-sm ellipsis">{{ selectedRecipe.title }}</div>
              <div class="text-xs text-secondary">
                ⭐ {{ selectedRecipe.rating }} · ⏱️ {{ selectedRecipe.time }}
              </div>
            </div>
            <button class="btn-text text-danger text-sm" @click="clearSelectedRecipe">
              清除
            </button>
          </div>
          <div v-else>
            <div class="recipe-list">
              <div class="text-sm text-secondary mb-2">选择一个菜谱：</div>
              <div 
                v-for="recipe in recentRecipes" 
                :key="recipe.id"
                class="recipe-option flex items-center gap-3 p-3 rounded-lg mb-2 cursor-pointer hover:bg-secondary/10"
                @click="selectRecipe(recipe)"
              >
                <div class="recipe-image w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
                  <img :src="recipe.image" class="w-full h-full object-cover" />
                </div>
                <div class="flex-1 min-w-0">
                  <div class="font-medium text-sm ellipsis">{{ recipe.title }}</div>
                  <div class="text-xs text-secondary">
                    ⭐ {{ recipe.rating }} · ⏱️ {{ recipe.time }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="form-group mb-4">
        <label class="block text-sm font-medium mb-2">添加标签（最多5个）</label>
        <div class="tags-input">
          <div class="selected-tags flex flex-wrap gap-2 mb-3">
            <span 
              v-for="(tag, idx) in selectedTags" 
              :key="idx"
              class="tag tag-primary flex items-center gap-1"
            >
              #{{ tag }}
              <button class="text-xs" @click="removeTag(idx)">×</button>
            </span>
          </div>
          <div class="flex gap-2">
            <input 
              v-model="newTag"
              type="text" 
              class="input flex-1"
              placeholder="输入标签（如：烘焙、减脂餐）"
              @keyup.enter="addTag"
              maxlength="10"
            />
            <button class="btn btn-outline" @click="addTag">
              添加
            </button>
          </div>
          <div class="hot-tags mt-3">
            <span class="text-xs text-secondary mr-2">热门标签：</span>
            <button 
              v-for="tag in hotTags" 
              :key="tag"
              class="btn-text text-sm text-primary mr-2"
              @click="quickAddTag(tag)"
              :disabled="selectedTags.includes(tag)"
            >
              #{{ tag }}
            </button>
          </div>
        </div>
      </div>

      <div class="p-4"></div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/userStore'
import { recipes } from '@/data/mockData'

const router = useRouter()
const userStore = useUserStore()

const postTitle = ref('')
const postContent = ref('')
const postImages = ref([])
const selectedRecipe = ref(null)
const selectedTags = ref([])
const newTag = ref('')

const hotTags = ['烘焙', '减脂餐', '家常菜', '甜品', '下午茶', '快手菜', '川菜', '粤菜']

const recentRecipes = computed(() => recipes.value.slice(0, 5))

const canSubmit = computed(() => {
  return postTitle.value.trim() && postContent.value.trim()
})

const goBack = () => {
  router.back()
}

const addImage = () => {
  if (postImages.value.length >= 9) return
  const randomRecipe = recipes.value[Math.floor(Math.random() * recipes.value.length)]
  postImages.value.push(randomRecipe.image)
}

const removeImage = (index) => {
  postImages.value.splice(index, 1)
}

const selectRecipe = (recipe) => {
  selectedRecipe.value = recipe
}

const clearSelectedRecipe = () => {
  selectedRecipe.value = null
}

const addTag = () => {
  const tag = newTag.value.trim()
  if (tag && !selectedTags.value.includes(tag) && selectedTags.value.length < 5) {
    selectedTags.value.push(tag)
    newTag.value = ''
  }
}

const removeTag = (index) => {
  selectedTags.value.splice(index, 1)
}

const quickAddTag = (tag) => {
  if (!selectedTags.value.includes(tag) && selectedTags.value.length < 5) {
    selectedTags.value.push(tag)
  }
}

const submitPost = () => {
  if (!canSubmit.value) return
  
  userStore.addNewPost(
    postTitle.value,
    postContent.value,
    [...postImages.value],
    [...selectedTags.value]
  )
  
  alert('发布成功！')
  router.back()
}
</script>

<style scoped>
.form-group {
  margin-bottom: 16px;
}

.image-upload-area {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.upload-btn {
  border: 2px dashed var(--border-color);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.2s;
}

.upload-btn:hover {
  border-color: var(--primary-color);
  color: var(--primary-color);
}

.uploaded-image {
  position: relative;
  border-radius: var(--radius-md);
  overflow: hidden;
}

.remove-btn {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 24px;
  height: 24px;
  background-color: rgba(0, 0, 0, 0.5);
  border: none;
  border-radius: 50%;
  color: white;
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.recipe-option {
  transition: background-color 0.2s;
}

.recipe-option:hover {
  background-color: var(--bg-secondary);
}

.selected-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.hot-tags {
  margin-top: 12px;
}

.page-content {
  padding-bottom: 80px;
}
</style>
