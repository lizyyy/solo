<template>
  <div class="product-detail-page">
    <div class="back-header" @click="goBack">
      <span class="back-icon">←</span>
      <span class="back-text">返回</span>
    </div>

    <div v-if="product" class="product-content">
      <div class="product-image-section">
        <img :src="product.image" :alt="product.name" class="main-image" />
        <div
          v-if="product.originalPrice"
          class="discount-badge"
        >
          限时特惠
        </div>
      </div>

      <div class="product-info-section">
        <div class="price-row">
          <span class="current-price">¥{{ product.price }}</span>
          <span v-if="product.originalPrice" class="original-price">
            ¥{{ product.originalPrice }}
          </span>
          <span v-if="product.originalPrice" class="save-price">
            立省 ¥{{ product.originalPrice - product.price }}
          </span>
        </div>

        <h1 class="product-name">{{ product.name }}</h1>

        <div class="product-tags">
          <span
            v-for="tag in product.tags"
            :key="tag"
            class="tag"
          >
            {{ tag }}
          </span>
        </div>

        <div class="product-stats">
          <div class="stat-item">
            <span class="stat-label">已售</span>
            <span class="stat-value">{{ product.sales }}</span>
          </div>
          <div class="stat-divider"></div>
          <div class="stat-item">
            <span class="stat-label">库存</span>
            <span class="stat-value" :class="{ 'low-stock': product.stock < 100 }">
              {{ product.stock }}
            </span>
          </div>
        </div>
      </div>

      <div class="section-block">
        <div class="section-header">
          <span class="section-title">商品详情</span>
        </div>
        <p class="product-description">{{ product.description }}</p>
      </div>

      <div class="section-block">
        <div class="section-header">
          <span class="section-title">购买数量</span>
        </div>
        <div class="quantity-selector">
          <button
            class="quantity-btn"
            :disabled="quantity <= 1"
            @click="decreaseQuantity"
          >
            −
          </button>
          <span class="quantity-display">{{ quantity }}</span>
          <button
            class="quantity-btn"
            :disabled="quantity >= product.stock"
            @click="increaseQuantity"
          >
            +
          </button>
        </div>
        <p v-if="product.stock < 10" class="stock-warning">
          ⚠️ 仅剩 {{ product.stock }} 件，欲购从速！
        </p>
      </div>

      <div class="section-block">
        <div class="section-header">
          <span class="section-title">温馨提示</span>
        </div>
        <ul class="tips-list">
          <li>📦 下单后48小时内发货</li>
          <li>🎁 满199元包邮</li>
          <li>🔄 支持7天无理由退换</li>
          <li>💬 如有问题请联系客服</li>
        </ul>
      </div>
    </div>

    <div v-else class="loading-state">
      <div class="loading-spinner">⏳</div>
      <p>加载中...</p>
    </div>

    <div v-if="product" class="bottom-action-bar">
      <div class="action-btn favorite" @click="toggleFavorite">
        <span class="action-icon">{{ isFavorite ? '❤️' : '🤍' }}</span>
        <span class="action-text">收藏</span>
      </div>
      <div class="action-btn cart" @click="addToCart">
        <span class="action-icon">🛒</span>
        <span class="action-text">加入购物车</span>
      </div>
      <div class="action-btn buy" @click="buyNow">
        <span class="action-text">立即购买</span>
        <span class="action-subtext">¥{{ (product.price * quantity).toFixed(0) }}</span>
      </div>
    </div>

    <div v-if="showToast" class="toast" :class="{ show: showToast }">
      {{ toastMessage }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/store/userStore'
import { mockProducts } from '@/data/mockData'
import type { Product, Order, Address } from '@/types'
import dayjs from 'dayjs'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const product = ref<Product | null>(null)
const quantity = ref(1)
const showToast = ref(false)
const toastMessage = ref('')

const isFavorite = computed(() => {
  if (!product.value) return false
  return userStore.user.favoriteProducts.includes(product.value.id)
})

function loadProduct(): void {
  const productId = route.params.id as string
  const found = mockProducts.find(p => p.id === productId)
  if (found) {
    product.value = found
  } else {
    router.push('/shop')
  }
}

function goBack(): void {
  router.back()
}

function decreaseQuantity(): void {
  if (quantity.value > 1) {
    quantity.value--
  }
}

function increaseQuantity(): void {
  if (product.value && quantity.value < product.value.stock) {
    quantity.value++
  }
}

function showToastMessage(message: string): void {
  toastMessage.value = message
  showToast.value = true
  setTimeout(() => {
    showToast.value = false
  }, 2000)
}

function toggleFavorite(): void {
  if (!product.value) return
  userStore.toggleFavoriteProduct(product.value.id)
  showToastMessage(isFavorite.value ? '已添加到收藏' : '已取消收藏')
}

function addToCart(): void {
  if (!product.value) return
  userStore.addToCart(product.value.id, product.value, quantity.value)
  showToastMessage(`已添加 ${quantity.value} 件到购物车`)
}

function generateOrderNo(): string {
  const timestamp = dayjs().format('YYYYMMDDHHmmss')
  const random = Math.random().toString(36).substring(2, 8).toUpperCase()
  return `SM${timestamp}${random}`
}

function buyNow(): void {
  if (!product.value) return

  const defaultAddress: Address = {
    id: 'addr001',
    name: '星芒小粉丝',
    phone: '138****8888',
    province: '上海市',
    city: '上海市',
    district: '浦东新区',
    detail: '张江高科技园区科苑路88号',
    isDefault: true
  }

  const order: Order = {
    id: `order_${Date.now()}`,
    orderNo: generateOrderNo(),
    items: [{
      productId: product.value.id,
      product: product.value,
      quantity: quantity.value,
      selected: true
    }],
    totalPrice: product.value.price * quantity.value,
    status: 'paid',
    createTime: dayjs().format('YYYY-MM-DD HH:mm:ss'),
    payTime: dayjs().format('YYYY-MM-DD HH:mm:ss'),
    address: defaultAddress
  }

  userStore.addOrder(order)
  
  const pointsEarned = Math.floor(product.value.price * quantity.value * 0.1)
  userStore.addPoints(pointsEarned)

  showToastMessage(`下单成功！获得 ${pointsEarned} 积分`)
  
  setTimeout(() => {
    router.push('/orders')
  }, 1500)
}

onMounted(() => {
  loadProduct()
})
</script>

<style lang="scss" scoped>
.product-detail-page {
  padding-bottom: 160px;
  background: #f5f5f5;
  min-height: 100vh;
}

.back-header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  cursor: pointer;

  .back-icon {
    font-size: 18px;
    color: #333;
  }

  .back-text {
    font-size: 14px;
    color: #333;
  }
}

.product-content {
  padding-top: 48px;
}

.product-image-section {
  position: relative;
  width: 100%;
  background: white;

  .main-image {
    width: 100%;
    aspect-ratio: 1;
    object-fit: cover;
  }

  .discount-badge {
    position: absolute;
    top: 60px;
    right: 16px;
    background: linear-gradient(135deg, #ff6b6b, #ee5a5a);
    color: white;
    font-size: 12px;
    font-weight: 600;
    padding: 6px 12px;
    border-radius: 4px;
  }
}

.product-info-section {
  background: white;
  padding: 16px;
  margin-bottom: 10px;
}

.price-row {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 12px;

  .current-price {
    font-size: 28px;
    font-weight: 700;
    color: #c44569;
  }

  .original-price {
    font-size: 14px;
    color: #999;
    text-decoration: line-through;
  }

  .save-price {
    font-size: 12px;
    color: #ff6b6b;
    background: rgba(255, 107, 107, 0.1);
    padding: 2px 6px;
    border-radius: 4px;
  }
}

.product-name {
  font-size: 18px;
  font-weight: 600;
  color: #333;
  line-height: 1.5;
  margin-bottom: 12px;
}

.product-tags {
  display: flex;
  gap: 6px;
  margin-bottom: 16px;
  flex-wrap: wrap;

  .tag {
    font-size: 12px;
    padding: 4px 10px;
    background: linear-gradient(135deg, rgba(255, 107, 157, 0.1), rgba(136, 84, 208, 0.1));
    color: #c44569;
    border-radius: 4px;
  }
}

.product-stats {
  display: flex;
  align-items: center;
  gap: 16px;

  .stat-item {
    display: flex;
    flex-direction: column;
    gap: 2px;

    .stat-label {
      font-size: 12px;
      color: #999;
    }

    .stat-value {
      font-size: 16px;
      font-weight: 600;
      color: #333;

      &.low-stock {
        color: #ff6b6b;
      }
    }
  }

  .stat-divider {
    width: 1px;
    height: 30px;
    background: #eee;
  }
}

.section-block {
  background: white;
  margin-bottom: 10px;
  padding: 16px;

  .section-header {
    margin-bottom: 12px;

    .section-title {
      font-size: 16px;
      font-weight: 600;
      color: #333;
      position: relative;
      padding-left: 10px;

      &::before {
        content: '';
        position: absolute;
        left: 0;
        top: 50%;
        transform: translateY(-50%);
        width: 4px;
        height: 16px;
        background: linear-gradient(180deg, #ff6b9d, #8854d0);
        border-radius: 2px;
      }
    }
  }
}

.product-description {
  font-size: 14px;
  color: #666;
  line-height: 1.8;
}

.quantity-selector {
  display: flex;
  align-items: center;
  gap: 16px;

  .quantity-btn {
    width: 36px;
    height: 36px;
    border: 1px solid #ddd;
    background: #fafafa;
    border-radius: 8px;
    font-size: 20px;
    color: #333;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    &:hover:not(:disabled) {
      background: #f0f0f0;
      border-color: #ccc;
    }
  }

  .quantity-display {
    font-size: 18px;
    font-weight: 600;
    min-width: 40px;
    text-align: center;
    color: #333;
  }
}

.stock-warning {
  margin-top: 12px;
  font-size: 13px;
  color: #ff6b6b;
}

.tips-list {
  list-style: none;
  padding: 0;
  margin: 0;

  li {
    font-size: 13px;
    color: #666;
    padding: 6px 0;
    line-height: 1.6;
  }
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 100px 20px;

  .loading-spinner {
    font-size: 48px;
    margin-bottom: 16px;
    animation: spin 1s linear infinite;
  }

  p {
    font-size: 14px;
    color: #999;
  }
}

.bottom-action-bar {
  position: fixed;
  bottom: 70px;
  left: 0;
  right: 0;
  display: flex;
  background: white;
  padding: 10px 16px;
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.08);
  gap: 10px;
  z-index: 100;
}

.action-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 8px 12px;
  border-radius: 20px;
  cursor: pointer;
  transition: all 0.2s;

  .action-icon {
    font-size: 20px;
    margin-bottom: 2px;
  }

  .action-text {
    font-size: 11px;
    color: #666;
  }

  &.favorite {
    background: #fafafa;
    border: 1px solid #eee;

    &:hover {
      background: #f5f5f5;
    }
  }

  &.cart {
    background: linear-gradient(135deg, rgba(255, 107, 157, 0.1), rgba(136, 84, 208, 0.1));
    border: 1px solid rgba(196, 69, 105, 0.3);

    .action-text {
      color: #c44569;
    }

    &:hover {
      background: linear-gradient(135deg, rgba(255, 107, 157, 0.2), rgba(136, 84, 208, 0.2));
    }
  }

  &.buy {
    flex: 1;
    background: linear-gradient(135deg, #ff6b9d, #c44569, #8854d0);
    flex-direction: row;
    gap: 4px;

    .action-text {
      color: white;
      font-size: 14px;
      font-weight: 600;
    }

    .action-subtext {
      color: rgba(255, 255, 255, 0.9);
      font-size: 12px;
    }

    &:hover {
      opacity: 0.9;
    }
  }
}

.toast {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 14px;
  z-index: 1000;
  opacity: 0;
  transition: opacity 0.3s;

  &.show {
    opacity: 1;
  }
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
