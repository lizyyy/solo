<template>
  <div class="orders-page">
    <div class="page-header">
      <div class="back-btn" @click="goBack">
        <span class="back-icon">←</span>
      </div>
      <h1>我的订单</h1>
    </div>

    <div class="order-tabs">
      <div
        v-for="tab in orderTabs"
        :key="tab.value"
        :class="['order-tab', { active: selectedTab === tab.value }]"
        @click="selectedTab = tab.value"
      >
        {{ tab.label }}
      </div>
    </div>

    <div v-if="filteredOrders.length === 0" class="empty-state">
      <div class="empty-icon">📋</div>
      <p class="empty-text">暂无订单</p>
      <p class="empty-hint">快去商城挑选喜欢的周边吧</p>
      <button class="go-shop-btn" @click="goToShop">
        去逛逛
      </button>
    </div>

    <div v-else class="orders-list">
      <div
        v-for="order in filteredOrders"
        :key="order.id"
        class="order-card"
      >
        <div class="order-header">
          <span class="order-no">订单号：{{ order.orderNo }}</span>
          <span :class="['order-status', order.status]">
            {{ getStatusLabel(order.status) }}
          </span>
        </div>

        <div class="order-items">
          <div
            v-for="item in order.items"
            :key="item.productId"
            class="order-item"
            @click="goToDetail(item.productId)"
          >
            <div class="item-image">
              <img :src="item.product.image" :alt="item.product.name" />
            </div>
            <div class="item-info">
              <h3 class="item-name">{{ item.product.name }}</h3>
              <div class="item-price-row">
                <span class="item-price">¥{{ item.product.price }}</span>
                <span class="item-quantity">x{{ item.quantity }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="order-footer">
          <div class="order-time">
            <span>下单时间：{{ order.createTime }}</span>
          </div>
          <div class="order-total-row">
            <span class="total-label">共{{ order.items.length }}件商品</span>
            <span class="total-text">
              订单金额：<span class="total-price">¥{{ order.totalPrice }}</span>
            </span>
          </div>
          <div class="order-actions" v-if="order.status === 'paid' || order.status === 'shipped' || order.status === 'delivered'">
            <button v-if="order.status === 'paid'" class="action-btn secondary" @click="cancelOrder(order)">
              取消订单
            </button>
            <button v-if="order.status === 'shipped'" class="action-btn primary" @click="confirmDelivery(order)">
              确认收货
            </button>
            <button v-if="order.status === 'delivered'" class="action-btn secondary" @click="applyAfterSales(order)">
              申请售后
            </button>
            <button class="action-btn primary" @click="contactCustomerService()">
              联系客服
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/store/userStore'
import type { Order } from '@/types'

const router = useRouter()
const userStore = useUserStore()

const selectedTab = ref('all')

const orderTabs = [
  { label: '全部', value: 'all' },
  { label: '待付款', value: 'pending' },
  { label: '待发货', value: 'paid' },
  { label: '待收货', value: 'shipped' },
  { label: '已完成', value: 'delivered' }
]

const filteredOrders = computed<Order[]>(() => {
  if (selectedTab.value === 'all') {
    return userStore.orders
  }
  return userStore.orders.filter(order => order.status === selectedTab.value)
})

function getStatusLabel(status: string): string {
  const statusMap: Record<string, string> = {
    pending: '待付款',
    paid: '待发货',
    shipped: '待收货',
    delivered: '已完成',
    cancelled: '已取消'
  }
  return statusMap[status] || status
}

function goBack(): void {
  router.back()
}

function goToShop(): void {
  router.push('/shop')
}

function goToDetail(productId: string): void {
  router.push(`/shop/${productId}`)
}

function cancelOrder(order: Order): void {
  if (confirm('确定要取消订单吗？')) {
    const index = userStore.orders.findIndex(o => o.id === order.id)
    if (index > -1) {
      userStore.orders[index].status = 'cancelled'
    }
    alert('订单已取消')
  }
}

function confirmDelivery(order: Order): void {
  if (confirm('确认已收到商品吗？')) {
    const index = userStore.orders.findIndex(o => o.id === order.id)
    if (index > -1) {
      userStore.orders[index].status = 'delivered'
    }
    alert('确认收货成功！')
  }
}

function applyAfterSales(order: Order): void {
  alert(`订单 ${order.orderNo} 售后申请已提交，客服将在24小时内联系您。`)
}

function contactCustomerService(): void {
  alert('客服热线：400-888-8888\n工作时间：9:00-21:00\n\n或在粉丝服务页面点击"客服"查看更多联系方式。')
}
</script>

<style lang="scss" scoped>
.orders-page {
  padding-bottom: 80px;
  background: #f5f5f5;
  min-height: 100vh;
}

.page-header {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  background: white;
  position: relative;

  .back-btn {
    position: absolute;
    left: 16px;
    top: 50%;
    transform: translateY(-50%);
    cursor: pointer;

    .back-icon {
      font-size: 20px;
      color: #333;
    }
  }

  h1 {
    flex: 1;
    text-align: center;
    font-size: 18px;
    font-weight: 700;
    color: #333;
  }
}

.order-tabs {
  display: flex;
  background: white;
  border-bottom: 1px solid #f0f0f0;
  padding: 0 8px;
}

.order-tab {
  flex: 1;
  padding: 14px 8px;
  text-align: center;
  font-size: 14px;
  color: #666;
  cursor: pointer;
  position: relative;
  transition: all 0.2s;

  &.active {
    color: #c44569;
    font-weight: 600;

    &::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 50%;
      transform: translateX(-50%);
      width: 32px;
      height: 3px;
      background: linear-gradient(90deg, #ff6b9d, #8854d0);
      border-radius: 2px;
    }
  }
}

.empty-state {
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

.orders-list {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.order-card {
  background: white;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.order-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #f5f5f5;

  .order-no {
    font-size: 12px;
    color: #999;
  }

  .order-status {
    font-size: 13px;
    font-weight: 600;

    &.pending {
      color: #ff9500;
    }

    &.paid {
      color: #5ac8fa;
    }

    &.shipped {
      color: #007aff;
    }

    &.delivered {
      color: #34c759;
    }

    &.cancelled {
      color: #999;
    }
  }
}

.order-items {
  padding: 12px 16px;
}

.order-item {
  display: flex;
  gap: 12px;
  cursor: pointer;
  padding: 4px 0;
}

.item-image {
  width: 64px;
  height: 64px;
  border-radius: 8px;
  overflow: hidden;
  background: #fafafa;
  flex-shrink: 0;

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
  justify-content: space-between;
}

.item-name {
  font-size: 14px;
  color: #333;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.item-price-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}

.item-price {
  font-size: 15px;
  font-weight: 600;
  color: #c44569;
}

.item-quantity {
  font-size: 13px;
  color: #999;
}

.order-footer {
  padding: 12px 16px;
  border-top: 1px solid #f5f5f5;
}

.order-time {
  font-size: 12px;
  color: #999;
  margin-bottom: 8px;
}

.order-total-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;

  .total-label {
    font-size: 12px;
    color: #999;
  }

  .total-text {
    font-size: 13px;
    color: #666;

    .total-price {
      font-size: 18px;
      font-weight: 700;
      color: #c44569;
    }
  }
}

.order-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.action-btn {
  padding: 8px 20px;
  border-radius: 20px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
  border: none;

  &.primary {
    background: linear-gradient(135deg, #ff6b9d, #c44569, #8854d0);
    color: white;
  }

  &.secondary {
    background: #f5f5f5;
    color: #666;
    border: 1px solid #ddd;
  }

  &:hover {
    opacity: 0.9;
  }
}
</style>
