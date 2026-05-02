<template>
  <div class="city-selector-view pb-20 bg-gray-50 min-h-screen">
    <!-- 顶部导航 -->
    <div class="sticky top-0 bg-white z-10 px-4 py-3 shadow-sm">
      <div class="flex items-center gap-3">
        <button @click="goBack" class="p-1">
          <ChevronLeft class="w-6 h-6 text-gray-700" />
        </button>
        <h1 class="text-lg font-bold">选择城市</h1>
      </div>
      
      <!-- 搜索框 -->
      <div class="mt-3 relative">
        <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input 
          type="text" 
          v-model="searchKeyword"
          placeholder="搜索城市、景点..."
          class="w-full pl-10 pr-4 py-2.5 bg-gray-50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          @input="handleSearch"
        />
      </div>
    </div>

    <!-- 搜索结果 -->
    <div v-if="searchResults.length > 0" class="bg-white mt-2">
      <div 
        v-for="result in searchResults" 
        :key="result.id"
        class="flex items-center gap-3 px-4 py-3 border-b border-gray-50 cursor-pointer"
        @click="handleSearchResultClick(result)"
      >
        <div 
          class="w-10 h-10 rounded-full flex items-center justify-center"
          :class="result.type === 'province' ? 'bg-blue-100' : result.type === 'landmark' ? 'bg-green-100' : 'bg-orange-100'"
        >
          <MapPin 
            class="w-5 h-5" 
            :class="result.type === 'province' ? 'text-blue-500' : result.type === 'landmark' ? 'text-green-500' : 'text-orange-500'"
          />
        </div>
        <div class="flex-1">
          <p class="font-medium text-sm">{{ result.name }}</p>
          <p class="text-xs text-gray-500">
            {{ result.type === 'province' ? '省份' : result.type === 'landmark' ? '景点' : '城市' }}
            <span v-if="result.province"> · {{ result.province.name }}</span>
          </p>
        </div>
        <ChevronRight class="w-5 h-5 text-gray-400" />
      </div>
    </div>

    <!-- 省份列表 -->
    <div v-else class="mt-2">
      <div 
        v-for="province in PROVINCES" 
        :key="province.id"
        class="bg-white mb-2"
      >
        <!-- 省份标题 -->
        <div 
          class="flex items-center justify-between px-4 py-3 cursor-pointer"
          @click="toggleProvince(province.id)"
        >
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
              <MapPin class="w-4 h-4 text-blue-500" />
            </div>
            <div>
              <h3 class="font-medium text-sm">{{ province.name }}</h3>
              <p class="text-xs text-gray-500">{{ province.cities.length }}个城市</p>
            </div>
          </div>
          <ChevronRight 
            class="w-5 h-5 text-gray-400 transition-transform"
            :class="{ 'rotate-90': expandedProvinces.includes(province.id) }"
          />
        </div>

        <!-- 城市列表 -->
        <div 
          v-if="expandedProvinces.includes(province.id)"
          class="bg-gray-50"
        >
          <div 
            v-for="city in province.cities" 
            :key="city.id"
            class="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-100"
            @click="goToCity(city.id)"
          >
            <img 
              :src="city.image" 
              :alt="city.name"
              class="w-16 h-12 rounded-lg object-cover"
            />
            <div class="flex-1">
              <h4 class="font-medium text-sm">{{ city.name }}</h4>
              <p class="text-xs text-gray-500 line-clamp-1">{{ city.description }}</p>
              <div class="flex items-center gap-2 mt-1">
                <span class="text-xs text-blue-500 bg-blue-50 px-2 py-0.5 rounded">
                  {{ city.landmarks.length }}个景点
                </span>
                <span class="text-xs text-orange-500 bg-orange-50 px-2 py-0.5 rounded">
                  {{ city.featuredProducts?.length || 0 }}款文创
                </span>
              </div>
            </div>
            <ChevronRight class="w-5 h-5 text-gray-400" />
          </div>
        </div>
      </div>
    </div>

    <!-- 热门城市快捷入口 -->
    <div v-if="!searchKeyword" class="fixed top-0 right-0 bottom-20 flex flex-col justify-center z-20" :style="{ maxWidth: '480px', margin: '0 auto' }">
      <div class="bg-white/90 backdrop-blur rounded-l-lg py-2 px-1 mr-1">
        <div 
          v-for="province in PROVINCES" 
          :key="province.shortName"
          class="text-xs text-gray-600 py-1 px-2 cursor-pointer hover:text-blue-500"
          @click="scrollToProvince(province.id)"
        >
          {{ province.shortName }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { 
  Search, 
  MapPin, 
  ChevronRight, 
  ChevronLeft 
} from 'lucide-vue-next'
import { PROVINCES, searchCities } from '@/data/cities'

const router = useRouter()
const searchKeyword = ref('')
const expandedProvinces = ref(['prov_001'])
const searchResults = ref([])

function goBack() {
  router.back()
}

function toggleProvince(provinceId) {
  const index = expandedProvinces.value.indexOf(provinceId)
  if (index === -1) {
    expandedProvinces.value.push(provinceId)
  } else {
    expandedProvinces.value.splice(index, 1)
  }
}

function handleSearch() {
  if (searchKeyword.value.trim()) {
    searchResults.value = searchCities(searchKeyword.value)
  } else {
    searchResults.value = []
  }
}

function handleSearchResultClick(result) {
  if (result.type === 'city') {
    router.push(`/city/${result.id}`)
  } else if (result.type === 'province') {
    toggleProvince(result.id)
    searchKeyword.value = ''
  } else if (result.type === 'landmark') {
    router.push(`/city/${result.city.id}`)
  }
}

function goToCity(cityId) {
  router.push(`/city/${cityId}`)
}

function scrollToProvince(provinceId) {
  const element = document.querySelector(`[data-province-id="${provinceId}"]`)
  if (element) {
    element.scrollIntoView({ behavior: 'smooth' })
  }
}
</script>
