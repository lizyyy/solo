<template>
  <div class="checkout-view pb-32 bg-gray-50 min-h-screen">
    <!-- 顶部导航 -->
    <div class="sticky top-0 bg-white z-10 px-4 py-3 shadow-sm">
      <div class="flex items-center gap-3">
        <button @click="goBack" class="p-1">
          <ChevronLeft class="w-6 h-6 text-gray-700" />
        </button>
        <h1 class="text-lg font-bold">确认订单</h1>
      </div>
    </div>

    <!-- 收货地址 -->
    <div class="bg-white mt-2 px-4 py-3">
      <h3 class="font-medium mb-3">收货地址</h3>
      <div 
        v-if="selectedAddress"
        class="bg-gray-50 rounded-lg p-3"
      >
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="font-medium">{{ selectedAddress.name }}</span>
            <span class="text-gray-500">{{ selectedAddress.phone }}</span>
          </div>
          <span v-if="selectedAddress.isDefault" class="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded">默认</span>
        </div>
        <p class="text-sm text-gray-600 mt-2">
          {{ selectedAddress.province }}{{ selectedAddress.city }}{{ selectedAddress.district }}{{ selectedAddress.detail }}
        </p>
      </div>
      
      <div 
        v-else
        class="flex items-center justify-between bg-gray-50 rounded-lg p-3 cursor-pointer"
        @click="showAddressModal = true"
      >
        <span class="text-gray-400">请选择收货地址</span>
        <ChevronRight class="w-5 h-5 text-gray-400" />
      </div>
    </div>

    <!-- 商品列表 -->
    <div class="bg-white mt-2 px-4 py-3">
      <h3 class="font-medium mb-3">商品清单</h3>
      <div 
        v-for="item in cartStore.selectedItems" 
        :key="item.id"
        class="flex gap-3 py-3 border-b border-gray-50 last:border-b-0"
      >
        <img 
          :src="item.image" 
          :alt="item.name"
          class="w-20 h-20 rounded-lg object-cover flex-shrink-0"
        />
        <div class="flex-1 min-w-0">
          <h4 class="text-sm font-medium text-gray-800 line-clamp-2">{{ item.name }}</h4>
          <div class="flex flex-wrap gap-1 mt-1">
            <span 
              v-if="item.specs?.color"
              class="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded"
            >
              {{ getColorName(item.specs.color) }}
            </span>
            <span 
              v-if="item.specs?.size"
              class="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded"
            >
              {{ getSizeName(item.specs.size) }}
            </span>
          </div>
          <div class="flex items-center justify-between mt-2">
            <span class="text-red-500 font-bold">¥{{ item.price }}</span>
            <span class="text-sm text-gray-500">x{{ item.quantity }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 配送方式 -->
    <div class="bg-white mt-2 px-4 py-3">
      <h3 class="font-medium mb-3">配送方式</h3>
      <div class="flex gap-3">
        <button 
          v-for="method in shippingMethods" 
          :key="method.id"
          class="flex-1 p-3 rounded-lg border-2 transition-all"
          :class="selectedShipping === method.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'"
          @click="selectedShipping = method.id"
        >
          <p class="text-sm font-medium">{{ method.name }}</p>
          <p class="text-xs text-gray-500 mt-1">{{ method.description }}</p>
          <p class="text-sm text-blue-500 mt-1">
            {{ method.fee > 0 ? `¥${method.fee}` : '免运费' }}
          </p>
        </button>
      </div>
    </div>

    <!-- 订单备注 -->
    <div class="bg-white mt-2 px-4 py-3">
      <h3 class="font-medium mb-3">订单备注（选填）</h3>
      <textarea 
        v-model="orderRemark"
        placeholder="请输入订单备注信息..."
        class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        rows="2"
        maxlength="100"
      ></textarea>
      <p class="text-xs text-gray-400 mt-1 text-right">{{ orderRemark.length }}/100</p>
    </div>

    <!-- 价格明细 -->
    <div class="bg-white mt-2 px-4 py-3">
      <h3 class="font-medium mb-3">价格明细</h3>
      <div class="space-y-2 text-sm">
        <div class="flex justify-between">
          <span class="text-gray-500">商品总价</span>
          <span>¥{{ cartStore.totalPrice.toFixed(2) }}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-gray-500">运费</span>
          <span :class="currentShippingFee > 0 ? '' : 'text-green-500'">
            {{ currentShippingFee > 0 ? `¥${currentShippingFee}` : '免运费' }}
          </span>
        </div>
        <div v-if="cartStore.totalDiscount > 0" class="flex justify-between">
          <span class="text-gray-500">优惠</span>
          <span class="text-green-500">-¥{{ cartStore.totalDiscount.toFixed(1) }}</span>
        </div>
        <div class="flex justify-between pt-2 border-t border-gray-100">
          <span class="font-medium">实付款</span>
          <span class="text-red-500 font-bold text-lg">¥{{ totalAmount.toFixed(2) }}</span>
        </div>
      </div>
    </div>

    <!-- 底部提交栏 -->
    <div class="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-3 z-50" :style="{ maxWidth: '480px', margin: '0 auto' }">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm">
            共 <span class="text-blue-500 font-medium">{{ cartStore.selectedCount }}</span> 件商品
          </p>
          <p class="text-sm">
            实付: <span class="text-red-500 font-bold text-lg">¥{{ totalAmount.toFixed(2) }}</span>
          </p>
        </div>
        <button 
          @click="submitOrder"
          :disabled="!selectedAddress || cartStore.selectedCount === 0"
          class="px-8 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          提交订单
        </button>
      </div>
    </div>

    <!-- 地址选择弹窗 -->
    <div v-if="showAddressModal" class="fixed inset-0 bg-black/50 z-50 flex items-end" @click.self="showAddressModal = false">
      <div class="bg-white w-full rounded-t-2xl max-h-[70vh] overflow-hidden" :style="{ maxWidth: '480px', margin: '0 auto' }">
        <div class="flex items-center justify-between px-4 py-3 border-b">
          <h3 class="font-medium">选择收货地址</h3>
          <button @click="showAddressModal = false">
            <X class="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div class="overflow-y-auto max-h-[50vh]">
          <div 
            v-for="addr in userStore.addresses" 
            :key="addr.id"
            class="px-4 py-3 border-b border-gray-50 cursor-pointer hover:bg-gray-50"
            @click="selectAddress(addr)"
          >
            <div class="flex items-center gap-2">
              <span class="font-medium">{{ addr.name }}</span>
              <span class="text-gray-500">{{ addr.phone }}</span>
              <span v-if="addr.isDefault" class="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded">默认</span>
            </div>
            <p class="text-sm text-gray-600 mt-1">
              {{ addr.province }}{{ addr.city }}{{ addr.district }}{{ addr.detail }}
            </p>
          </div>
          <button 
            @click="showAddAddress = true"
            class="w-full py-3 text-blue-500 text-sm"
          >
            + 新增地址
          </button>
        </div>
      </div>
    </div>

    <!-- 支付成功弹窗 -->
    <div v-if="showSuccessModal" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div class="bg-white rounded-2xl p-6 text-center max-w-sm w-full">
        <div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Check class="w-8 h-8 text-green-500" />
        </div>
        <h3 class="text-lg font-bold mb-2">下单成功</h3>
        <p class="text-gray-500 text-sm mb-4">您的订单已提交，请及时支付</p>
        <div class="flex gap-3">
          <button 
            @click="goToOrders"
            class="flex-1 py-2 border border-gray-200 rounded-lg text-gray-600"
          >
            查看订单
          </button>
          <button 
            @click="goToShop"
            class="flex-1 py-2 bg-blue-500 text-white rounded-lg"
          >
            继续购物
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
  ChevronRight, 
  X, 
  Check 
} from 'lucide-vue-next'
import { useCartStore } from '@/stores/cart'
import { useUserStore } from '@/stores/user'
import { COLORS, SIZES } from '@/data/products'
import { createOrder } from '@/data/orders'

const router = useRouter()
const cartStore = useCartStore()
const userStore = useUserStore()

const showAddressModal = ref(false)
const showAddAddress = ref(false)
const showSuccessModal = ref(false)
const selectedAddress = ref(null)
const selectedShipping = ref('standard')
const orderRemark = ref('')

const shippingMethods = [
  { id: 'standard', name: '标准配送', description: '预计3-5天送达', fee: 10 },
  { id: 'express', name: '急速配送', description: '预计1-2天送达', fee: 20 }
]

const currentShippingFee = computed(() => {
  const method = shippingMethods.find(m => m.id === selectedShipping.value)
  const totalPrice = cartStore.totalPrice.value
  if (totalPrice >= 99) return 0
  return method?.fee || 0
})

const totalAmount = computed(() => {
  return cartStore.totalPrice.value + currentShippingFee.value
})

function goBack() {
  router.back()
}

function getColorName(colorId) {
  const color = COLORS.find(c => c.id === colorId)
  return color?.name || colorId
}

function getSizeName(sizeId) {
  const size = SIZES.find(s => s.id === sizeId)
  return size?.name || sizeId
}

function selectAddress(addr) {
  selectedAddress.value = addr
  showAddressModal.value = false
}

function submitOrder() {
  if (!selectedAddress.value || cartStore.selectedCount.value === 0) return
  
  const orderItems = cartStore.selectedItems.value.map(item => ({
    productId: item.productId,
    name: item.name,
    image: item.image,
    price: item.price,
    originalPrice: item.originalPrice,
    quantity: item.quantity,
    specs: item.specs
  }))
  
  const orderData = {
    totalAmount: cartStore.totalPrice.value,
    discountAmount: cartStore.totalDiscount.value,
    shippingFee: currentShippingFee.value,
    actualAmount: totalAmount.value,
    pointsEarned: 0,
    paymentMethod: null,
    shippingAddress: {
      name: selectedAddress.value.name,
      phone: selectedAddress.value.phone,
      province: selectedAddress.value.province,
      city: selectedAddress.value.city,
      district: selectedAddress.value.district,
      detail: selectedAddress.value.detail
    },
    items: orderItems,
    remark: orderRemark.value
  }
  
  createOrder(orderData)
  
  cartStore.clearSelectedItems()
  
  showSuccessModal.value = true
}

function goToOrders() {
  showSuccessModal.value = false
  router.push('/orders')
}

function goToShop() {
  showSuccessModal.value = false
  router.push('/shop')
}
</script>
