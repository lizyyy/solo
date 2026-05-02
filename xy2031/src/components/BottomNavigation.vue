<template>
  <div class="bottom-nav fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-50" 
       :style="{ maxWidth: '480px', margin: '0 auto' }">
    <div class="flex justify-around items-center py-2 px-4">
      <router-link 
        v-for="item in navItems" 
        :key="item.path"
        :to="item.path"
        class="flex flex-col items-center py-1 px-2 relative"
        :class="{ 'text-blue-500': isActive(item.path) }"
      >
        <div class="relative">
          <component :is="item.icon" class="w-6 h-6" />
          <span 
            v-if="item.badge" 
            class="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center"
          >
            {{ item.badge }}
          </span>
        </div>
        <span class="text-xs mt-1">{{ item.label }}</span>
      </router-link>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { 
  Home, 
  MapPin, 
  ShoppingBag, 
  Users, 
  User,
  ShoppingCart
} from 'lucide-vue-next'
import { useCartStore } from '@/stores/cart'

const route = useRoute()
const cartStore = useCartStore()

const navItems = computed(() => [
  {
    path: '/',
    label: '首页',
    icon: Home,
    badge: null
  },
  {
    path: '/cities',
    label: '城市',
    icon: MapPin,
    badge: null
  },
  {
    path: '/shop',
    label: '商城',
    icon: ShoppingBag,
    badge: null
  },
  {
    path: '/cart',
    label: '购物车',
    icon: ShoppingCart,
    badge: cartStore.cartCount > 0 ? cartStore.cartCount : null
  },
  {
    path: '/community',
    label: '分享圈',
    icon: Users,
    badge: null
  },
  {
    path: '/profile',
    label: '我的',
    icon: User,
    badge: null
  }
])

function isActive(path) {
  if (path === '/') {
    return route.path === '/'
  }
  return route.path.startsWith(path)
}
</script>

<style scoped>
.bottom-nav {
  padding-bottom: env(safe-area-inset-bottom, 0);
}
</style>
