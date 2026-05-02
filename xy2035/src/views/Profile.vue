<template>
  <div class="page">
    <div class="profile-header bg-primary p-6 pb-16">
      <div class="profile-info flex items-center gap-4">
        <img :src="user.avatar" class="profile-avatar w-20 h-20 rounded-full border-4 border-white/30" />
        <div class="text-white">
          <h2 class="text-xl font-bold mb-1">{{ user.name }}</h2>
          <div class="flex items-center gap-2 text-sm opacity-90">
            <span class="bg-white/20 px-2 py-0.5 rounded">Lv.{{ user.level }}</span>
            <span>💎 {{ user.points }} 积分</span>
          </div>
        </div>
      </div>
    </div>

    <div class="page-content">
      <div class="profile-stats card mx-4 -mt-8 p-4">
        <div class="stats-grid grid grid-cols-4 gap-2 text-center">
          <div class="stat-item cursor-pointer" @click="goToFavorites">
            <div class="stat-value text-primary font-bold text-lg">{{ user.favorites }}</div>
            <div class="stat-label text-xs text-secondary">收藏</div>
          </div>
          <div class="stat-item">
            <div class="stat-value text-primary font-bold text-lg">{{ user.posts }}</div>
            <div class="stat-label text-xs text-secondary">动态</div>
          </div>
          <div class="stat-item">
            <div class="stat-value text-primary font-bold text-lg">{{ user.followers }}</div>
            <div class="stat-label text-xs text-secondary">粉丝</div>
          </div>
          <div class="stat-item">
            <div class="stat-value text-primary font-bold text-lg">{{ user.following }}</div>
            <div class="stat-label text-xs text-secondary">关注</div>
          </div>
        </div>
      </div>

      <div class="menu-section mt-4 mx-4">
        <div class="menu-group card p-2 mb-4">
          <div class="menu-item flex items-center justify-between p-3 cursor-pointer" @click="goToHistory">
            <div class="flex items-center gap-3">
              <span class="text-xl">🕐</span>
              <span class="text-base">浏览历史</span>
            </div>
            <span class="text-secondary">→</span>
          </div>
          <div class="h-px bg-border-color mx-3"></div>
          <div class="menu-item flex items-center justify-between p-3 cursor-pointer" @click="goToFavorites">
            <div class="flex items-center gap-3">
              <span class="text-xl">❤️</span>
              <span class="text-base">我的收藏</span>
            </div>
            <span class="text-secondary">→</span>
          </div>
          <div class="h-px bg-border-color mx-3"></div>
          <div class="menu-item flex items-center justify-between p-3 cursor-pointer" @click="goToCoupons">
            <div class="flex items-center gap-3">
              <span class="text-xl">🎫</span>
              <span class="text-base">优惠券</span>
            </div>
            <div class="flex items-center gap-1">
              <span class="tag tag-warning text-xs">{{ availableCouponsCount }}张可用</span>
              <span class="text-secondary">→</span>
            </div>
          </div>
          <div class="h-px bg-border-color mx-3"></div>
          <div class="menu-item flex items-center justify-between p-3 cursor-pointer" @click="goToPoints">
            <div class="flex items-center gap-3">
              <span class="text-xl">💎</span>
              <span class="text-base">积分中心</span>
            </div>
            <div class="flex items-center gap-1">
              <span class="text-primary text-sm font-medium">{{ user.points }}</span>
              <span class="text-secondary">→</span>
            </div>
          </div>
        </div>

        <div class="menu-group card p-2 mb-4">
          <div class="menu-item flex items-center justify-between p-3 cursor-pointer" @click="goToUploadRecipe">
            <div class="flex items-center gap-3">
              <span class="text-xl">📝</span>
              <span class="text-base">上传菜谱</span>
            </div>
            <span class="text-secondary">→</span>
          </div>
          <div class="h-px bg-border-color mx-3"></div>
          <div class="menu-item flex items-center justify-between p-3 cursor-pointer" @click="goToWheel">
            <div class="flex items-center gap-3">
              <span class="text-xl">🎰</span>
              <span class="text-base">转盘抽奖</span>
            </div>
            <span class="text-secondary">→</span>
          </div>
        </div>

        <div class="menu-group card p-2 mb-4">
          <div class="menu-item flex items-center justify-between p-3 cursor-pointer" @click="toggleThemeModal">
            <div class="flex items-center gap-3">
              <span class="text-xl">🎨</span>
              <span class="text-base">主题设置</span>
            </div>
            <div class="flex items-center gap-1">
              <span class="text-secondary text-sm">{{ currentThemeName }}</span>
              <span class="text-secondary">→</span>
            </div>
          </div>
          <div class="h-px bg-border-color mx-3"></div>
          <div class="menu-item flex items-center justify-between p-3 cursor-pointer">
            <div class="flex items-center gap-3">
              <span class="text-xl">🔔</span>
              <span class="text-base">消息通知</span>
            </div>
            <span class="text-secondary">→</span>
          </div>
          <div class="h-px bg-border-color mx-3"></div>
          <div class="menu-item flex items-center justify-between p-3 cursor-pointer">
            <div class="flex items-center gap-3">
              <span class="text-xl">⚙️</span>
              <span class="text-base">设置</span>
            </div>
            <span class="text-secondary">→</span>
          </div>
        </div>

        <div class="menu-group card p-2 mb-4">
          <div class="menu-item flex items-center justify-between p-3 cursor-pointer">
            <div class="flex items-center gap-3">
              <span class="text-xl">❓</span>
              <span class="text-base">帮助与反馈</span>
            </div>
            <span class="text-secondary">→</span>
          </div>
          <div class="h-px bg-border-color mx-3"></div>
          <div class="menu-item flex items-center justify-between p-3 cursor-pointer">
            <div class="flex items-center gap-3">
              <span class="text-xl">ℹ️</span>
              <span class="text-base">关于我们</span>
            </div>
            <span class="text-secondary">→</span>
          </div>
        </div>
      </div>

      <div class="p-4"></div>
    </div>

    <TabBar />

    <div v-if="showThemeModal" class="modal-mask" @click="showThemeModal = false">
      <div class="modal-content p-4" @click.stop>
        <h3 class="text-lg font-bold mb-4 text-center">选择主题</h3>
        <div class="theme-list">
          <div 
            v-for="theme in availableThemes" 
            :key="theme.id"
            class="theme-item flex items-center justify-between p-3 rounded-lg mb-2 cursor-pointer"
            :class="{ selected: theme.id === currentTheme.id }"
            @click="selectTheme(theme.id)"
          >
            <div class="flex items-center gap-3">
              <div 
                class="theme-preview w-10 h-10 rounded-full border-2"
                :style="{ backgroundColor: theme.bgColor, borderColor: theme.primaryColor }"
              >
              </div>
              <span class="text-base">{{ theme.name }}</span>
            </div>
            <span v-if="theme.id === currentTheme.id" class="text-primary">✓</span>
          </div>
        </div>
        <button class="btn btn-primary w-full mt-4" @click="showThemeModal = false">
          确定
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/userStore'
import { coupons } from '@/data/mockData'
import TabBar from '@/components/TabBar.vue'

const router = useRouter()
const userStore = useUserStore()

const user = computed(() => userStore.user)
const currentTheme = computed(() => userStore.theme)
const availableThemes = computed(() => userStore.availableThemes)

const showThemeModal = ref(false)

const availableCouponsCount = computed(() => {
  return coupons.value.filter(c => c.status === 'available').length
})

const currentThemeName = computed(() => {
  const theme = availableThemes.value.find(t => t.id === currentTheme.value.id)
  return theme?.name || '浅色模式'
})

const goToFavorites = () => {
  router.push('/favorites')
}

const goToHistory = () => {
  router.push('/history')
}

const goToCoupons = () => {
  router.push('/coupons')
}

const goToPoints = () => {
  router.push('/points')
}

const goToUploadRecipe = () => {
  router.push('/upload-recipe')
}

const goToWheel = () => {
  router.push('/wheel')
}

const toggleThemeModal = () => {
  showThemeModal.value = !showThemeModal.value
}

const selectTheme = (themeId) => {
  userStore.setTheme(themeId)
}
</script>

<style scoped>
.profile-header {
  background: linear-gradient(135deg, var(--primary-color), var(--primary-light));
  padding-top: calc(24px + env(safe-area-inset-top));
}

.profile-avatar {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  border: 4px solid rgba(255, 255, 255, 0.3);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}

.menu-group {
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.menu-item {
  padding: 12px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.menu-item:active {
  background-color: var(--bg-secondary);
}

.theme-item {
  border: 2px solid transparent;
  transition: all 0.2s;
}

.theme-item.selected {
  border-color: var(--primary-color);
  background-color: rgba(255, 107, 107, 0.05);
}

.theme-preview {
  width: 40px;
  height: 40px;
  border-radius: 50%;
}

.page-content {
  padding-bottom: 80px;
}
</style>
