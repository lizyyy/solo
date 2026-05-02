<template>
  <div class="page">
    <div class="header">
      <button class="header-btn" @click="goBack">
        ←
      </button>
      <h1 class="header-title">上传菜谱</h1>
      <button class="btn btn-primary py-1.5 text-sm" @click="submitRecipe" :disabled="!canSubmit">
        发布
      </button>
    </div>

    <div class="page-content p-4">
      <div class="form-group mb-4">
        <label class="block text-sm font-medium mb-2">菜谱封面图</label>
        <div class="cover-upload">
          <div v-if="coverImage" class="cover-preview rounded-lg overflow-hidden relative">
            <img :src="coverImage" class="w-full h-48 object-cover" />
            <button 
              class="remove-btn absolute top-2 right-2 w-8 h-8 bg-black/50 rounded-full text-white"
              @click="removeCover"
            >
              ×
            </button>
          </div>
          <button 
            v-else
            class="upload-cover w-full h-48 border-2 border-dashed border-secondary/30 rounded-lg flex flex-col items-center justify-center text-secondary"
            @click="addCover"
          >
            <span class="text-4xl">📷</span>
            <span class="text-sm mt-2">点击上传封面图</span>
            <span class="text-xs text-light mt-1">建议尺寸 600x400</span>
          </button>
        </div>
      </div>

      <div class="form-group mb-4">
        <label class="block text-sm font-medium mb-2">菜谱名称</label>
        <input 
          v-model="recipeName"
          type="text" 
          class="input"
          placeholder="例如：红烧肉、糖醋排骨"
          maxlength="30"
        />
        <div class="text-xs text-light text-right mt-1">{{ recipeName.length }}/30</div>
      </div>

      <div class="form-group mb-4">
        <label class="block text-sm font-medium mb-2">选择分类</label>
        <div class="category-grid grid grid-cols-4 gap-2">
          <button 
            v-for="cat in categories" 
            :key="cat.id"
            class="category-btn flex flex-col items-center gap-1 p-2 rounded-lg border"
            :class="{ selected: selectedCategory === cat.id }"
            @click="selectedCategory = cat.id"
          >
            <span class="text-2xl">{{ cat.icon }}</span>
            <span class="text-xs">{{ cat.name }}</span>
          </button>
        </div>
      </div>

      <div class="form-group mb-4">
        <label class="block text-sm font-medium mb-2">菜品简介</label>
        <textarea 
          v-model="recipeDesc"
          class="input textarea"
          placeholder="简单介绍一下这道菜的特点..."
          rows="3"
          maxlength="200"
        ></textarea>
        <div class="text-xs text-light text-right mt-1">{{ recipeDesc.length }}/200</div>
      </div>

      <div class="form-group mb-4">
        <label class="block text-sm font-medium mb-2">难度等级</label>
        <div class="difficulty-select flex gap-3">
          <button 
            v-for="d in difficulties" 
            :key="d"
            class="btn"
            :class="selectedDifficulty === d ? 'btn-primary' : 'btn-outline'"
            @click="selectedDifficulty = d"
          >
            {{ d }}
          </button>
        </div>
      </div>

      <div class="form-group mb-4">
        <label class="block text-sm font-medium mb-2">烹饪时间</label>
        <input 
          v-model="cookingTime"
          type="text" 
          class="input"
          placeholder="例如：30分钟、1小时"
        />
      </div>

      <div class="form-group mb-4">
        <label class="block text-sm font-medium mb-2">预估卡路里</label>
        <input 
          v-model="calories"
          type="number" 
          class="input"
          placeholder="输入卡路里数值"
        />
      </div>

      <div class="form-group mb-4">
        <label class="block text-sm font-medium mb-2">添加标签</label>
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
              placeholder="输入标签（如：快手菜、下饭）"
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

      <div class="form-group mb-4">
        <label class="block text-sm font-medium mb-2">食材用料</label>
        <div class="ingredients-list">
          <div 
            v-for="(ingredient, idx) in ingredients" 
            :key="idx"
            class="ingredient-row flex gap-2 items-center mb-2"
          >
            <input 
              v-model="ingredient.name"
              type="text" 
              class="input flex-1"
              placeholder="食材名称"
            />
            <input 
              v-model="ingredient.amount"
              type="text" 
              class="input w-24"
              placeholder="用量"
            />
            <button 
              class="btn-text text-danger"
              @click="removeIngredient(idx)"
              v-if="ingredients.length > 1"
            >
              ×
            </button>
          </div>
          <button class="btn btn-outline w-full mt-2" @click="addIngredient">
            + 添加食材
          </button>
        </div>
      </div>

      <div class="form-group mb-4">
        <label class="block text-sm font-medium mb-2">做法步骤</label>
        <div class="steps-list">
          <div 
            v-for="(step, idx) in steps" 
            :key="idx"
            class="step-row card p-3 mb-3"
          >
            <div class="flex items-center justify-between mb-2">
              <span class="tag tag-primary">第 {{ idx + 1 }} 步</span>
              <button 
                class="btn-text text-danger text-sm"
                @click="removeStep(idx)"
                v-if="steps.length > 1"
              >
                删除
              </button>
            </div>
            <textarea 
              v-model="step.description"
              class="input textarea mb-2"
              placeholder="描述这一步的操作..."
              rows="2"
            ></textarea>
            <div class="step-image-upload">
              <div v-if="step.image" class="step-image-preview w-20 h-20 rounded-lg overflow-hidden relative">
                <img :src="step.image" class="w-full h-full object-cover" />
                <button 
                  class="remove-btn absolute top-1 right-1 w-5 h-5 bg-black/50 rounded-full text-white text-xs"
                  @click="removeStepImage(idx)"
                >
                  ×
                </button>
              </div>
              <button 
                v-else
                class="upload-btn w-20 h-20 border-2 border-dashed border-secondary/30 rounded-lg flex flex-col items-center justify-center text-secondary"
                @click="addStepImage(idx)"
              >
                <span class="text-xl">+</span>
                <span class="text-xs">配图</span>
              </button>
            </div>
          </div>
          <button class="btn btn-outline w-full" @click="addStep">
            + 添加步骤
          </button>
        </div>
      </div>

      <div class="form-group mb-4">
        <label class="block text-sm font-medium mb-2">小贴士（可选）</label>
        <textarea 
          v-model="tips"
          class="input textarea"
          placeholder="分享一些制作这道菜的小技巧、注意事项..."
          rows="3"
          maxlength="300"
        ></textarea>
      </div>

      <div class="p-4"></div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { categories, recipes } from '@/data/mockData'

const router = useRouter()

const coverImage = ref(null)
const recipeName = ref('')
const selectedCategory = ref(null)
const recipeDesc = ref('')
const selectedDifficulty = ref('简单')
const cookingTime = ref('')
const calories = ref('')
const selectedTags = ref([])
const newTag = ref('')
const ingredients = ref([{ name: '', amount: '' }])
const steps = ref([{ description: '', image: null }])
const tips = ref('')

const difficulties = ['简单', '中等', '困难']
const hotTags = ['快手菜', '下饭', '新手友好', '宴客菜', '家常菜', '减脂', '烘焙', '甜品']

const canSubmit = computed(() => {
  return (
    coverImage.value &&
    recipeName.value.trim() &&
    selectedCategory.value &&
    selectedDifficulty.value &&
    cookingTime.value.trim() &&
    ingredients.value.some(i => i.name.trim()) &&
    steps.value.some(s => s.description.trim())
  )
})

const goBack = () => {
  router.back()
}

const addCover = () => {
  const randomRecipe = recipes.value[Math.floor(Math.random() * recipes.value.length)]
  coverImage.value = randomRecipe.image
}

const removeCover = () => {
  coverImage.value = null
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

const addIngredient = () => {
  ingredients.value.push({ name: '', amount: '' })
}

const removeIngredient = (index) => {
  ingredients.value.splice(index, 1)
}

const addStep = () => {
  steps.value.push({ description: '', image: null })
}

const removeStep = (index) => {
  steps.value.splice(index, 1)
}

const addStepImage = (stepIndex) => {
  const randomRecipe = recipes.value[Math.floor(Math.random() * recipes.value.length)]
  steps.value[stepIndex].image = randomRecipe.image
}

const removeStepImage = (stepIndex) => {
  steps.value[stepIndex].image = null
}

const submitRecipe = () => {
  if (!canSubmit.value) {
    alert('请完善菜谱信息（至少需要封面、名称、分类、难度、时间、至少一个食材和步骤）')
    return
  }
  
  alert('菜谱上传成功！等待审核后即可发布。')
  router.back()
}
</script>

<style scoped>
.form-group {
  margin-bottom: 16px;
}

.category-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}

.category-btn {
  border: 1px solid var(--border-color);
  background-color: var(--bg-primary);
  cursor: pointer;
  transition: all 0.2s;
}

.category-btn.selected {
  border-color: var(--primary-color);
  background-color: rgba(255, 107, 107, 0.05);
}

.upload-cover {
  border: 2px dashed var(--border-color);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.2s;
}

.upload-cover:hover {
  border-color: var(--primary-color);
  color: var(--primary-color);
}

.cover-preview {
  position: relative;
}

.remove-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 32px;
  height: 32px;
  background-color: rgba(0, 0, 0, 0.5);
  border: none;
  border-radius: 50%;
  color: white;
  font-size: 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.selected-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.hot-tags {
  margin-top: 12px;
}

.ingredient-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.step-row {
  margin-bottom: 12px;
}

.step-image-upload {
  display: flex;
  gap: 8px;
  align-items: center;
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

.step-image-preview {
  position: relative;
  border-radius: var(--radius-md);
  overflow: hidden;
}

.page-content {
  padding-bottom: 80px;
}
</style>
