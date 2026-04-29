<template>
  <div class="cart-view pb-32 bg-gray-50 min-h-screen">
    <!-- 顶部导航 -->
    <div class="sticky top-0 bg-white z-10 px-4 py-3 shadow-sm">
      <div class="flex items-center justify-between">
        <h1 class="text-lg font-bold">购物车 ({{ cartStore.cartCount }})</h1>
        <button 
          @click="isEditing = !isEditing"
          class="text-sm text-blue-500"
        >
          {{ isEditing ? '完成' : '管理' }}
        </button>
      </div>
    </div>

    <!-- 购物车列表 -->
    <div v-if="cartStore.items.length > 0" class="mt-2">
      <div 
        v-for="item in cartStore.items" 
        :key="item.id"
        class="bg-white px-4 py-3 mb-2"
      >
        <div class="flex gap-3">
          <!-- 选择框 -->
          <button 
            @click="cartStore.toggleSelect(item.id)"
            class="flex items-center pt-1"
          >
            <div 
              class="w-5 h-5 rounded-full border-2 flex items-center justify-center"
              :class="item.selected ? 'bg-blue-500 border-blue-500' : 'border-gray-300'"
            >
              <Check v-if="item.selected" class="w-3 h-3 text-white" />
            </div>
          </button>
          
          <!-- 商品图片 -->
          <img 
            :src="item.image" 
            :alt="item.name"
            class="w-20 h-20 rounded-lg object-cover flex-shrink-0"
          />
          
          <!-- 商品信息 -->
          <div class="flex-1 min-w-0">
            <h3 class="text-sm font-medium text-gray-800 line-clamp-2">{{ item.name }}</h3>
            <div class="flex flex-wrap gap-1 mt-1">
              <span 
                v-if="item.specs?.color"
                class="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded"
              >
                颜色: {{ getColorName(item.specs.color) }}
              </span>
              <span 
                v-if="item.specs?.size"
                class="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded"
              >
                尺寸: {{ getSizeName(item.specs.size) }}
              </span>
            </div>
            
            <div class="flex items-center justify-between mt-2">
              <div>
                <span class="text-red-500 font-bold">¥{{ item.price }}</span>
                <span v-if="item.quantity > 1" class="text-xs text-gray-400 ml-2">
                  × {{ item.quantity }} = <span class="text-red-500 font-medium">¥{{ (item.price * item.quantity).toFixed(1) }}</span>
                </span>
              </div>
              
              <div class="flex items-center gap-2">
                <button 
                  @click="cartStore.updateQuantity(item.id, item.quantity - 1)"
                  class="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center"
                >
                  <Minus class="w-3 h-3" />
                </button>
                <span class="w-6 text-center text-sm font-medium">{{ item.quantity }}</span>
                <button 
                  @click="cartStore.updateQuantity(item.id, item.quantity + 1)"
                  class="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center"
                >
                  <Plus class="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
          
          <!-- 删除按钮 -->
          <button 
            v-if="isEditing"
            @click="cartStore.removeFromCart(item.id)"
            class="flex items-center"
          >
            <Trash2 class="w-5 h-5 text-red-500" />
          </button>
        </div>
      </div>
    </div>

    <!-- 空购物车 -->
    <div v-else class="flex flex-col items-center justify-center py-20">
      <ShoppingCart class="w-16 h-16 text-gray-300 mb-4" />
      <p class="text-gray-500 mb-4">购物车空空如也</p>
      <router-link 
        to="/shop"
        class="px-6 py-2 bg-blue-500 text-white rounded-lg text-sm"
      >
        去逛逛
      </router-link>
    </div>

    <!-- 底部结算栏 -->
    <div 
      v-if="cartStore.items.length > 0"
      class="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-3 z-50"
      :style="{ maxWidth: '480px', margin: '0 auto' }"
    >
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <button 
            @click="cartStore.toggleSelectAll()"
            class="flex items-center"
          >
            <div 
              class="w-5 h-5 rounded-full border-2 flex items-center justify-center"
              :class="allSelected ? 'bg-blue-500 border-blue-500' : 'border-gray-300'"
            >
              <Check v-if="allSelected" class="w-3 h-3 text-white" />
            </div>
          </button>
          <span class="text-sm text-gray-600">全选</span>
        </div>
        
        <div class="flex items-center gap-3">
          <div class="text-right">
            <p class="text-sm text-gray-600">
              合计: <span class="text-red-500 font-bold text-lg">¥{{ cartStore.totalPrice }}</span>
            </p>
            <p v-if="cartStore.totalDiscount > 0" class="text-xs text-green-500">
              已优惠 ¥{{ cartStore.totalDiscount.toFixed(1) }}
            </p>
          </div>
          <button 
            @click="goToCheckout"
            :disabled="cartStore.selectedCount === 0"
            class="px-6 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            结算 ({{ cartStore.selectedCount }})
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { 
  Check, 
  Minus, 
  Plus, 
  Trash2, 
  ShoppingCart 
} from 'lucide-vue-next'
import { useCartStore } from '@/stores/cart'
import { COLORS, SIZES } from '@/data/products'

const router = useRouter()
const cartStore = useCartStore()
const isEditing = ref(false)

const allSelected = computed(() => {
  return cartStore.items.length > 0 && cartStore.items.every(item => item.selected)
})

function getColorName(colorId) {
  const color = COLORS.find(c => c.id === colorId)
  return color?.name || colorId
}

function getSizeName(sizeId) {
  const size = SIZES.find(s => s.id === sizeId)
  return size?.name || sizeId
}

function goToCheckout() {
  if (cartStore.selectedCount > 0) {
    router.push('/checkout')
  }
}
</script>
