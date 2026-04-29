<template>
  <div class="order-detail-view pb-20 min-h-screen bg-gray-50">
    <!-- 顶部导航 -->
    <div class="sticky top-0 bg-white z-10 px-4 py-3 shadow-sm">
      <div class="flex items-center">
        <button @click="goBack" class="p-1">
          <ChevronLeft class="w-6 h-6" />
        </button>
        <h1 class="text-lg font-bold flex-1 text-center">订单详情</h1>
        <div class="w-8"></div>
      </div>
    </div>

    <div v-if="order">
      <!-- 物流状态 -->
      <div class="bg-white px-4 py-6">
        <div class="flex items-center gap-4">
          <div class="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center">
            <Truck class="w-6 h-6 text-blue-500" />
          </div>
          <div class="flex-1">
            <h3 class="text-lg font-bold" :class="getOrderStatus(order.status).color">
              {{ getOrderStatus(order.status).name }}
            </h3>
            <p v-if="order.logistics" class="text-sm text-gray-500 mt-1">
              {{ order.logistics.timeline?.[0]?.description }}
            </p>
            <p v-else class="text-sm text-gray-500 mt-1">
              等待商家发货...
            </p>
          </div>
        </div>
      </div>

      <!-- 物流时间线 -->
      <div v-if="order.logistics && order.logistics.timeline" class="bg-white mt-3 px-4 py-4">
        <h3 class="font-bold mb-4">物流信息</h3>
        <div class="space-y-0">
          <div 
            v-for="(log, index) in order.logistics.timeline" 
            :key="index"
            class="flex gap-4"
          >
            <div class="flex flex-col items-center">
              <div 
                class="w-3 h-3 rounded-full"
                :class="index === 0 ? 'bg-blue-500' : 'bg-gray-300'"
              ></div>
              <div 
                v-if="index < order.logistics.timeline.length - 1"
                class="w-0.5 h-10"
                :class="index === 0 ? 'bg-blue-200' : 'bg-gray-200'"
              ></div>
            </div>
            <div class="flex-1 pb-6">
              <p class="text-sm font-medium" :class="index === 0 ? 'text-blue-500' : 'text-gray-700'">
                {{ log.status }}
              </p>
              <p class="text-xs text-gray-500 mt-1">{{ log.description }}</p>
              <p class="text-xs text-gray-400 mt-1">{{ log.time }}</p>
            </div>
          </div>
        </div>
        <div v-if="order.logistics.company" class="mt-4 pt-4 border-t flex items-center justify-between">
          <span class="text-sm text-gray-500">快递公司</span>
          <span class="text-sm">{{ order.logistics.company }}</span>
        </div>
        <div v-if="order.logistics.trackingNo" class="mt-2 flex items-center justify-between">
          <span class="text-sm text-gray-500">物流单号</span>
          <span class="text-sm">{{ order.logistics.trackingNo }}</span>
        </div>
      </div>

      <!-- 收货地址 -->
      <div class="bg-white mt-3 px-4 py-4">
        <div class="flex items-start gap-3">
          <MapPin class="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
          <div class="flex-1">
            <div class="flex items-center gap-2">
              <span class="font-medium">{{ order.shippingAddress.name }}</span>
              <span class="text-gray-500">{{ order.shippingAddress.phone }}</span>
            </div>
            <p class="text-sm text-gray-600 mt-1">
              {{ order.shippingAddress.province }}{{ order.shippingAddress.city }}{{ order.shippingAddress.district }}{{ order.shippingAddress.detail }}
            </p>
          </div>
        </div>
      </div>

      <!-- 商品列表 -->
      <div class="bg-white mt-3">
        <div class="px-4 py-3 border-b">
          <h3 class="font-bold">商品信息</h3>
        </div>
        <div class="px-4 py-4 space-y-4">
          <div 
            v-for="item in order.items" 
            :key="item.id"
            class="flex gap-3"
          >
            <img 
              :src="item.image" 
              :alt="item.name"
              class="w-20 h-20 rounded-lg object-cover flex-shrink-0"
            />
            <div class="flex-1 min-w-0">
              <h3 class="text-sm font-medium text-gray-800 line-clamp-2">{{ item.name }}</h3>
              <p class="text-xs text-gray-500 mt-1">
                {{ formatSpecs(item.specs) }}
              </p>
              <div class="flex justify-between items-center mt-2">
                <span class="text-red-500 font-bold">¥{{ item.price }}</span>
                <span class="text-xs text-gray-400">x{{ item.quantity }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 订单信息 -->
      <div class="bg-white mt-3 px-4 py-4">
        <h3 class="font-bold mb-3">订单信息</h3>
        <div class="space-y-2 text-sm">
          <div class="flex justify-between">
            <span class="text-gray-500">订单编号</span>
            <span>{{ order.orderNo }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-500">下单时间</span>
            <span>{{ formatDateTime(order.createdAt) }}</span>
          </div>
          <div v-if="order.paidAt" class="flex justify-between">
            <span class="text-gray-500">支付时间</span>
            <span>{{ formatDateTime(order.paidAt) }}</span>
          </div>
          <div v-if="order.paymentMethod" class="flex justify-between">
            <span class="text-gray-500">支付方式</span>
            <span>{{ order.paymentMethod }}</span>
          </div>
        </div>
      </div>

      <!-- 价格明细 -->
      <div class="bg-white mt-3 px-4 py-4">
        <h3 class="font-bold mb-3">价格明细</h3>
        <div class="space-y-2 text-sm">
          <div class="flex justify-between">
            <span class="text-gray-500">商品总价</span>
            <span>¥{{ order.totalAmount }}</span>
          </div>
          <div v-if="order.discountAmount > 0" class="flex justify-between">
            <span class="text-gray-500">优惠金额</span>
            <span class="text-green-500">-¥{{ order.discountAmount }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-500">运费</span>
            <span>{{ order.shippingFee > 0 ? '¥' + order.shippingFee : '免运费' }}</span>
          </div>
          <div class="flex justify-between pt-2 border-t mt-2">
            <span class="font-medium">实付金额</span>
            <span class="text-red-500 font-bold text-lg">¥{{ order.actualAmount }}</span>
          </div>
        </div>
      </div>

      <!-- 底部操作栏 -->
      <div v-if="order.canCancel || order.canReturn || order.status === 'pending_payment'" class="fixed bottom-16 left-0 right-0 bg-white border-t px-4 py-3 flex gap-3">
        <button 
          v-if="order.status === 'pending_payment'"
          class="flex-1 py-2.5 bg-red-500 text-white rounded-full text-sm font-medium"
          @click="handlePay"
        >
          立即支付
        </button>
        <button 
          v-if="order.canCancel"
          class="flex-1 py-2.5 border border-gray-300 text-gray-600 rounded-full text-sm"
          @click="showCancelModal = true"
        >
          取消订单
        </button>
        <button 
          v-if="order.canReturn"
          class="flex-1 py-2.5 border border-gray-300 text-gray-600 rounded-full text-sm"
          @click="showReturnModal = true"
        >
          申请退货
        </button>
        <button 
          v-if="order.status === 'delivered'"
          class="flex-1 py-2.5 bg-blue-500 text-white rounded-full text-sm font-medium"
          @click="handleReview"
        >
          评价
        </button>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-else class="flex flex-col items-center justify-center py-20">
      <Inbox class="w-20 h-20 text-gray-300" />
      <p class="text-gray-400 mt-4">订单不存在</p>
      <router-link 
        to="/orders" 
        class="mt-4 px-6 py-2 bg-blue-500 text-white rounded-full text-sm"
      >
        返回订单列表
      </router-link>
    </div>

    <!-- 取消订单弹窗 -->
    <div v-if="showCancelModal" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" @click="showCancelModal = false">
      <div class="bg-white rounded-2xl w-full max-w-sm overflow-hidden" @click.stop>
        <div class="p-6">
          <h3 class="text-lg font-bold mb-4">取消订单</h3>
          <p class="text-gray-600 text-sm mb-4">请选择取消原因：</p>
          <div class="space-y-2">
            <label 
              v-for="reason in cancelReasons" 
              :key="reason"
              class="flex items-center gap-2 p-3 border rounded-lg cursor-pointer"
              :class="cancelReason === reason ? 'border-blue-500 bg-blue-50' : 'border-gray-200'"
              @click="cancelReason = reason"
            >
              <div 
                class="w-4 h-4 rounded-full border-2 flex items-center justify-center"
                :class="cancelReason === reason ? 'border-blue-500' : 'border-gray-300'"
              >
                <div v-if="cancelReason === reason" class="w-2 h-2 bg-blue-500 rounded-full"></div>
              </div>
              <span class="text-sm">{{ reason }}</span>
            </label>
          </div>
        </div>
        <div class="flex border-t">
          <button class="flex-1 py-3 text-gray-600" @click="showCancelModal = false">取消</button>
          <button class="flex-1 py-3 text-blue-500 font-medium" @click="confirmCancel">确认</button>
        </div>
      </div>
    </div>

    <!-- 退货申请弹窗 -->
    <div v-if="showReturnModal" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" @click="showReturnModal = false">
      <div class="bg-white rounded-2xl w-full max-w-sm overflow-hidden" @click.stop>
        <div class="p-6">
          <h3 class="text-lg font-bold mb-4">申请退货</h3>
          <p class="text-gray-600 text-sm mb-4">请选择退货原因：</p>
          <div class="space-y-2 mb-4">
            <label 
              v-for="reason in returnReasons" 
              :key="reason"
              class="flex items-center gap-2 p-3 border rounded-lg cursor-pointer"
              :class="returnReason === reason ? 'border-blue-500 bg-blue-50' : 'border-gray-200'"
              @click="returnReason = reason"
            >
              <div 
                class="w-4 h-4 rounded-full border-2 flex items-center justify-center"
                :class="returnReason === reason ? 'border-blue-500' : 'border-gray-300'"
              >
                <div v-if="returnReason === reason" class="w-2 h-2 bg-blue-500 rounded-full"></div>
              </div>
              <span class="text-sm">{{ reason }}</span>
            </label>
          </div>
          <div>
            <textarea 
              v-model="returnDesc"
              placeholder="请详细描述退货原因（选填）"
              class="w-full p-3 border rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows="3"
            ></textarea>
          </div>
        </div>
        <div class="flex border-t">
          <button class="flex-1 py-3 text-gray-600" @click="showReturnModal = false">取消</button>
          <button class="flex-1 py-3 text-blue-500 font-medium" @click="confirmReturn">提交申请</button>
        </div>
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
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ChevronLeft, Truck, MapPin, Inbox } from 'lucide-vue-next'
import { getOrderById, getOrderStatusInfo, ORDERS } from '@/data/orders'

const route = useRoute()
const router = useRouter()

const order = ref(null)
const showCancelModal = ref(false)
const showReturnModal = ref(false)
const cancelReason = ref('')
const returnReason = ref('')
const returnDesc = ref('')
const toast = ref({ show: false, message: '' })

const cancelReasons = [
  '不想要了',
  '商品价格问题',
  '商品质量问题',
  '配送问题',
  '其他原因'
]

const returnReasons = [
  '商品质量问题',
  '商品与描述不符',
  '商品损坏',
  '收到商品与订单不符',
  '其他原因'
]

function loadOrder() {
  const orderId = route.params.orderId
  order.value = getOrderById(orderId)
}

function goBack() {
  router.back()
}

function getOrderStatus(status) {
  return getOrderStatusInfo(status)
}

function formatSpecs(specs) {
  if (!specs) return ''
  const parts = []
  if (specs.color) parts.push(`颜色：${specs.color}`)
  if (specs.shape) parts.push(`形状：${specs.shape}`)
  if (specs.size) parts.push(`尺寸：${specs.size}`)
  return parts.join(' / ')
}

function formatDateTime(dateStr) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function handlePay() {
  showToast('支付功能演示')
}

function handleReview() {
  showToast('评价功能演示')
}

function confirmCancel() {
  if (order.value && cancelReason.value) {
    order.value.status = 'cancelled'
    order.value.canCancel = false
    showCancelModal.value = false
    showToast('订单已取消')
  }
}

function confirmReturn() {
  if (order.value && returnReason.value) {
    order.value.returnStatus = 'pending'
    order.value.canReturn = false
    showReturnModal.value = false
    showToast('退货申请已提交')
  }
}

function showToast(message) {
  toast.value = { show: true, message }
  setTimeout(() => {
    toast.value.show = false
  }, 2000)
}

onMounted(() => {
  loadOrder()
})
</script>
