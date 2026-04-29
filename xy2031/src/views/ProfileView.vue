<template>
  <div class="profile-view pb-20 min-h-screen bg-gray-50">
    <!-- 用户信息卡片 -->
    <div class="relative">
      <div class="h-48" :style="{ background: `linear-gradient(135deg, ${currentTheme.primary}, ${currentTheme.secondary})` }">
        <div class="absolute top-0 left-0 right-0 px-4 py-3 flex justify-end">
          <button class="p-2 bg-white/20 rounded-full" @click="goToSettings">
            <Settings class="w-5 h-5 text-white" />
          </button>
        </div>
      </div>
      
      <div class="absolute -bottom-16 left-4 right-4">
        <div class="bg-white rounded-2xl shadow-lg p-4">
          <div class="flex items-center gap-4">
            <img 
              :src="user.avatar" 
              :alt="user.username"
              class="w-20 h-20 rounded-full object-cover border-4 border-white shadow"
            />
            <div class="flex-1">
              <h2 class="text-xl font-bold">{{ user.username }}</h2>
              <p class="text-sm text-gray-500 mt-1">{{ user.signature || '这个人很懒，什么都没写' }}</p>
              <div class="flex items-center gap-4 mt-2">
                <span class="text-sm text-gray-500">
                  <span class="font-bold text-gray-800">{{ user.followers }}</span> 粉丝
                </span>
                <span class="text-sm text-gray-500">
                  <span class="font-bold text-gray-800">{{ user.following }}</span> 关注
                </span>
                <span class="text-sm text-gray-500">
                  <span class="font-bold text-gray-800">{{ user.points }}</span> 积分
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 功能入口 -->
    <div class="mt-20 mx-4">
      <!-- 订单相关 -->
      <div class="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div class="flex items-center justify-between px-4 py-3 border-b">
          <h3 class="font-bold flex items-center gap-2">
            <Ticket class="w-5 h-5 text-blue-500" />
            我的订单
          </h3>
          <router-link to="/orders" class="text-sm text-blue-500 flex items-center gap-1">
            全部订单 <ChevronRight class="w-4 h-4" />
          </router-link>
        </div>
        <div class="grid grid-cols-5 py-4">
          <router-link 
            v-for="item in orderMenus" 
            :key="item.path"
            :to="item.path"
            class="flex flex-col items-center gap-2"
          >
            <div class="relative">
              <component :is="item.icon" class="w-6 h-6 text-gray-600" />
              <span 
                v-if="item.badge > 0"
                class="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center"
              >
                {{ item.badge }}
              </span>
            </div>
            <span class="text-xs text-gray-600">{{ item.label }}</span>
          </router-link>
        </div>
      </div>

      <!-- 主题和客服 -->
      <div class="bg-white rounded-2xl shadow-sm overflow-hidden mt-4">
        <router-link to="/themes" class="flex items-center justify-between px-4 py-3 border-b">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center">
              <Palette class="w-5 h-5 text-purple-500" />
            </div>
            <div>
              <p class="font-medium">主题切换</p>
              <p class="text-xs text-gray-500">当前：{{ currentTheme.name }}</p>
            </div>
          </div>
          <ChevronRight class="w-5 h-5 text-gray-400" />
        </router-link>
        
        <router-link to="/service" class="flex items-center justify-between px-4 py-3 border-b">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center">
              <Headphones class="w-5 h-5 text-green-500" />
            </div>
            <div>
              <p class="font-medium">客服中心</p>
              <p class="text-xs text-gray-500">在线客服/客服热线</p>
            </div>
          </div>
          <ChevronRight class="w-5 h-5 text-gray-400" />
        </router-link>
        
        <div class="flex items-center justify-between px-4 py-3">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center">
              <Heart class="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <p class="font-medium">我的收藏</p>
              <p class="text-xs text-gray-500">{{ favoriteCount }}件商品</p>
            </div>
          </div>
          <ChevronRight class="w-5 h-5 text-gray-400" />
        </div>
      </div>

      <!-- 地址和优惠券 -->
      <div class="bg-white rounded-2xl shadow-sm overflow-hidden mt-4">
        <div class="flex items-center justify-between px-4 py-3 border-b">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
              <MapPin class="w-5 h-5 text-red-500" />
            </div>
            <div>
              <p class="font-medium">收货地址</p>
              <p class="text-xs text-gray-500">管理我的收货地址</p>
            </div>
          </div>
          <ChevronRight class="w-5 h-5 text-gray-400" />
        </div>
        
        <div class="flex items-center justify-between px-4 py-3 border-b">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-full bg-yellow-50 flex items-center justify-center">
              <Ticket class="w-5 h-5 text-yellow-500" />
            </div>
            <div>
              <p class="font-medium">优惠券</p>
              <p class="text-xs text-gray-500">3张可用</p>
            </div>
          </div>
          <ChevronRight class="w-5 h-5 text-gray-400" />
        </div>
        
        <div class="flex items-center justify-between px-4 py-3">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
              <Gift class="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p class="font-medium">积分商城</p>
              <p class="text-xs text-gray-500">用积分兑换好礼</p>
            </div>
          </div>
          <ChevronRight class="w-5 h-5 text-gray-400" />
        </div>
      </div>

      <!-- 其他 -->
      <div class="bg-white rounded-2xl shadow-sm overflow-hidden mt-4 mb-4">
        <div class="flex items-center justify-between px-4 py-3 border-b">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
              <MessageCircle class="w-5 h-5 text-gray-500" />
            </div>
            <div>
              <p class="font-medium">意见反馈</p>
              <p class="text-xs text-gray-500">告诉我们您的想法</p>
            </div>
          </div>
          <ChevronRight class="w-5 h-5 text-gray-400" />
        </div>
        
        <div class="flex items-center justify-between px-4 py-3">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
              <Info class="w-5 h-5 text-gray-500" />
            </div>
            <div>
              <p class="font-medium">关于我们</p>
              <p class="text-xs text-gray-500">版本 1.0.0</p>
            </div>
          </div>
          <ChevronRight class="w-5 h-5 text-gray-400" />
        </div>
      </div>
    </div>

    <!-- 主题展示预览 -->
    <div class="mx-4 mb-4">
      <div class="flex items-center justify-between mb-3">
        <h3 class="font-bold">主题预览</h3>
        <router-link to="/themes" class="text-sm text-blue-500">更多</router-link>
      </div>
      <div class="flex gap-3 overflow-x-auto pb-2">
        <div 
          v-for="theme in themeList" 
          :key="theme.id"
          class="flex-shrink-0 w-32 cursor-pointer"
          @click="selectTheme(theme.id)"
        >
          <div 
            class="relative h-20 rounded-lg overflow-hidden mb-2"
            :style="{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})` }"
          >
            <div class="absolute inset-0 flex items-center justify-center text-3xl">
              {{ theme.icon }}
            </div>
            <div 
              v-if="currentThemeId === theme.id"
              class="absolute top-2 right-2 w-5 h-5 bg-white rounded-full flex items-center justify-center"
            >
              <Check class="w-3 h-3 text-green-500" />
            </div>
          </div>
          <p class="text-xs text-center text-gray-600 truncate">{{ theme.name }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { 
  Settings, 
  Ticket, 
  ChevronRight, 
  Palette, 
  Headphones, 
  Heart,
  MapPin,
  Gift,
  MessageCircle,
  Info,
  Package,
  Truck,
  CheckCircle,
  Clock,
  Star,
  Check
} from 'lucide-vue-next'
import { useThemeStore, THEMES } from '@/stores/theme'
import { ORDERS } from '@/data/orders'

const router = useRouter()
const themeStore = useThemeStore()

const currentTheme = computed(() => themeStore.currentTheme)
const currentThemeId = computed(() => themeStore.currentThemeId)
const themeList = computed(() => themeStore.themeList)

const user = {
  id: 'user_001',
  username: '旅行者',
  avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200',
  signature: '走遍天下，收集美好',
  followers: 128,
  following: 56,
  points: 2580
}

const orderMenus = [
  { label: '待支付', icon: Clock, path: '/orders', query: { status: 'pending_payment' }, badge: 1 },
  { label: '待发货', icon: Package, path: '/orders', query: { status: 'pending_shipment' }, badge: 1 },
  { label: '已发货', icon: Truck, path: '/orders', query: { status: 'shipped' }, badge: 1 },
  { label: '已签收', icon: CheckCircle, path: '/orders', query: { status: 'delivered' }, badge: 0 },
  { label: '退款/售后', icon: Star, path: '/orders', badge: 0 }
]

const favoriteCount = 8

function goToSettings() {
  console.log('去设置页')
}

function selectTheme(themeId) {
  themeStore.setTheme(themeId)
}
</script>
