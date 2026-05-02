<template>
  <div class="home-view pb-20">
    <!-- 搜索栏 -->
    <div class="sticky top-0 bg-white z-10 px-4 py-3 shadow-sm">
      <div class="flex items-center gap-3">
        <div class="flex-1 relative">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input 
            type="text" 
            v-model="searchKeyword"
            placeholder="搜索城市、景点、文创产品..."
            class="w-full pl-10 pr-4 py-2.5 bg-gray-50 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            @keyup.enter="handleSearch"
          />
        </div>
        <button class="p-2" @click="handleSearch">
          <Search class="w-6 h-6 text-blue-500" />
        </button>
      </div>
    </div>

    <!-- 轮播横幅 -->
    <div class="relative overflow-hidden">
      <div 
        class="flex transition-transform duration-500" 
        :style="{ transform: `translateX(-${currentSlide * 100}%)` }"
      >
        <div 
          v-for="(banner, index) in banners" 
          :key="index"
          class="w-full flex-shrink-0"
        >
          <div class="relative h-48">
            <img 
              :src="banner.image" 
              :alt="banner.title"
              class="w-full h-full object-cover"
            />
            <div class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4">
              <h3 class="text-white font-bold text-lg">{{ banner.title }}</h3>
              <p class="text-white/80 text-sm mt-1">{{ banner.subtitle }}</p>
            </div>
          </div>
        </div>
      </div>
      <div class="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
        <div 
          v-for="(_, index) in banners" 
          :key="index"
          class="w-2 h-2 rounded-full transition-all"
          :class="currentSlide === index ? 'bg-white w-4' : 'bg-white/50'"
        ></div>
      </div>
    </div>

    <!-- 快捷入口 -->
    <div class="grid grid-cols-4 gap-4 p-4 bg-white">
      <router-link 
        v-for="shortcut in shortcuts" 
        :key="shortcut.path"
        :to="shortcut.path"
        class="flex flex-col items-center gap-2"
      >
        <div 
          class="w-12 h-12 rounded-full flex items-center justify-center"
          :style="{ backgroundColor: shortcut.bgColor }"
        >
          <component :is="shortcut.icon" class="w-6 h-6" :style="{ color: shortcut.color }" />
        </div>
        <span class="text-xs text-gray-700">{{ shortcut.label }}</span>
      </router-link>
    </div>

    <!-- 热门城市 -->
    <div class="mt-4 bg-white p-4">
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-lg font-bold flex items-center gap-2">
          <MapPin class="w-5 h-5 text-blue-500" />
          热门城市
        </h2>
        <router-link to="/cities" class="text-sm text-blue-500 flex items-center gap-1">
          查看更多 <ChevronRight class="w-4 h-4" />
        </router-link>
      </div>
      <div class="grid grid-cols-3 gap-3">
        <div 
          v-for="city in hotCities" 
          :key="city.id"
          class="relative rounded-lg overflow-hidden cursor-pointer"
          @click="goToCity(city.id)"
        >
          <img 
            :src="city.image" 
            :alt="city.name"
            class="w-full h-24 object-cover"
          />
          <div class="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
          <div class="absolute bottom-2 left-2">
            <p class="text-white font-medium text-sm">{{ city.name }}</p>
            <p class="text-white/80 text-xs">{{ city.landmarks.length }}个景点</p>
          </div>
        </div>
      </div>
    </div>

    <!-- 热销文创 -->
    <div class="mt-4 bg-white p-4">
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-lg font-bold flex items-center gap-2">
          <Star class="w-5 h-5 text-yellow-500" />
          热销文创
        </h2>
        <router-link to="/shop" class="text-sm text-blue-500 flex items-center gap-1">
          更多好物 <ChevronRight class="w-4 h-4" />
        </router-link>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div 
          v-for="product in hotProducts" 
          :key="product.id"
          class="bg-white rounded-lg shadow-sm overflow-hidden cursor-pointer border border-gray-100"
          @click="goToProduct(product.id)"
        >
          <div class="relative">
            <img 
              :src="product.images?.[0] || product.image" 
              :alt="product.name"
              class="w-full h-32 object-cover"
            />
            <div v-if="product.tags.includes('热销')" class="absolute top-2 left-2 bg-red-500 text-white text-xs px-2 py-0.5 rounded">
              热销
            </div>
          </div>
          <div class="p-3">
            <h3 class="text-sm font-medium text-gray-800 line-clamp-2">{{ product.name }}</h3>
            <p class="text-xs text-gray-500 mt-1">{{ product.cityName }}</p>
            <div class="flex items-center justify-between mt-2">
              <div class="flex items-baseline gap-1">
                <span class="text-red-500 font-bold text-base">¥{{ product.discountPrice || product.price }}</span>
                <span v-if="product.discountPrice" class="text-gray-400 text-xs line-through">¥{{ product.price }}</span>
              </div>
              <span class="text-xs text-gray-400">已售{{ product.sales }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 精选帖子 -->
    <div class="mt-4 bg-white p-4 mb-4">
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-lg font-bold flex items-center gap-2">
          <MessageCircle class="w-5 h-5 text-purple-500" />
          精选分享
        </h2>
        <router-link to="/community" class="text-sm text-blue-500 flex items-center gap-1">
          更多内容 <ChevronRight class="w-4 h-4" />
        </router-link>
      </div>
      <div class="space-y-4">
        <div 
          v-for="post in featuredPosts.slice(0, 3)" 
          :key="post.id"
          class="cursor-pointer"
          @click="goToPost(post.id)"
        >
          <div class="flex items-center gap-3 mb-2">
            <img 
              :src="post.avatar" 
              :alt="post.username"
              class="w-10 h-10 rounded-full object-cover"
            />
            <div>
              <p class="font-medium text-sm">{{ post.username }}</p>
              <p class="text-xs text-gray-500">{{ post.location.city }} · {{ formatDate(post.createdAt) }}</p>
            </div>
          </div>
          <h3 class="font-medium text-gray-800 mb-2">{{ post.title }}</h3>
          <p class="text-sm text-gray-600 line-clamp-2">{{ post.content }}</p>
          <div v-if="post.images && post.images.length > 0" class="flex gap-2 mt-2">
            <img 
              v-for="(img, idx) in post.images.slice(0, 3)" 
              :key="idx"
              :src="img"
              class="w-20 h-20 rounded-lg object-cover"
            />
          </div>
          <div class="flex items-center gap-6 mt-3 text-gray-500 text-xs">
            <span class="flex items-center gap-1">
              <Heart class="w-4 h-4" />
              {{ post.likes }}
            </span>
            <span class="flex items-center gap-1">
              <MessageCircle class="w-4 h-4" />
              {{ post.comments.length }}
            </span>
            <span class="flex items-center gap-1">
              <Share2 class="w-4 h-4" />
              {{ post.shares }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { 
  Search, 
  MapPin, 
  Star, 
  MessageCircle, 
  Heart, 
  Share2,
  ChevronRight,
  Sparkles,
  Palette,
  Ticket,
  Compass,
  Gift,
  Camera
} from 'lucide-vue-next'
import { PROVINCES } from '@/data/cities'
import { PRODUCTS } from '@/data/products'
import { POSTS } from '@/data/posts'

const router = useRouter()
const searchKeyword = ref('')
const currentSlide = ref(0)
let slideTimer = null

const banners = [
  {
    id: 1,
    image: 'https://images.unsplash.com/photo-1508804185872-d7badad00f7d?w=800',
    title: '探索故宫文创',
    subtitle: '发现皇家文化的现代演绎'
  },
  {
    id: 2,
    image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800',
    title: '大理风花雪月',
    subtitle: '定制专属于你的旅行记忆'
  },
  {
    id: 3,
    image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800',
    title: '新疆赛里木湖',
    subtitle: '西域风光的文创体验'
  }
]

const shortcuts = [
  {
    path: '/customize',
    label: '文创定制',
    icon: Palette,
    bgColor: '#FEF3C7',
    color: '#D97706'
  },
  {
    path: '/cities',
    label: '城市选择',
    icon: Compass,
    bgColor: '#DBEAFE',
    color: '#3B82F6'
  },
  {
    path: '/orders',
    label: '我的订单',
    icon: Ticket,
    bgColor: '#FCE7F3',
    color: '#DB2777'
  },
  {
    path: '/service',
    label: '客服中心',
    icon: MessageCircle,
    bgColor: '#D1FAE5',
    color: '#059669'
  }
]

const allCities = computed(() => {
  const cities = []
  PROVINCES.forEach(province => {
    province.cities.forEach(city => {
      cities.push({ ...city, provinceName: province.name })
    })
  })
  return cities
})

const hotCities = computed(() => allCities.value.slice(0, 6))

const hotProducts = computed(() => {
  return [...PRODUCTS]
    .sort((a, b) => b.sales - a.sales)
    .slice(0, 4)
})

const featuredPosts = computed(() => {
  return [...POSTS].sort((a, b) => b.likes - a.likes)
})

function handleSearch() {
  if (searchKeyword.value.trim()) {
    router.push({
      path: '/shop',
      query: { keyword: searchKeyword.value }
    })
  }
}

function goToCity(cityId) {
  router.push(`/city/${cityId}`)
}

function goToProduct(productId) {
  router.push(`/product/${productId}`)
}

function goToPost(postId) {
  router.push(`/post/${postId}`)
}

function formatDate(dateStr) {
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now - date
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  
  if (days === 0) {
    const hours = Math.floor(diff / (1000 * 60 * 60))
    if (hours === 0) {
      const minutes = Math.floor(diff / (1000 * 60))
      return `${minutes}分钟前`
    }
    return `${hours}小时前`
  } else if (days < 7) {
    return `${days}天前`
  } else {
    return date.toLocaleDateString('zh-CN')
  }
}

function startAutoSlide() {
  slideTimer = setInterval(() => {
    currentSlide.value = (currentSlide.value + 1) % banners.length
  }, 4000)
}

function stopAutoSlide() {
  if (slideTimer) {
    clearInterval(slideTimer)
    slideTimer = null
  }
}

onMounted(() => {
  startAutoSlide()
})

onUnmounted(() => {
  stopAutoSlide()
})
</script>
