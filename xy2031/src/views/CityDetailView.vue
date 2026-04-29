<template>
  <div class="city-detail-view pb-20 bg-gray-50 min-h-screen">
    <!-- 顶部城市信息 -->
    <div class="relative">
      <img 
        :src="cityInfo?.city?.image" 
        :alt="cityInfo?.city?.name"
        class="w-full h-48 object-cover"
      />
      <div class="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
      
      <!-- 返回按钮 -->
      <button 
        @click="goBack"
        class="absolute top-4 left-4 w-10 h-10 bg-white/90 rounded-full flex items-center justify-center shadow-lg"
      >
        <ChevronLeft class="w-6 h-6 text-gray-700" />
      </button>
      
      <!-- 城市信息 -->
      <div class="absolute bottom-4 left-4 right-4">
        <h1 class="text-white text-2xl font-bold">{{ cityInfo?.city?.name }}</h1>
        <p class="text-white/80 text-sm mt-1">{{ cityInfo?.province?.name }}</p>
        <p class="text-white/80 text-xs mt-2 line-clamp-2">{{ cityInfo?.city?.description }}</p>
      </div>
    </div>

    <!-- 统计信息 -->
    <div class="bg-white px-4 py-4 grid grid-cols-3 gap-4">
      <div class="text-center">
        <p class="text-2xl font-bold text-blue-500">{{ cityInfo?.city?.landmarks?.length }}</p>
        <p class="text-xs text-gray-500 mt-1">景点数量</p>
      </div>
      <div class="text-center border-x border-gray-100">
        <p class="text-2xl font-bold text-orange-500">{{ featuredProducts.length }}</p>
        <p class="text-xs text-gray-500 mt-1">文创产品</p>
      </div>
      <div class="text-center">
        <p class="text-2xl font-bold text-green-500">{{ relatedPosts.length }}</p>
        <p class="text-xs text-gray-500 mt-1">分享帖子</p>
      </div>
    </div>

    <!-- Tab 切换 -->
    <div class="sticky top-0 bg-white z-10 mt-2">
      <div class="flex border-b border-gray-100">
        <button 
          v-for="tab in tabs" 
          :key="tab.id"
          @click="activeTab = tab.id"
          class="flex-1 py-3 text-sm font-medium transition-colors"
          :class="activeTab === tab.id ? 'text-blue-500 border-b-2 border-blue-500' : 'text-gray-500'"
        >
          {{ tab.name }}
        </button>
      </div>
    </div>

    <!-- 景点列表 -->
    <div v-if="activeTab === 'landmarks'" class="p-4 space-y-4">
      <div 
        v-for="landmark in cityInfo?.city?.landmarks" 
        :key="landmark.id"
        class="bg-white rounded-xl shadow-sm overflow-hidden"
      >
        <div class="relative">
          <img 
            :src="landmark.image" 
            :alt="landmark.name"
            class="w-full h-40 object-cover"
          />
          <div class="absolute top-3 right-3">
            <span class="bg-white/90 text-xs px-2 py-1 rounded-full shadow">
              {{ landmark.category }}
            </span>
          </div>
        </div>
        <div class="p-4">
          <div class="flex justify-between items-start">
            <div>
              <h3 class="font-bold text-lg">{{ landmark.name }}</h3>
              <p class="text-sm text-gray-500 mt-1 line-clamp-2">{{ landmark.description }}</p>
            </div>
            <div class="flex items-center gap-1">
              <Star class="w-4 h-4 text-yellow-400 fill-yellow-400" />
              <span class="text-sm font-medium">{{ landmark.rating }}</span>
            </div>
          </div>
          
          <div class="flex items-center gap-4 mt-3 text-xs text-gray-500">
            <span class="flex items-center gap-1">
              <MapPin class="w-3 h-3" />
              {{ landmark.address }}
            </span>
          </div>
          
          <div class="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
            <div class="flex items-center gap-4 text-xs">
              <span>
                <span class="text-gray-500">门票：</span>
                <span class="text-green-500 font-medium">{{ landmark.ticketPrice }}</span>
              </span>
              <span>
                <span class="text-gray-500">开放时间：</span>
                <span>{{ landmark.openTime }}</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 文创产品 -->
    <div v-if="activeTab === 'products'" class="p-4">
      <div v-if="featuredProducts.length > 0" class="grid grid-cols-2 gap-3">
        <div 
          v-for="product in featuredProducts" 
          :key="product.id"
          class="bg-white rounded-lg shadow-sm overflow-hidden cursor-pointer border border-gray-100"
          @click="goToProduct(product.id)"
        >
          <img 
            :src="product.images?.[0] || product.image" 
            :alt="product.name"
            class="w-full h-32 object-cover"
          />
          <div class="p-3">
            <h3 class="text-sm font-medium text-gray-800 line-clamp-2">{{ product.name }}</h3>
            <div class="flex items-center justify-between mt-2">
              <div class="flex items-baseline gap-1">
                <span class="text-red-500 font-bold text-base">¥{{ product.discountPrice || product.price }}</span>
                <span v-if="product.discountPrice" class="text-gray-400 text-xs line-through">¥{{ product.price }}</span>
              </div>
              <span class="text-xs text-gray-400">已售{{ product.sales }}</span>
            </div>
            <div class="flex flex-wrap gap-1 mt-2">
              <span 
                v-for="tag in product.tags.slice(0, 2)" 
                :key="tag"
                class="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded"
              >
                {{ tag }}
              </span>
            </div>
          </div>
        </div>
      </div>
      <div v-else class="text-center py-12">
        <Package class="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <p class="text-gray-500">暂无文创产品</p>
      </div>
    </div>

    <!-- 相关帖子 -->
    <div v-if="activeTab === 'posts'" class="p-4 space-y-4">
      <div v-if="relatedPosts.length > 0">
        <div 
          v-for="post in relatedPosts" 
          :key="post.id"
          class="bg-white rounded-xl shadow-sm p-4 cursor-pointer"
          @click="goToPost(post.id)"
        >
          <div class="flex items-center gap-3 mb-3">
            <img 
              :src="post.avatar" 
              :alt="post.username"
              class="w-10 h-10 rounded-full object-cover"
            />
            <div>
              <p class="font-medium text-sm">{{ post.username }}</p>
              <p class="text-xs text-gray-500">{{ formatDate(post.createdAt) }}</p>
            </div>
          </div>
          
          <h3 class="font-medium text-gray-800 mb-2">{{ post.title }}</h3>
          <p class="text-sm text-gray-600 line-clamp-2">{{ post.content }}</p>
          
          <div v-if="post.images && post.images.length > 0" class="flex gap-2 mt-3">
            <img 
              v-for="(img, idx) in post.images.slice(0, 3)" 
              :key="idx"
              :src="img"
              class="w-20 h-20 rounded-lg object-cover"
            />
          </div>
          
          <div class="flex items-center gap-6 mt-3 text-gray-500 text-xs">
            <span class="flex items-center gap-1">
              <Heart class="w-4 h-4" :class="{ 'text-red-500 fill-red-500': post.isLiked }" />
              {{ post.likes }}
            </span>
            <span class="flex items-center gap-1">
              <MessageCircle class="w-4 h-4" />
              {{ post.comments.length }}
            </span>
          </div>
        </div>
      </div>
      <div v-else class="text-center py-12">
        <MessageCircle class="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <p class="text-gray-500">暂无相关分享</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { 
  ChevronLeft, 
  Star, 
  MapPin, 
  Package, 
  Heart, 
  MessageCircle 
} from 'lucide-vue-next'
import { getCityById } from '@/data/cities'
import { PRODUCTS, getProductsByCity } from '@/data/products'
import { POSTS } from '@/data/posts'

const route = useRoute()
const router = useRouter()

const activeTab = ref('landmarks')
const cityInfo = ref(null)

const tabs = [
  { id: 'landmarks', name: '景点' },
  { id: 'products', name: '文创' },
  { id: 'posts', name: '分享' }
]

const featuredProducts = computed(() => {
  if (!cityInfo.value?.city?.id) return []
  return getProductsByCity(cityInfo.value.city.id)
})

const relatedPosts = computed(() => {
  if (!cityInfo.value?.city?.name) return []
  return POSTS.filter(p => 
    p.location.city === cityInfo.value.city.name ||
    p.tags.some(tag => tag.includes(cityInfo.value.city.name))
  )
})

function goBack() {
  router.back()
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

onMounted(() => {
  const cityId = route.params.cityId
  if (cityId) {
    cityInfo.value = getCityById(cityId)
  }
})
</script>
