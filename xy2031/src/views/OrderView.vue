<template>
  <div class="order-view pb-20 min-h-screen bg-gray-50">
    <!-- 顶部导航 -->
    <div class="sticky top-0 bg-white z-10 px-4 py-3 shadow-sm">
      <div class="flex items-center">
        <h1 class="text-lg font-bold flex-1 text-center">我的订单</h1>
      </div>
    </div>

    <!-- 状态筛选 -->
    <div class="bg-white px-4 py-3 flex justify-around sticky top-14 z-10 border-b">
      <button 
        v-for="tab in tabs" 
        :key="tab.id"
        class="flex flex-col items-center gap-1"
        :class="activeTab === tab.id ? 'text-blue-500' : 'text-gray-600'"
        @click="setActiveTab(tab.id)"
      >
        <span class="text-sm font-medium">{{ tab.label }}</span>
        <div 
          class="w-8 h-0.5 rounded-full"
          :class="activeTab === tab.id ? 'bg-blue-500' : 'bg-transparent'"
        ></div>
      </button>
    </div>

    <!-- 订单列表 -->
    <div v-if="filteredOrders.length > 0" class="mt-3 space-y-3">
      <div 
        v-for="order in filteredOrders" 
        :key="order.id"
        class="bg-white mx-4 rounded-lg shadow-sm overflow-hidden"
        @click="goToOrderDetail(order.id)"
      >
        <!-- 订单状态 -->
        <div class="flex justify-between items-center px-4 py-3 border-b">
          <span class="text-sm text-gray-600">订单号：{{ order.orderNo }}</span>
          <span class="text-sm font-medium" :class="getOrderStatus(order.status).color">
            {{ getOrderStatus(order.status).name }}
          </span>
        </div>

        <!-- 商品列表 -->
        <div class="px-4 py-3 space-y-3">
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

        <!-- 订单信息 -->
        <div class="px-4 py-3 border-t bg-gray-50">
          <div class="flex justify-between items-center">
            <span class="text-sm text-gray-600">共{{ order.items.length }}件商品</span>
            <span class="text-sm text-gray-600">
              实付：<span class="text-red-500 font-bold">¥{{ order.actualAmount }}</span>
            </span>
          </div>
        </div>

        <!-- 操作按钮 -->
        <div v-if="order.canCancel || order.canReturn || order.status === 'pending_payment'" class="px-4 py-3 flex justify-end gap-3 border-t">
          <button 
            v-if="order.status === 'pending_payment'"
            class="px-4 py-1.5 text-sm text-white bg-red-500 rounded-full"
            @click.stop="handlePay(order)"
          >
            立即支付
          </button>
          <button 
            v-if="order.canCancel"
            class="px-4 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-full"
            @click.stop="handleCancel(order)"
          >
            取消订单
          </button>
          <button 
            v-if="order.canReturn"
            class="px-4 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-full"
            @click.stop="handleReturn(order)"
          >
            申请退货
          </button>
          <button 
            v-if="order.status === 'delivered'"
            class="px-4 py-1.5 text-sm text-white bg-blue-500 rounded-full"
            @click.stop="handleReview(order)"
          >
            评价
          </button>
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-else class="flex flex-col items-center justify-center py-20">
      <Inbox class="w-20 h-20 text-gray-300" />
      <p class="text-gray-400 mt-4">暂无订单</p>
      <router-link 
        to="/shop" 
        class="mt-4 px-6 py-2 bg-blue-500 text-white rounded-full text-sm"
      >
        去逛逛
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
import { useRouter } from 'vue-router'
import { Inbox } from 'lucide-vue-next'
import { ORDERS, getOrdersByUserId, getOrderStatusInfo, cancelOrder, applyReturn, payOrder } from '@/data/orders'

const router = useRouter()

const activeTab = ref('all')
const orders = ref([...ORDERS])
const showCancelModal = ref(false)
const showReturnModal = ref(false)
const selectedOrder = ref(null)
const cancelReason = ref('')
const returnReason = ref('')
const returnDesc = ref('')
const toast = ref({ show: false, message: '' })

const tabs = [
  { id: 'all', label: '全部' },
  { id: 'pending_payment', label: '待支付' },
  { id: 'pending_shipment', label: '待发货' },
  { id: 'shipped', label: '已发货' },
  { id: 'delivered', label: '已签收' }
]

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

const filteredOrders = computed(() => {
  if (activeTab.value === 'all') {
    return orders.value
  }
  return orders.value.filter(order => order.status === activeTab.value)
})

function setActiveTab(tabId) {
  activeTab.value = tabId
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

function goToOrderDetail(orderId) {
  router.push(`/order/${orderId}`)
}

function handlePay(order) {
  showToast('支付功能演示')
}

function handleCancel(order) {
  selectedOrder.value = order
  cancelReason.value = cancelReasons[0]
  showCancelModal.value = true
}

function handleReturn(order) {
  selectedOrder.value = order
  returnReason.value = returnReasons[0]
  returnDesc.value = ''
  showReturnModal.value = true
}

function handleReview(order) {
  showToast('评价功能演示')
}

function confirmCancel() {
  if (selectedOrder.value && cancelReason.value) {
    const index = orders.value.findIndex(o => o.id === selectedOrder.value.id)
    if (index !== -1) {
      orders.value[index].status = 'cancelled'
      orders.value[index].canCancel = false
    }
    showCancelModal.value = false
    showToast('订单已取消')
  }
}

function confirmReturn() {
  if (selectedOrder.value && returnReason.value) {
    const index = orders.value.findIndex(o => o.id === selectedOrder.value.id)
    if (index !== -1) {
      orders.value[index].returnStatus = 'pending'
      orders.value[index].canReturn = false
    }
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
</script>
