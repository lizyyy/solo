<template>
  <div class="product-detail-view pb-24 bg-gray-50 min-h-screen">
    <!-- 返回按钮 -->
    <button 
      @click="goBack"
      class="fixed top-4 left-4 z-50 w-10 h-10 bg-white/90 rounded-full flex items-center justify-center shadow-lg"
      :style="{ maxWidth: '480px', margin: '0 auto' }"
    >
      <ChevronLeft class="w-6 h-6 text-gray-700" />
    </button>

    <!-- 商品图片轮播 -->
    <div class="relative bg-white">
      <div class="h-80 overflow-hidden">
        <img 
          v-if="product?.images?.[currentImageIndex]"
          :src="product.images[currentImageIndex]"
          :alt="product.name"
          class="w-full h-full object-cover"
        />
        <img 
          v-else-if="product?.image"
          :src="product.image"
          :alt="product.name"
          class="w-full h-full object-cover"
        />
      </div>
      
      <!-- 图片指示器 -->
      <div v-if="product?.images?.length > 1" class="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
        <div 
          v-for="(_, index) in product.images" 
          :key="index"
          class="w-2 h-2 rounded-full transition-all"
          :class="currentImageIndex === index ? 'bg-white w-6 rounded' : 'bg-white/50'"
        ></div>
      </div>

      <!-- 收藏按钮 -->
      <button 
        @click="toggleFavorite"
        class="absolute top-4 right-4 z-40 w-10 h-10 bg-white/90 rounded-full flex items-center justify-center shadow-lg"
      >
        <Heart 
          class="w-5 h-5" 
          :class="isFavorite ? 'text-red-500 fill-red-500' : 'text-gray-400'"
        />
      </button>
    </div>

    <!-- 商品信息 -->
    <div class="bg-white mt-2 px-4 py-4">
      <div class="flex items-baseline gap-2">
        <span class="text-2xl font-bold text-red-500">¥{{ product?.discountPrice || product?.price }}</span>
        <span v-if="product?.discountPrice" class="text-gray-400 line-through">¥{{ product?.price }}</span>
        <span v-if="product?.discountPrice" class="text-xs bg-red-100 text-red-500 px-2 py-0.5 rounded">
          省¥{{ (product.price - product.discountPrice).toFixed(1) }}
        </span>
      </div>
      
      <h1 class="text-lg font-medium mt-2">{{ product?.name }}</h1>
      <p class="text-sm text-gray-500 mt-2">{{ product?.description }}</p>
      
      <div class="flex items-center gap-4 mt-3 text-sm">
        <div class="flex items-center gap-1">
          <Star class="w-4 h-4 text-yellow-400 fill-yellow-400" />
          <span class="font-medium">{{ product?.rating }}</span>
          <span class="text-gray-400">({{ product?.reviews }}条评价)</span>
        </div>
        <div class="text-gray-400">
          已售{{ product?.sales }}
        </div>
        <div class="text-gray-400">
          库存{{ product?.stock }}
        </div>
      </div>

      <div class="flex flex-wrap gap-2 mt-3">
        <span 
          v-for="tag in product?.tags" 
          :key="tag"
          class="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded"
        >
          {{ tag }}
        </span>
      </div>
    </div>

    <!-- 商品图片缩略图 -->
    <div v-if="product?.images?.length > 1" class="bg-white mt-2 px-4 py-3">
      <div class="flex gap-3 overflow-x-auto">
        <div 
          v-for="(img, index) in product.images" 
          :key="index"
          class="flex-shrink-0 cursor-pointer"
          @click="currentImageIndex = index"
        >
          <img 
            :src="img" 
            class="w-16 h-16 rounded-lg object-cover border-2 transition-all"
            :class="currentImageIndex === index ? 'border-blue-500' : 'border-transparent'"
          />
        </div>
      </div>
    </div>

    <!-- 规格选择 -->
    <div class="bg-white mt-2 px-4 py-4">
      <h3 class="font-medium mb-3">选择规格</h3>
      
      <!-- 颜色 -->
      <div v-if="product?.specs?.colors?.length > 0" class="mb-4">
        <p class="text-sm text-gray-600 mb-2">颜色</p>
        <div class="flex gap-3">
          <div 
            v-for="color in COLORS.filter(c => product.specs.colors.includes(c.id))" 
            :key="color.id"
            class="cursor-pointer p-1 rounded-lg border-2 transition-all"
            :class="selectedColor === color.id ? 'border-blue-500' : 'border-gray-200'"
            @click="selectedColor = color.id"
          >
            <div 
              class="w-8 h-8 rounded-full border border-gray-200"
              :style="{ backgroundColor: color.hex }"
            ></div>
          </div>
        </div>
      </div>

      <!-- 形状 -->
      <div v-if="product?.specs?.shapes?.length > 0" class="mb-4">
        <p class="text-sm text-gray-600 mb-2">形状</p>
        <div class="flex flex-wrap gap-2">
          <button 
            v-for="shape in SHAPES.filter(s => product.specs.shapes.includes(s.id))" 
            :key="shape.id"
            class="px-4 py-2 rounded-lg border text-sm transition-all"
            :class="selectedShape === shape.id ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-gray-200 text-gray-600'"
            @click="selectedShape = shape.id"
          >
            <span class="mr-1">{{ shape.icon }}</span>
            {{ shape.name }}
          </button>
        </div>
      </div>

      <!-- 尺寸 -->
      <div v-if="product?.specs?.sizes?.length > 0">
        <p class="text-sm text-gray-600 mb-2">尺寸</p>
        <div class="flex flex-wrap gap-2">
          <button 
            v-for="size in SIZES.filter(s => product.specs.sizes.includes(s.id))" 
            :key="size.id"
            class="px-4 py-2 rounded-lg border text-sm transition-all"
            :class="selectedSize === size.id ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-gray-200 text-gray-600'"
            @click="selectedSize = size.id"
          >
            {{ size.name }}
          </button>
        </div>
      </div>

      <!-- 数量 -->
      <div class="mt-4 flex items-center justify-between">
        <span class="text-sm text-gray-600">数量</span>
        <div class="flex items-center gap-3">
          <button 
            @click="quantity = Math.max(1, quantity - 1)"
            class="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"
          >
            <Minus class="w-4 h-4" />
          </button>
          <span class="w-8 text-center font-medium">{{ quantity }}</span>
          <button 
            @click="quantity++"
            class="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"
          >
            <Plus class="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>

    <!-- 生成海报 -->
    <div class="bg-white mt-2 px-4 py-4">
      <button 
        @click="generatePoster"
        class="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg font-medium"
      >
        <Share2 class="w-5 h-5" />
        生成海报分享
      </button>
    </div>

    <!-- 底部操作栏 -->
    <div class="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-3 z-50" :style="{ maxWidth: '480px', margin: '0 auto' }">
      <div class="flex gap-3">
        <button 
          @click="addToCart"
          class="flex-1 py-3 border-2 border-blue-500 text-blue-500 rounded-lg font-medium"
        >
          加入购物车
        </button>
        <button 
          @click="buyNow"
          class="flex-1 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg font-medium"
        >
          立即购买
        </button>
      </div>
    </div>

    <!-- 海报预览弹窗 -->
    <div v-if="showPosterModal" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" @click.self="showPosterModal = false">
      <div class="bg-white rounded-xl overflow-hidden max-w-sm w-full">
        <div class="p-4 border-b">
          <h3 class="font-medium text-center">商品海报</h3>
        </div>
        <div class="p-4">
          <div class="bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg p-6">
            <img 
              :src="product?.images?.[0] || product?.image" 
              class="w-full h-48 object-cover rounded-lg mb-4"
            />
            <h4 class="font-medium text-gray-800">{{ product?.name }}</h4>
            <p class="text-red-500 font-bold text-xl mt-2">¥{{ product?.discountPrice || product?.price }}</p>
            <div class="mt-4 flex items-center justify-between">
              <span class="text-sm text-gray-500">长按保存图片</span>
              <div class="flex items-center gap-1">
                <QrCode class="w-6 h-6 text-gray-400" />
                <span class="text-xs text-gray-400">扫码购买</span>
              </div>
            </div>
          </div>
        </div>
        <div class="p-4 border-t flex gap-3">
          <button 
            @click="showPosterModal = false"
            class="flex-1 py-2 border border-gray-200 rounded-lg text-gray-600"
          >
            取消
          </button>
          <button 
            @click="sharePoster"
            class="flex-1 py-2 bg-blue-500 text-white rounded-lg"
          >
            分享
          </button>
        </div>
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
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { 
  ChevronLeft, 
  Heart, 
  Star, 
  Minus, 
  Plus, 
  Share2,
  QrCode
} from 'lucide-vue-next'
import { getProductById, PRODUCTS, COLORS, SHAPES, SIZES } from '@/data/products'
import { useUserStore } from '@/stores/user'
import { useCartStore } from '@/stores/cart'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const cartStore = useCartStore()

const product = ref(null)
const currentImageIndex = ref(0)
const selectedColor = ref(null)
const selectedShape = ref(null)
const selectedSize = ref(null)
const quantity = ref(1)
const showPosterModal = ref(false)
const showAddSuccess = ref(false)

const isFavorite = computed(() => {
  return product.value ? userStore.isFavorite(product.value.id) : false
})

function goBack() {
  router.back()
}

function toggleFavorite() {
  if (product.value) {
    userStore.toggleFavorite(product.value.id)
  }
}

function addToCart() {
  if (!product.value) return
  
  const specs = {
    type: product.value.type,
    color: selectedColor.value || product.value.specs?.colors?.[0] || 'white',
    shape: selectedShape.value || product.value.specs?.shapes?.[0] || 'square',
    size: selectedSize.value || product.value.specs?.sizes?.[0] || 'medium'
  }
  
  cartStore.addToCart(product.value, quantity.value, specs)
  
  showAddSuccess.value = true
  setTimeout(() => {
    showAddSuccess.value = false
  }, 1500)
}

function buyNow() {
  addToCart()
  router.push('/cart')
}

function generatePoster() {
  showPosterModal.value = true
}

function sharePoster() {
  showPosterModal.value = false
}

onMounted(() => {
  const productId = route.params.productId
  if (productId) {
    product.value = getProductById(productId)
    
    if (product.value) {
      selectedColor.value = product.value.specs?.colors?.[0] || null
      selectedShape.value = product.value.specs?.shapes?.[0] || null
      selectedSize.value = product.value.specs?.sizes?.[0] || null
    }
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
