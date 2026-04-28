<template>
  <div class="cart-page">
    <div class="page-header">
      <h1>购物车</h1>
      <div v-if="userStore.cart.length > 0" class="edit-btn" @click="toggleEditMode">
        {{ isEditMode ? '完成' : '编辑' }}
      </div>
    </div>

    <div v-if="userStore.cart.length === 0" class="empty-cart">
      <div class="empty-icon">🛒</div>
      <p class="empty-text">购物车空空如也~</p>
      <p class="empty-hint">快去商城挑选喜欢的周边吧</p>
      <button class="go-shop-btn" @click="goToShop">
        去逛逛
      </button>
    </div>

    <div v-else class="cart-content">
      <div class="cart-list">
        <div
          v-for="item in userStore.cart"
          :key="item.productId"
          class="cart-item"
        >
          <div
            class="checkbox-wrapper"
            @click="toggleSelect(item.productId)"
          >
            <span class="checkbox" :class="{ checked: item.selected }">
              {{ item.selected ? '✓' : '' }}
            </span>
          </div>
          <div class="item-image" @click="goToDetail(item.productId)">
            <img :src="item.product.image" :alt="item.product.name" />
          </div>
          <div class="item-info">
            <h3 class="item-name" @click="goToDetail(item.productId)">
              {{ item.product.name }}
            </h3>
            <div class="item-tags">
              <span
                v-for="tag in item.product.tags.slice(0, 2)"
                :key="tag"
                class="tag"
              >
                {{ tag }}
              </span>
            </div>
          </div>
          <div class="item-price-row">
            <span class="item-price">¥{{ item.product.price }}</span>
            <div class="quantity-control">
              <button
                class="qty-btn"
                :disabled="item.quantity <= 1"
                @click="decreaseQty(item.productId)"
              >
                −
              </button>
              <span class="qty-display">{{ item.quantity }}</span>
              <button
                class="qty-btn"
                :disabled="item.quantity >= item.product.stock"
                @click="increaseQty(item.productId)"
              >
                +
              </button>
            </div>
          </div>
          <div
            v-if="isEditMode"
            class="delete-btn"
            @click="removeItem(item.productId)"
          >
            删除
          </div>
        </div>
      </div>

      <div class="cart-total-section">
        <div class="select-all-row">
          <div
            class="checkbox-wrapper"
            @click="toggleSelectAll"
          >
            <span class="checkbox" :class="{ checked: isAllSelected }">
              {{ isAllSelected ? '✓' : '' }}
            </span>
          </div>
          <span class="select-all-text">全选</span>
        </div>
        <div class="total-info">
          <span class="total-label">合计：</span>
          <span class="total-price">¥{{ userStore.cartTotal }}</span>
        </div>
        <button
          class="checkout-btn"
          :disabled="userStore.selectedCartItems.length === 0"
          @click="checkout"
        >
          结算 ({{ userStore.selectedCartItems.length }})
        </button>
      </div>
    </div>

    <div v-if="showToast" class="toast" :class="{ show: showToast }">
      {{ toastMessage }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/store/userStore'
import type { Order, Address } from '@/types'
import dayjs from 'dayjs'

const router = useRouter()
const userStore = useUserStore()

const isEditMode = ref(false)
const showToast = ref(false)
const toastMessage = ref('')

const isAllSelected = computed(() => {
  return userStore.cart.length > 0 && 
         userStore.cart.every(item => item.selected)
})

function toggleEditMode(): void {
  isEditMode.value = !isEditMode.value
}

function toggleSelect(productId: string): void {
  userStore.toggleCartItemSelection(productId)
}

function toggleSelectAll(): void {
  const newSelected = !isAllSelected.value
  userStore.toggleAllCartItems(newSelected)
}

function decreaseQty(productId: string): void {
  const item = userStore.cart.find(i => i.productId === productId)
  if (item && item.quantity > 1) {
    userStore.updateCartQuantity(productId, item.quantity - 1)
  }
}

function increaseQty(productId: string): void {
  const item = userStore.cart.find(i => i.productId === productId)
  if (item && item.quantity < item.product.stock) {
    userStore.updateCartQuantity(productId, item.quantity + 1)
  }
}

function removeItem(productId: string): void {
  userStore.removeFromCart(productId)
  showToastMessage('已移除商品')
}

function goToShop(): void {
  router.push('/shop')
}

function goToDetail(productId: string): void {
  router.push(`/shop/${productId}`)
}

function showToastMessage(message: string): void {
  toastMessage.value = message
  showToast.value = true
  setTimeout(() => {
    showToast.value = false
  }, 2000)
}

function generateOrderNo(): string {
  const timestamp = dayjs().format('YYYYMMDDHHmmss')
  const random = Math.random().toString(36).substring(2, 8).toUpperCase()
  return `SM${timestamp}${random}`
}

function checkout(): void {
  const selectedItems = userStore.selectedCartItems
  
  if (selectedItems.length === 0) {
    showToastMessage('请选择要结算的商品')
    return
  }

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
    items: selectedItems.map(item => ({ ...item })),
    totalPrice: userStore.cartTotal,
    status: 'paid',
    createTime: dayjs().format('YYYY-MM-DD HH:mm:ss'),
    payTime: dayjs().format('YYYY-MM-DD HH:mm:ss'),
    address: defaultAddress
  }

  userStore.addOrder(order)
  
  const pointsEarned = Math.floor(userStore.cartTotal * 0.1)
  userStore.addPoints(pointsEarned)

  userStore.clearSelectedCartItems()

  showToastMessage(`下单成功！获得 ${pointsEarned} 积分`)
  
  setTimeout(() => {
    router.push('/orders')
  }, 1500)
}
</script>

<style lang="scss" scoped>
.cart-page {
  padding-bottom: 100px;
  background: #f5f5f5;
  min-height: 100vh;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: white;

  h1 {
    font-size: 20px;
    font-weight: 700;
    color: #333;
  }

  .edit-btn {
    font-size: 14px;
    color: #c44569;
    cursor: pointer;
  }
}

.empty-cart {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;

  .empty-icon {
    font-size: 64px;
    margin-bottom: 16px;
    opacity: 0.6;
  }

  .empty-text {
    font-size: 16px;
    color: #666;
    margin-bottom: 8px;
  }

  .empty-hint {
    font-size: 13px;
    color: #999;
    margin-bottom: 24px;
  }

  .go-shop-btn {
    padding: 12px 40px;
    background: linear-gradient(135deg, #ff6b9d, #c44569, #8854d0);
    color: white;
    border: none;
    border-radius: 25px;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      opacity: 0.9;
    }
  }
}

.cart-content {
  padding: 12px;
}

.cart-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 20px;
}

.cart-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.checkbox-wrapper {
  cursor: pointer;

  .checkbox {
    width: 22px;
    height: 22px;
    border: 2px solid #ddd;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    color: white;
    transition: all 0.2s;

    &.checked {
      background: linear-gradient(135deg, #ff6b9d, #c44569);
      border-color: #c44569;
    }
  }
}

.item-image {
  width: 80px;
  height: 80px;
  border-radius: 8px;
  overflow: hidden;
  background: #fafafa;
  cursor: pointer;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.item-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.item-name {
  font-size: 14px;
  font-weight: 600;
  color: #333;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  cursor: pointer;
}

.item-tags {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;

  .tag {
    font-size: 10px;
    padding: 2px 6px;
    background: linear-gradient(135deg, rgba(255, 107, 157, 0.1), rgba(136, 84, 208, 0.1));
    color: #c44569;
    border-radius: 4px;
  }
}

.item-price-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.item-price {
  font-size: 16px;
  font-weight: 700;
  color: #c44569;
}

.quantity-control {
  display: flex;
  align-items: center;
  gap: 8px;

  .qty-btn {
    width: 28px;
    height: 28px;
    border: 1px solid #ddd;
    background: #fafafa;
    border-radius: 6px;
    font-size: 18px;
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
    }
  }

  .qty-display {
    font-size: 14px;
    font-weight: 600;
    min-width: 24px;
    text-align: center;
    color: #333;
  }
}

.delete-btn {
  padding: 6px 12px;
  background: #ff6b6b;
  color: white;
  font-size: 12px;
  border-radius: 4px;
  cursor: pointer;
}

.cart-total-section {
  position: fixed;
  bottom: 60px;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  padding: 12px 16px;
  padding-bottom: calc(12px + env(safe-area-inset-bottom));
  background: white;
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.08);
  z-index: 100;
}

.select-all-row {
  display: flex;
  align-items: center;
  gap: 6px;

  .select-all-text {
    font-size: 14px;
    color: #333;
  }
}

.total-info {
  margin-left: auto;
  display: flex;
  align-items: baseline;
  gap: 4px;
  margin-right: 12px;

  .total-label {
    font-size: 14px;
    color: #666;
  }

  .total-price {
    font-size: 20px;
    font-weight: 700;
    color: #c44569;
  }
}

.checkout-btn {
  padding: 12px 24px;
  background: linear-gradient(135deg, #ff6b9d, #c44569, #8854d0);
  color: white;
  border: none;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &:hover:not(:disabled) {
    opacity: 0.9;
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
</style>
