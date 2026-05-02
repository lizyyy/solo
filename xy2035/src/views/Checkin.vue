<template>
  <div class="page">
    <div class="header">
      <h1 class="header-title">每日打卡</h1>
      <div class="header-placeholder"></div>
    </div>

    <div class="page-content">
      <div class="checkin-stats p-4 bg-white">
        <div class="stats-grid grid grid-cols-3 gap-4 text-center">
          <div class="stat-item">
            <div class="stat-value text-primary font-bold text-2xl">{{ currentStreak }}</div>
            <div class="stat-label text-sm text-secondary">连续打卡</div>
          </div>
          <div class="stat-item">
            <div class="stat-value text-primary font-bold text-2xl">{{ totalCheckins }}</div>
            <div class="stat-label text-sm text-secondary">累计打卡</div>
          </div>
          <div class="stat-item">
            <div class="stat-value text-primary font-bold text-2xl">{{ monthlyCheckins.length }}</div>
            <div class="stat-label text-sm text-secondary">本月打卡</div>
          </div>
        </div>
      </div>

      <div class="calendar-section p-4 bg-white mt-2">
        <div class="calendar-header flex items-center justify-between mb-4">
          <button class="calendar-nav-btn" @click="prevMonth">
            ◀
          </button>
          <h2 class="calendar-title text-lg font-bold">
            {{ currentYear }}年{{ currentMonth }}月
          </h2>
          <button class="calendar-nav-btn" @click="nextMonth">
            ▶
          </button>
        </div>

        <div class="calendar-weekdays grid grid-cols-7 gap-1 mb-2">
          <div 
            v-for="day in weekdays" 
            :key="day"
            class="weekday text-center text-sm text-secondary py-2"
          >
            {{ day }}
          </div>
        </div>

        <div class="calendar-days grid grid-cols-7 gap-1">
          <div 
            v-for="(day, idx) in calendarDays" 
            :key="idx"
            class="calendar-day flex flex-col items-center justify-center py-2 cursor-pointer rounded-lg transition-all"
            :class="{
              'empty': !day.day,
              'today': day.isToday,
              'checked': day.isChecked,
              'selected': selectedDate === day.date
            }"
            @click="selectDate(day)"
          >
            <span v-if="day.day" class="day-number text-sm">{{ day.day }}</span>
            <span v-if="day.isChecked" class="day-marker mt-1">✅</span>
            <span v-if="day.isToday && !day.isChecked" class="day-marker mt-1 text-xs text-primary">今日</span>
          </div>
        </div>
      </div>

      <div v-if="selectedCheckin" class="selected-checkin p-4 bg-white mt-2">
        <h3 class="section-title text-base font-bold mb-3">
          📝 {{ selectedDate }} 打卡记录
        </h3>
        
        <div class="checkin-detail card p-4">
          <div class="checkin-recipe flex items-center gap-3 mb-3" @click="goToRecipe(selectedCheckin.recipeId)">
            <div class="recipe-image w-20 h-20 rounded-lg overflow-hidden flex-shrink-0">
              <img :src="selectedCheckin.recipeImage" class="w-full h-full object-cover" />
            </div>
            <div class="flex-1 min-w-0">
              <h4 class="font-medium text-base ellipsis">{{ selectedCheckin.recipeTitle }}</h4>
              <div class="flex items-center gap-3 text-sm text-secondary mt-1">
                <span>🔥 {{ selectedCheckin.calories }} 卡路里</span>
                <span>⏱️ {{ selectedCheckin.duration }} 分钟</span>
              </div>
            </div>
          </div>
          
          <div class="checkin-note mb-3" v-if="selectedCheckin.note">
            <div class="text-sm text-secondary mb-1">打卡心得：</div>
            <p class="text-sm">{{ selectedCheckin.note }}</p>
          </div>
          
          <div class="checkin-images flex gap-2" v-if="selectedCheckin.images?.length">
            <div 
              v-for="(img, idx) in selectedCheckin.images" 
              :key="idx"
              class="checkin-image w-24 h-24 rounded-lg overflow-hidden"
            >
              <img :src="img" class="w-full h-full object-cover" />
            </div>
          </div>
        </div>
      </div>

      <div v-if="!isTodayChecked" class="checkin-action p-4 bg-white mt-2">
        <h3 class="section-title text-base font-bold mb-3">
          ✨ 选择今天做的菜进行打卡
        </h3>
        
        <div class="recipe-select-list">
          <div 
            v-for="recipe in recentRecipes" 
            :key="recipe.id"
            class="recipe-select-item card card-hover flex items-center gap-3 p-3 mb-3 cursor-pointer"
            @click="selectRecipeForCheckin(recipe)"
          >
            <div class="recipe-select-image w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
              <img :src="recipe.image" class="w-full h-full object-cover" />
            </div>
            <div class="flex-1 min-w-0">
              <h4 class="font-medium ellipsis">{{ recipe.title }}</h4>
              <div class="flex items-center gap-3 text-xs text-secondary mt-1">
                <span>⭐ {{ recipe.rating }}</span>
                <span>⏱️ {{ recipe.time }}</span>
                <span>🔥 {{ recipe.calories }}卡</span>
              </div>
            </div>
            <div class="text-primary text-lg">→</div>
          </div>
        </div>

        <div class="or-divider flex items-center my-4">
          <span class="flex-1 h-px bg-border-color"></span>
          <span class="px-4 text-sm text-secondary">或者</span>
          <span class="flex-1 h-px bg-border-color"></span>
        </div>

        <button class="btn btn-outline w-full" @click="goToCategory">
          浏览更多菜谱
        </button>
      </div>

      <div class="checkin-history p-4 mt-2">
        <h3 class="section-title text-base font-bold mb-3">
          📚 打卡历史
        </h3>
        
        <div v-if="checkinHistory.length === 0" class="empty-state py-8">
          <div class="empty-icon">📅</div>
          <p>还没有打卡记录</p>
          <p class="text-sm text-secondary mt-1">选择一道菜开始今天的打卡吧</p>
        </div>
        
        <div v-else class="history-list">
          <div 
            v-for="record in checkinHistory" 
            :key="record.id"
            class="history-item card p-4 mb-3 cursor-pointer"
            @click="selectDateByRecord(record)"
          >
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center gap-2">
                <span class="text-xl">✅</span>
                <span class="font-medium">{{ record.recipeTitle }}</span>
              </div>
              <span class="text-sm text-secondary">{{ record.date }}</span>
            </div>
            <div class="flex items-center gap-4 text-xs text-secondary" v-if="record.note">
              <span class="ellipsis-2">{{ record.note }}</span>
            </div>
            <div class="flex items-center gap-3 text-xs text-secondary mt-2">
              <span>🔥 {{ record.calories }}卡</span>
              <span>⏱️ {{ record.duration }}分钟</span>
            </div>
          </div>
        </div>
      </div>

      <div class="p-4"></div>
    </div>

    <TabBar />

    <div v-if="showCheckinModal && selectedRecipe" class="modal-mask" @click="showCheckinModal = false">
      <div class="modal-content p-4" @click.stop>
        <h3 class="text-lg font-bold mb-4 text-center">完成打卡</h3>
        
        <div class="selected-recipe-preview flex items-center gap-3 p-3 bg-secondary/10 rounded-lg mb-4">
          <div class="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
            <img :src="selectedRecipe.image" class="w-full h-full object-cover" />
          </div>
          <div class="flex-1 min-w-0">
            <h4 class="font-medium ellipsis">{{ selectedRecipe.title }}</h4>
            <div class="flex items-center gap-3 text-xs text-secondary mt-1">
              <span>⭐ {{ selectedRecipe.rating }}</span>
              <span>⏱️ {{ selectedRecipe.time }}</span>
            </div>
          </div>
        </div>

        <div class="form-group mb-4">
          <label class="block text-sm font-medium mb-2">打卡心得（可选）</label>
          <textarea 
            v-model="checkinNote"
            class="input textarea"
            placeholder="分享一下今天做菜的感受..."
            rows="3"
          ></textarea>
        </div>

        <div class="form-group mb-4">
          <label class="block text-sm font-medium mb-2">上传照片（可选）</label>
          <div class="upload-area flex gap-3 flex-wrap">
            <div 
              v-for="(img, idx) in checkinImages" 
              :key="idx"
              class="uploaded-image w-20 h-20 rounded-lg overflow-hidden relative"
            >
              <img :src="img" class="w-full h-full object-cover" />
              <button class="remove-btn absolute top-1 right-1 w-5 h-5 bg-black/50 rounded-full text-white text-xs" @click="removeImage(idx)">
                ×
              </button>
            </div>
            <button 
              v-if="checkinImages.length < 3"
              class="upload-btn w-20 h-20 border-2 border-dashed border-secondary/30 rounded-lg flex flex-col items-center justify-center text-secondary"
              @click="addImage"
            >
              <span class="text-2xl">+</span>
              <span class="text-xs mt-1">添加</span>
            </button>
          </div>
        </div>

        <div class="flex gap-3">
          <button class="btn btn-outline flex-1" @click="showCheckinModal = false">
            取消
          </button>
          <button class="btn btn-primary flex-1" @click="submitCheckin">
            确认打卡
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/userStore'
import { checkinRecords, recipes, getMonthlyCheckinCounts } from '@/data/mockData'
import TabBar from '@/components/TabBar.vue'

const router = useRouter()
const userStore = useUserStore()

const today = new Date()
const currentYear = ref(today.getFullYear())
const currentMonth = ref(today.getMonth() + 1)
const selectedDate = ref(null)
const selectedRecipe = ref(null)
const showCheckinModal = ref(false)
const checkinNote = ref('')
const checkinImages = ref([])

const weekdays = ['日', '一', '二', '三', '四', '五', '六']

const checkinHistory = computed(() => checkinRecords.value)

const totalCheckins = computed(() => checkinRecords.value.length)

const monthlyCheckins = computed(() => {
  return getMonthlyCheckinCounts(currentYear.value, currentMonth.value)
})

const currentStreak = computed(() => {
  let streak = 0
  const todayStr = formatDate(today)
  const sortedRecords = [...checkinRecords.value].sort((a, b) => new Date(b.date) - new Date(a.date))
  
  for (let i = 0; i < sortedRecords.length; i++) {
    const recordDate = new Date(sortedRecords[i].date)
    const expectedDate = new Date(today)
    expectedDate.setDate(expectedDate.getDate() - i)
    const expectedStr = formatDate(expectedDate)
    
    if (sortedRecords[i].date === expectedStr) {
      streak++
    } else {
      break
    }
  }
  
  return streak
})

const todayStr = computed(() => formatDate(today))

const isTodayChecked = computed(() => {
  return checkinRecords.value.some(r => r.date === todayStr.value)
})

const selectedCheckin = computed(() => {
  if (!selectedDate.value) return null
  return checkinRecords.value.find(r => r.date === selectedDate.value)
})

const recentRecipes = computed(() => {
  return recipes.value.slice(0, 5)
})

const calendarDays = computed(() => {
  const days = []
  const firstDay = new Date(currentYear.value, currentMonth.value - 1, 1)
  const lastDay = new Date(currentYear.value, currentMonth.value, 0)
  const startDay = firstDay.getDay()
  const totalDays = lastDay.getDate()
  
  for (let i = 0; i < startDay; i++) {
    days.push({ day: null, date: null, isToday: false, isChecked: false })
  }
  
  for (let i = 1; i <= totalDays; i++) {
    const date = new Date(currentYear.value, currentMonth.value - 1, i)
    const dateStr = formatDate(date)
    const isToday = dateStr === todayStr.value
    const isChecked = monthlyCheckins.value.includes(dateStr)
    
    days.push({
      day: i,
      date: dateStr,
      isToday,
      isChecked
    })
  }
  
  return days
})

function formatDate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function prevMonth() {
  if (currentMonth.value === 1) {
    currentMonth.value = 12
    currentYear.value--
  } else {
    currentMonth.value--
  }
  selectedDate.value = null
}

function nextMonth() {
  if (currentMonth.value === 12) {
    currentMonth.value = 1
    currentYear.value++
  } else {
    currentMonth.value++
  }
  selectedDate.value = null
}

function selectDate(day) {
  if (!day.day) return
  selectedDate.value = day.date
}

function selectDateByRecord(record) {
  const date = new Date(record.date)
  currentYear.value = date.getFullYear()
  currentMonth.value = date.getMonth() + 1
  selectedDate.value = record.date
}

function selectRecipeForCheckin(recipe) {
  if (isTodayChecked.value) {
    alert('今日已打卡')
    return
  }
  selectedRecipe.value = recipe
  checkinNote.value = ''
  checkinImages.value = []
  showCheckinModal.value = true
}

function addImage() {
  if (checkinImages.value.length >= 3) return
  const randomRecipe = recipes.value[Math.floor(Math.random() * recipes.value.length)]
  checkinImages.value.push(randomRecipe.image)
}

function removeImage(index) {
  checkinImages.value.splice(index, 1)
}

function submitCheckin() {
  if (!selectedRecipe.value) return
  
  userStore.addNewCheckin(
    selectedRecipe.value.id,
    checkinNote.value,
    [...checkinImages.value]
  )
  
  showCheckinModal.value = false
  selectedRecipe.value = null
  checkinNote.value = ''
  checkinImages.value = []
  
  alert('打卡成功！')
}

function goToCategory() {
  router.push('/category')
}

function goToRecipe(recipeId) {
  router.push(`/recipe/${recipeId}`)
}

onMounted(() => {
  const todayCheckin = checkinRecords.value.find(r => r.date === todayStr.value)
  if (todayCheckin) {
    selectedDate.value = todayStr.value
  }
})
</script>

<style scoped>
.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.calendar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.calendar-nav-btn {
  width: 32px;
  height: 32px;
  background: none;
  border: none;
  font-size: 16px;
  cursor: pointer;
  color: var(--text-secondary);
}

.calendar-weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
}

.weekday {
  padding: 8px 0;
  color: var(--text-secondary);
  font-size: 13px;
}

.calendar-days {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
}

.calendar-day {
  padding: 8px 0;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.2s;
}

.calendar-day.empty {
  cursor: default;
}

.calendar-day.today {
  background-color: rgba(255, 107, 107, 0.1);
}

.calendar-day.checked {
  background-color: rgba(107, 203, 119, 0.1);
}

.calendar-day.selected {
  background-color: var(--primary-color);
  color: white;
}

.calendar-day.selected .day-number {
  color: white;
}

.day-number {
  font-size: 14px;
  color: var(--text-primary);
}

.day-marker {
  font-size: 10px;
}

.section-title {
  color: var(--text-primary);
}

.or-divider {
  display: flex;
  align-items: center;
}

.or-divider span:first-child,
.or-divider span:last-child {
  flex: 1;
  height: 1px;
  background-color: var(--border-color);
}

.or-divider span:nth-child(2) {
  padding: 0 16px;
  color: var(--text-light);
  font-size: 13px;
}

.upload-area {
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
  width: 20px;
  height: 20px;
  background-color: rgba(0, 0, 0, 0.5);
  border: none;
  border-radius: 50%;
  color: white;
  font-size: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.page-content {
  padding-bottom: 80px;
}
</style>
