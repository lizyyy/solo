import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '@/views/HomeView.vue'
import CitySelectorView from '@/views/CitySelectorView.vue'
import CityDetailView from '@/views/CityDetailView.vue'
import ShopView from '@/views/ShopView.vue'
import ProductDetailView from '@/views/ProductDetailView.vue'
import CustomizeView from '@/views/CustomizeView.vue'
import OrderView from '@/views/OrderView.vue'
import OrderDetailView from '@/views/OrderDetailView.vue'
import CommunityView from '@/views/CommunityView.vue'
import PostDetailView from '@/views/PostDetailView.vue'
import ProfileView from '@/views/ProfileView.vue'
import ThemeSelectorView from '@/views/ThemeSelectorView.vue'
import ServiceView from '@/views/ServiceView.vue'
import CartView from '@/views/CartView.vue'
import CheckoutView from '@/views/CheckoutView.vue'

const routes = [
  {
    path: '/',
    name: 'home',
    component: HomeView,
    meta: { title: '首页' }
  },
  {
    path: '/cities',
    name: 'cities',
    component: CitySelectorView,
    meta: { title: '城市选择' }
  },
  {
    path: '/city/:cityId',
    name: 'city-detail',
    component: CityDetailView,
    meta: { title: '城市详情' }
  },
  {
    path: '/shop',
    name: 'shop',
    component: ShopView,
    meta: { title: '文创商城' }
  },
  {
    path: '/product/:productId',
    name: 'product-detail',
    component: ProductDetailView,
    meta: { title: '商品详情' }
  },
  {
    path: '/customize',
    name: 'customize',
    component: CustomizeView,
    meta: { title: '文创定制' }
  },
  {
    path: '/orders',
    name: 'orders',
    component: OrderView,
    meta: { title: '我的订单', requiresAuth: true }
  },
  {
    path: '/order/:orderId',
    name: 'order-detail',
    component: OrderDetailView,
    meta: { title: '订单详情', requiresAuth: true }
  },
  {
    path: '/community',
    name: 'community',
    component: CommunityView,
    meta: { title: '文创分享圈' }
  },
  {
    path: '/post/:postId',
    name: 'post-detail',
    component: PostDetailView,
    meta: { title: '帖子详情' }
  },
  {
    path: '/profile',
    name: 'profile',
    component: ProfileView,
    meta: { title: '个人中心' }
  },
  {
    path: '/themes',
    name: 'themes',
    component: ThemeSelectorView,
    meta: { title: '主题选择' }
  },
  {
    path: '/service',
    name: 'service',
    component: ServiceView,
    meta: { title: '客服中心' }
  },
  {
    path: '/cart',
    name: 'cart',
    component: CartView,
    meta: { title: '购物车' }
  },
  {
    path: '/checkout',
    name: 'checkout',
    component: CheckoutView,
    meta: { title: '确认订单', requiresAuth: true }
  }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
})

router.beforeEach((to, from, next) => {
  document.title = `${to.meta.title} - 旅游文创` || '旅游文创'
  next()
})

export default router
