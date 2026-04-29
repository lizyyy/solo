<template>
  <div class="customize-view pb-24 bg-gray-50 min-h-screen">
    <!-- 顶部导航 -->
    <div class="sticky top-0 bg-white z-10 px-4 py-3 shadow-sm">
      <div class="flex items-center gap-3">
        <button @click="goBack" class="p-1">
          <ChevronLeft class="w-6 h-6 text-gray-700" />
        </button>
        <h1 class="text-lg font-bold">文创定制</h1>
      </div>
    </div>

    <!-- 定制预览 -->
    <div class="bg-white mt-2 p-4">
      <h3 class="font-medium mb-3">预览效果</h3>
      <div class="flex justify-center">
        <div 
          class="w-48 h-48 rounded-xl flex items-center justify-center relative overflow-hidden"
          :style="{ backgroundColor: selectedColorInfo?.hex || '#FFFFFF', border: '2px dashed #ddd' }"
        >
          <div v-if="customImage" class="absolute inset-0">
            <img :src="customImage" class="w-full h-full object-cover" />
          </div>
          <div v-else class="text-center p-4">
            <span class="text-5xl text-gray-300">{{ currentShapeEmoji }}</span>
            <p class="text-gray-400 text-sm mt-2">选择物品类型开始定制</p>
          </div>
          <div v-if="customText" class="absolute bottom-2 left-2 right-2 bg-white/80 rounded p-2 text-center">
            <p class="text-sm font-medium">{{ customText }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- 物品类型选择 -->
    <div class="bg-white mt-2 px-4 py-4">
      <h3 class="font-medium mb-3">选择物品类型</h3>
      <div class="grid grid-cols-4 gap-3">
        <div 
          v-for="type in Object.values(PRODUCT_TYPES)" 
          :key="type.id"
          class="flex flex-col items-center p-3 rounded-lg cursor-pointer transition-all"
          :class="selectedType === type.id ? 'bg-blue-50 border-2 border-blue-500' : 'bg-gray-50 border-2 border-transparent'"
          @click="selectedType = type.id"
        >
          <span class="text-2xl">{{ type.icon }}</span>
          <span class="text-xs mt-1">{{ type.name }}</span>
        </div>
      </div>
    </div>

    <!-- 颜色选择 -->
    <div class="bg-white mt-2 px-4 py-4">
      <h3 class="font-medium mb-3">选择颜色</h3>
      <div class="flex flex-wrap gap-3">
        <div 
          v-for="color in COLORS" 
          :key="color.id"
          class="cursor-pointer p-1 rounded-lg border-2 transition-all"
          :class="selectedColor === color.id ? 'border-blue-500' : 'border-gray-200'"
          @click="selectedColor = color.id"
        >
          <div 
            class="w-10 h-10 rounded-full border border-gray-200"
            :style="{ backgroundColor: color.hex }"
          ></div>
          <p class="text-xs text-center mt-1">{{ color.name }}</p>
        </div>
      </div>
    </div>

    <!-- 形状选择 -->
    <div class="bg-white mt-2 px-4 py-4">
      <h3 class="font-medium mb-3">选择形状</h3>
      <div class="flex flex-wrap gap-2">
        <button 
          v-for="shape in SHAPES" 
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

    <!-- 尺寸选择 -->
    <div class="bg-white mt-2 px-4 py-4">
      <h3 class="font-medium mb-3">选择尺寸</h3>
      <div class="flex flex-wrap gap-2">
        <button 
          v-for="size in SIZES" 
          :key="size.id"
          class="px-4 py-2 rounded-lg border text-sm transition-all"
          :class="selectedSize === size.id ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-gray-200 text-gray-600'"
          @click="selectedSize = size.id"
        >
          {{ size.name }}
          <span v-if="size.multiplier !== 1" class="text-xs ml-1">
            ({{ size.multiplier > 1 ? '+' : '' }}{{ Math.round((size.multiplier - 1) * 100) }}%)
          </span>
        </button>
      </div>
    </div>

    <!-- 自定义图片 -->
    <div class="bg-white mt-2 px-4 py-4">
      <h3 class="font-medium mb-3">上传自定义图片（可选）</h3>
      <div class="flex gap-3">
        <div 
          v-if="customImage"
          class="relative"
        >
          <img :src="customImage" class="w-20 h-20 rounded-lg object-cover" />
          <button 
            @click="customImage = null"
            class="absolute -top-2 -right-2 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center"
          >
            <X class="w-3 h-3 text-white" />
          </button>
        </div>
        <label class="w-20 h-20 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center cursor-pointer hover:border-blue-500 transition-colors">
          <div class="text-center">
            <Upload class="w-6 h-6 text-gray-400 mx-auto" />
            <p class="text-xs text-gray-400 mt-1">上传图片</p>
          </div>
          <input 
            type="file" 
            accept="image/*" 
            class="hidden" 
            @change="handleImageUpload"
          />
        </label>
      </div>
    </div>

    <!-- 自定义文字 -->
    <div class="bg-white mt-2 px-4 py-4">
      <h3 class="font-medium mb-3">添加自定义文字（可选）</h3>
      <textarea 
        v-model="customText"
        placeholder="输入您想要的文字（如：姓名、祝福语等）..."
        class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        rows="3"
        maxlength="30"
      ></textarea>
      <p class="text-xs text-gray-400 mt-1">最多30个字符</p>
    </div>

    <!-- 城市主题 -->
    <div class="bg-white mt-2 px-4 py-4">
      <h3 class="font-medium mb-3">选择城市主题（可选）</h3>
      <div class="flex gap-3 overflow-x-auto pb-2">
        <div 
          v-for="theme in Object.values(THEMES).slice(1)" 
          :key="theme.id"
          class="flex-shrink-0 cursor-pointer rounded-lg overflow-hidden border-2 transition-all"
          :class="selectedTheme === theme.id ? 'border-blue-500' : 'border-transparent'"
          @click="selectedTheme = theme.id"
        >
          <img :src="theme.image" class="w-24 h-16 object-cover" />
          <p class="text-xs text-center py-1 bg-gray-50">{{ theme.landmark }}</p>
        </div>
      </div>
    </div>

    <!-- 价格计算 -->
    <div class="bg-white mt-2 px-4 py-4">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm text-gray-500">定制价格</p>
          <p class="text-2xl font-bold text-red-500">¥{{ calculatedPrice }}</p>
        </div>
        <div class="text-xs text-gray-400">
          <p>基础价格: ¥{{ baseTypePrice }}</p>
          <p v-if="hasCustomImage">自定义图片: +¥20</p>
          <p v-if="hasCustomText">自定义文字: +¥10</p>
        </div>
      </div>
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
          立即定制
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

    <!-- 确认定制弹窗 -->
    <div v-if="showConfirmModal" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" @click.self="showConfirmModal = false">
      <div class="bg-white rounded-2xl w-full max-w-sm overflow-hidden" @click.stop>
        <div class="p-4 border-b">
          <h3 class="font-bold text-lg text-center">确认定制订单</h3>
        </div>
        <div class="p-4 space-y-3">
          <div class="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
            <div 
              class="w-16 h-16 rounded-lg flex items-center justify-center text-3xl"
              :style="{ backgroundColor: selectedColorInfo?.hex || '#FFFFFF' }"
            >
              {{ currentShapeEmoji }}
            </div>
            <div class="flex-1">
              <p class="font-medium">{{ PRODUCT_TYPES[selectedType.value?.toUpperCase()]?.name || '定制商品' }}</p>
              <p class="text-sm text-gray-500">
                {{ selectedColorInfo?.name }} · {{ SHAPES.find(s => s.id === selectedShape.value)?.name }} · {{ SIZES.find(s => s.id === selectedSize.value)?.name }}
              </p>
            </div>
          </div>
          
          <div class="space-y-2 text-sm">
            <div class="flex justify-between">
              <span class="text-gray-500">物品类型</span>
              <span>{{ PRODUCT_TYPES[selectedType.value?.toUpperCase()]?.name }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-500">颜色</span>
              <span>{{ selectedColorInfo?.name }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-500">形状</span>
              <span>{{ SHAPES.find(s => s.id === selectedShape.value)?.name }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-500">尺寸</span>
              <span>{{ SIZES.find(s => s.id === selectedSize.value)?.name }}</span>
            </div>
            <div v-if="customText" class="flex justify-between">
              <span class="text-gray-500">自定义文字</span>
              <span>{{ customText }}</span>
            </div>
            <div v-if="customImage" class="flex justify-between">
              <span class="text-gray-500">自定义图片</span>
              <span class="text-green-600">已上传</span>
            </div>
            <div class="flex justify-between pt-2 border-t">
              <span class="text-gray-500">定制价格</span>
              <span class="text-red-500 font-bold text-lg">¥{{ calculatedPrice }}</span>
            </div>
          </div>
        </div>
        <div class="flex border-t">
          <button 
            @click="showConfirmModal = false"
            class="flex-1 py-4 text-gray-600 font-medium"
          >
            取消
          </button>
          <button 
            @click="confirmBuyNow"
            class="flex-1 py-4 bg-red-500 text-white font-medium"
          >
            确认定制
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { 
  ChevronLeft, 
  Upload, 
  X 
} from 'lucide-vue-next'
import { PRODUCT_TYPES, COLORS, SHAPES, SIZES, calculateCustomPrice } from '@/data/products'
import { THEMES } from '@/stores/theme'
import { useCartStore } from '@/stores/cart'

const router = useRouter()
const cartStore = useCartStore()

const selectedType = ref('refrigerator_magnet')
const selectedColor = ref('white')
const selectedShape = ref('square')
const selectedSize = ref('medium')
const selectedTheme = ref(null)
const customImage = ref(null)
const customText = ref('')
const showAddSuccess = ref(false)
const showConfirmModal = ref(false)

const selectedColorInfo = computed(() => {
  return COLORS.find(c => c.id === selectedColor.value)
})

const currentShapeEmoji = computed(() => {
  const shape = SHAPES.find(s => s.id === selectedShape.value)
  return shape?.icon || '⬜'
})

const baseTypePrice = computed(() => {
  const type = PRODUCT_TYPES[selectedType.value?.toUpperCase()] || PRODUCT_TYPES.REFRIGERATOR_MAGNET
  const shape = SHAPES.find(s => s.id === selectedShape.value) || SHAPES[0]
  const size = SIZES.find(s => s.id === selectedSize.value) || SIZES[1]
  
  let price = type.basePrice
  price *= shape.priceMultiplier
  price *= size.multiplier
  
  return Math.round(price * 100) / 100
})

const hasCustomImage = computed(() => customImage.value !== null)
const hasCustomText = computed(() => customText.value.trim() !== '')

const calculatedPrice = computed(() => {
  const options = {
    type: selectedType.value,
    shape: selectedShape.value,
    size: selectedSize.value,
    customImage: hasCustomImage.value,
    customText: hasCustomText.value
  }
  return calculateCustomPrice(options)
})

function goBack() {
  router.back()
}

function handleImageUpload(event) {
  const file = event.target.files?.[0]
  if (file) {
    const reader = new FileReader()
    reader.onload = (e) => {
      customImage.value = e.target.result
    }
    reader.readAsDataURL(file)
  }
}

function addToCart() {
  const type = PRODUCT_TYPES[selectedType.value?.toUpperCase()] || PRODUCT_TYPES.REFRIGERATOR_MAGNET
  
  const customProduct = {
    id: `custom_${Date.now()}`,
    name: `定制${type.name}`,
    description: '用户定制文创产品',
    price: calculatedPrice.value,
    images: customImage.value ? [customImage.value] : [],
    image: customImage.value || '',
    cityName: '定制',
    type: selectedType.value,
    specs: {
      colors: [selectedColor.value],
      shapes: [selectedShape.value],
      sizes: [selectedSize.value]
    },
    customOptions: {
      type: selectedType.value,
      color: selectedColor.value,
      shape: selectedShape.value,
      size: selectedSize.value,
      customImage: customImage.value,
      customText: customText.value,
      theme: selectedTheme.value
    }
  }
  
  const specs = {
    type: selectedType.value,
    color: selectedColor.value,
    shape: selectedShape.value,
    size: selectedSize.value
  }
  
  cartStore.addToCart(customProduct, 1, specs)
  
  showAddSuccess.value = true
  setTimeout(() => {
    showAddSuccess.value = false
  }, 1500)
}

function buyNow() {
  showConfirmModal.value = true
}

function confirmBuyNow() {
  showConfirmModal.value = false
  addToCart()
  router.push('/cart')
}
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
