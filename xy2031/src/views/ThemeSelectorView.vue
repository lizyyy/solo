<template>
  <div class="theme-selector-view pb-20 min-h-screen bg-gray-50">
    <!-- 顶部导航 -->
    <div class="sticky top-0 bg-white z-10 px-4 py-3 shadow-sm">
      <div class="flex items-center">
        <button @click="goBack" class="p-1">
          <ChevronLeft class="w-6 h-6" />
        </button>
        <h1 class="text-lg font-bold flex-1 text-center">主题选择</h1>
        <div class="w-8"></div>
      </div>
    </div>

    <!-- 主题介绍 -->
    <div class="bg-white px-4 py-4 mt-3">
      <h2 class="font-bold text-lg mb-2">选择您喜欢的主题</h2>
      <p class="text-sm text-gray-500">为您精选全国五大旅游城市主题，每款都融入了独特的城市特色元素</p>
    </div>

    <!-- 主题列表 -->
    <div class="px-4 py-4 space-y-4">
      <div 
        v-for="theme in themeList" 
        :key="theme.id"
        class="bg-white rounded-2xl overflow-hidden shadow-sm cursor-pointer"
        @click="selectTheme(theme.id)"
      >
        <!-- 主题封面 -->
        <div 
          class="relative h-40 overflow-hidden"
          :style="{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})` }"
        >
          <img 
            v-if="theme.image"
            :src="theme.image" 
            :alt="theme.name"
            class="w-full h-full object-cover opacity-40"
          />
          <div class="absolute inset-0 flex flex-col items-center justify-center">
            <span class="text-6xl mb-2">{{ theme.icon }}</span>
            <h3 class="text-xl font-bold text-white">{{ theme.name }}</h3>
            <p class="text-white/80 text-sm mt-1">{{ theme.description }}</p>
          </div>
          
          <!-- 已选中标记 -->
          <div 
            v-if="currentThemeId === theme.id"
            class="absolute top-3 right-3 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-lg"
          >
            <Check class="w-5 h-5 text-green-500" />
          </div>
        </div>

        <!-- 主题信息 -->
        <div class="p-4">
          <div class="flex items-center justify-between">
            <div>
              <h4 class="font-bold">{{ theme.name }}</h4>
              <p class="text-xs text-gray-500 mt-1">{{ theme.description }}</p>
            </div>
            <button 
              class="px-4 py-2 rounded-full text-sm font-medium transition-all"
              :class="currentThemeId === theme.id 
                ? 'bg-green-100 text-green-600' 
                : 'bg-blue-500 text-white'"
              @click.stop="selectTheme(theme.id)"
            >
              {{ currentThemeId === theme.id ? '使用中' : '使用主题' }}
            </button>
          </div>

          <!-- 配色展示 -->
          <div class="mt-4">
            <p class="text-xs text-gray-500 mb-2">主题配色</p>
            <div class="flex gap-2">
              <div class="flex items-center gap-1">
                <div 
                  class="w-6 h-6 rounded"
                  :style="{ backgroundColor: theme.primary }"
                ></div>
                <span class="text-xs text-gray-500">主色</span>
              </div>
              <div class="flex items-center gap-1">
                <div 
                  class="w-6 h-6 rounded"
                  :style="{ backgroundColor: theme.secondary }"
                ></div>
                <span class="text-xs text-gray-500">次色</span>
              </div>
              <div class="flex items-center gap-1">
                <div 
                  class="w-6 h-6 rounded"
                  :style="{ backgroundColor: theme.accent }"
                ></div>
                <span class="text-xs text-gray-500">强调</span>
              </div>
              <div class="flex items-center gap-1">
                <div 
                  class="w-6 h-6 rounded border border-gray-200"
                  :style="{ backgroundColor: theme.bg }"
                ></div>
                <span class="text-xs text-gray-500">背景</span>
              </div>
            </div>
          </div>

          <!-- 景点元素 -->
          <div v-if="theme.landmark" class="mt-4 pt-4 border-t">
            <p class="text-xs text-gray-500 mb-2">景点元素</p>
            <div class="flex items-center gap-2">
              <div 
                class="w-10 h-10 rounded-full flex items-center justify-center"
                :style="{ backgroundColor: theme.primary + '15' }"
              >
                <MapPin class="w-5 h-5" :style="{ color: theme.primary }" />
              </div>
              <div>
                <p class="text-sm font-medium">{{ theme.landmark }}</p>
                <p class="text-xs text-gray-500">标志性景点</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 使用提示 -->
    <div class="px-4 py-6">
      <div class="bg-blue-50 rounded-xl p-4">
        <h4 class="font-medium text-blue-800 mb-2">💡 使用提示</h4>
        <ul class="text-sm text-blue-700 space-y-1">
          <li>• 主题切换后，应用内所有界面配色将同步更新</li>
          <li>• 每款主题都融入了独特的城市文化元素</li>
          <li>• 主题选择会自动保存，下次打开应用保持不变</li>
        </ul>
      </div>
    </div>

    <!-- 提示消息 -->
    <div 
      v-if="toast.show" 
      class="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/75 text-white px-6 py-3 rounded-lg text-sm z-50"
    >
      {{ toast.message }}
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ChevronLeft, Check, MapPin } from 'lucide-vue-next'
import { useThemeStore } from '@/stores/theme'

const router = useRouter()
const themeStore = useThemeStore()

const currentThemeId = computed(() => themeStore.currentThemeId)
const themeList = computed(() => themeStore.themeList)

const toast = ref({ show: false, message: '' })

function goBack() {
  router.back()
}

function selectTheme(themeId) {
  themeStore.setTheme(themeId)
  showToast(`已切换为${themeStore.currentTheme.name}`)
}

function showToast(message) {
  toast.value = { show: true, message }
  setTimeout(() => {
    toast.value.show = false
  }, 2000)
}
</script>
