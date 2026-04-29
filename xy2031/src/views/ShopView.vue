<template>
  <div class="shop-view pb-20 bg-gray-50 min-h-screen">
    <!-- 搜索栏 -->
    <div class="sticky top-0 bg-white z-10 px-4 py-3 shadow-sm">
      <div class="flex items-center gap-3">
        <div class="flex-1 relative">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input 
            type="text" 
            v-model="searchKeyword"
            placeholder="搜索文创产品..."
            class="w-full pl-10 pr-4 py-2.5 bg-gray-50 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            @keyup.enter="handleSearch"
          />
        </div>
      </div>
    </div>

    <!-- 分类筛选 -->
    <div class="bg-white px-4 py-3">
      <div class="flex gap-2 overflow-x-auto pb-2">
        <button 
          v-for="category in categories" 
          :key="category.id"
          @click="selectedCategory = category.id"
          class="flex-shrink-0 px-4 py-2 rounded-full text-sm transition-all"
          :class="selectedCategory === category.id ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600'"
        >
          {{ category.name }}
        </button>
      </div>
    </div>

    <!-- 筛选条件 -->
    <div class="bg-white mt-2 px-4 py-3">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-4">
          <div class="relative">
            <select 
              v-model="sortBy"
              @change="handleSort"
              class="appearance-none bg-gray-50 px-3 py-2 pr-8 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">综合排序</option>
              <option value="sales">销量优先</option>
              <option value="price-asc">价格低到高</option>
              <option value="price-desc">价格高到低</option>
              <option value="rating">评分优先</option>
            </select>
            <ChevronDown class="w-4 h-4 text-gray-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
        <button 
          @click="showFilter = !showFilter"
          class="flex items-center gap-1 text-sm text-gray-600"
        >
          <Filter class="w-4 h-4" />
          筛选
        </button>
      </div>
    </div>

    <!-- 价格筛选 -->
    <div v-if="showFilter" class="bg-white mt-2 px-4 py-4">
      <h3 class="text-sm font-medium mb-3">价格区间</h3>
      <div class="flex items-center gap-3">
        <input 
          type="number" 
          v-model.number="minPrice"
          placeholder="最低价"
          class="w-full px-3 py-2 bg-gray-50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <span class="text-gray-400">至</span>
        <input 
          type="number" 
          v-model.number="maxPrice"
          placeholder="最高价"
          class="w-full px-3 py-2 bg-gray-50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button 
          @click="applyFilter"
          class="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm"
        >
          确定
        </button>
      </div>
    </div>

    <!-- 商品列表 -->
    <div class="p-4">
      <div v-if="filteredProducts.length > 0" class="grid grid-cols-2 gap-3">
        <div 
          v-for="product in filteredProducts" 
          :key="product.id"
          class="bg-white rounded-xl shadow-sm overflow-hidden cursor-pointer border border-gray-100 hover:shadow-lg transition-shadow"
          @click="goToProduct(product.id)"
        >
          <div class="relative">
            <img 
              :src="product.images?.[0] || product.image" 
              :alt="product.name"
              class="w-full h-40 object-cover"
            />
            <div class="absolute top-2 left-2 flex gap-1">
              <span 
                v-if="product.tags.includes('热销')" 
                class="bg-red-500 text-white text-xs px-2 py-0.5 rounded"
              >
                热销
              </span>
              <span 
                v-if="product.discountPrice" 
                class="bg-orange-500 text-white text-xs px-2 py-0.5 rounded"
              >
                特惠
              </span>
            </div>
            <button 
              class="absolute top-2 right-2 w-8 h-8 bg-white/90 rounded-full flex items-center justify-center shadow"
              @click.stop="toggleFavorite(product.id)"
            >
              <Heart 
                class="w-4 h-4" 
                :class="isFavorite(product.id) ? 'text-red-500 fill-red-500' : 'text-gray-400'"
              />
            </button>
          </div>
          <div class="p-3">
            <h3 class="text-sm font-medium text-gray-800 line-clamp-2">{{ product.name }}</h3>
            <p class="text-xs text-gray-500 mt-1">{{ product.cityName }}</p>
            <div class="flex items-center gap-1 mt-2">
              <Star class="w-3 h-3 text-yellow-400 fill-yellow-400" />
              <span class="text-xs text-gray-500">{{ product.rating }} · {{ product.reviews }}条评价</span>
            </div>
            <div class="flex items-center justify-between mt-2">
              <div class="flex items-baseline gap-1">
                <span class="text-red-500 font-bold text-base">¥{{ product.discountPrice || product.price }}</span>
                <span v-if="product.discountPrice" class="text-gray-400 text-xs line-through">¥{{ product.price }}</span>
              </div>
            </div>
            <div class="flex items-center justify-between mt-2">
              <span class="text-xs text-gray-400">已售{{ product.sales }}</span>
              <button 
                class="p-1.5 bg-blue-50 rounded-full"
                @click.stop="quickAddToCart(product)"
              >
                <ShoppingCart class="w-4 h-4 text-blue-500" />
              </button>
            </div>
          </div>
        </div>
      </div>
      <div v-else class="text-center py-16">
        <Package class="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <p class="text-gray-500">暂无相关商品</p>
        <button 
          @click="resetFilters"
          class="mt-4 px-6 py-2 bg-blue-500 text-white rounded-lg text-sm"
        >
          清除筛选
        </button>
      </div>
    </div>

    <!-- 添加成功提示 -->
    <Transition name="fade">
      <div 
        v-if="showAddSuccess" 
        class="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/75 text-white px-6 py-3 rounded-lg z-50"
      >
        已加入购物车
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { 
  Search, 
  ChevronDown, 
  Filter, 
  Heart, 
  Star, 
  ShoppingCart, 
  Package 
} from 'lucide-vue-next'
import { PRODUCTS, searchProducts } from '@/data/products'
import { useUserStore } from '@/stores/user'
import { useCartStore } from '@/stores/cart'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const cartStore = useCartStore()

const searchKeyword = ref('')
const selectedCategory = ref('all')
const sortBy = ref('')
const showFilter = ref(false)
const minPrice = ref(null)
const maxPrice = ref(null)
const showAddSuccess = ref(false)

const categories = [
  { id: 'all', name: '全部' },
  { id: 'refrigerator_magnet', name: '冰箱贴' },
  { id: 'postcard', name: '明信片' },
  { id: 'figurine', name: '手办' },
  { id: 'keychain', name: '钥匙扣' },
  { id: 'mug', name: '马克杯' },
  { id: 'tote_bag', name: '帆布包' },
  { id: 't_shirt', name: 'T恤' },
  { id: 'specialty', name: '特产' }
]

const filteredProducts = computed(() => {
  let results = [...PRODUCTS]
  
  if (searchKeyword.value) {
    results = searchProducts(searchKeyword.value)
  }
  
  if (selectedCategory.value !== 'all') {
    results = results.filter(p => p.type === selectedCategory.value)
  }
  
  if (minPrice.value !== null) {
    results = results.filter(p => (p.discountPrice || p.price) >= minPrice.value)
  }
  
  if (maxPrice.value !== null) {
    results = results.filter(p => (p.discountPrice || p.price) <= maxPrice.value)
  }
  
  if (sortBy.value) {
    switch (sortBy.value) {
      case 'sales':
        results.sort((a, b) => b.sales - a.sales)
        break
      case 'price-asc':
        results.sort((a, b) => (a.discountPrice || a.price) - (b.discountPrice || b.price))
        break
      case 'price-desc':
        results.sort((a, b) => (b.discountPrice || b.price) - (a.discountPrice || a.price))
        break
      case 'rating':
        results.sort((a, b) => b.rating - a.rating)
        break
    }
  }
  
  return results
})

function goToProduct(productId) {
  router.push(`/product/${productId}`)
}

function toggleFavorite(productId) {
  userStore.toggleFavorite(productId)
}

function isFavorite(productId) {
  return userStore.isFavorite(productId)
}

function quickAddToCart(product) {
  const specs = {
    type: product.type,
    color: product.specs?.colors?.[0] || 'white',
    shape: product.specs?.shapes?.[0] || 'square',
    size: product.specs?.sizes?.[0] || 'medium'
  }
  
  cartStore.addToCart(product, 1, specs)
  
  showAddSuccess.value = true
  setTimeout(() => {
    showAddSuccess.value = false
  }, 1500)
}

function handleSearch() {
  // 搜索结果会通过 computed 属性自动更新
}

function handleSort() {
  // 排序会通过 computed 属性自动更新
}

function applyFilter() {
  showFilter.value = false
}

function resetFilters() {
  searchKeyword.value = ''
  selectedCategory.value = 'all'
  sortBy.value = ''
  minPrice.value = null
  maxPrice.value = null
  showFilter.value = false
}

onMounted(() => {
  if (route.query.keyword) {
    searchKeyword.value = route.query.keyword
  }
})
</script>

<style>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
