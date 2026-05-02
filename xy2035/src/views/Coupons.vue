<template>
  <div class="page">
    <div class="header">
      <button class="header-btn" @click="goBack">
        ←
      </button>
      <h1 class="header-title">优惠券</h1>
      <div class="header-placeholder"></div>
    </div>

    <div class="coupon-tabs flex p-4 bg-white">
      <button 
        v-for="tab in tabs" 
        :key="tab.id"
        class="coupon-tab flex-1 py-2 text-sm"
        :class="{ active: activeTab === tab.id }"
        @click="activeTab = tab.id"
      >
        {{ tab.name }}
      </button>
    </div>

    <div class="page-content p-4">
      <div v-if="filteredCoupons.length > 0" class="coupons-list">
        <div 
          v-for="coupon in filteredCoupons" 
          :key="coupon.id"
          class="coupon-card mb-4"
          :class="{ expired: coupon.status === 'expired' }"
        >
          <div class="coupon-left bg-primary flex flex-col items-center justify-center text-white rounded-l-lg">
            <div class="coupon-value text-3xl font-bold">
              {{ getCouponValue(coupon) }}
            </div>
            <div class="coupon-unit text-sm">{{ getCouponUnit(coupon) }}</div>
          </div>
          <div class="coupon-right flex-1 bg-white p-4 rounded-r-lg">
            <div class="flex items-start justify-between mb-2">
              <h4 class="font-medium text-base">{{ coupon.title }}</h4>
              <span 
                class="tag text-xs"
                :class="coupon.status === 'available' ? 'tag-success' : 'tag-warning'"
              >
                {{ coupon.status === 'available' ? '可用' : '已过期' }}
              </span>
            </div>
            <p class="text-sm text-secondary mb-2">{{ coupon.description }}</p>
            <div class="flex items-center justify-between">
              <span class="text-xs text-light">
                有效期：{{ coupon.validFrom }} - {{ coupon.validTo }}
              </span>
              <button 
                v-if="coupon.status === 'available'"
                class="btn btn-primary py-1.5 text-sm"
                @click="useCoupon(coupon)"
              >
                立即使用
              </button>
            </div>
          </div>
        </div>
      </div>
      <div v-else class="empty-state">
        <div class="empty-icon">🎫</div>
        <p>暂无{{ activeTab === 'available' ? '可用' : '已过期' }}优惠券</p>
        <p class="text-sm text-secondary mt-1">多关注活动哦</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { coupons } from '@/data/mockData'

const router = useRouter()

const activeTab = ref('available')

const tabs = [
  { id: 'available', name: '可用' },
  { id: 'expired', name: '已过期' }
]

const filteredCoupons = computed(() => {
  return coupons.value.filter(c => c.status === activeTab.value)
})

const goBack = () => {
  router.back()
}

const getCouponValue = (coupon) => {
  if (coupon.discountType === 'percent') {
    return (coupon.percent * 10).toFixed(0) + '折'
  }
  return coupon.reduceAmount
}

const getCouponUnit = (coupon) => {
  if (coupon.discountType === 'percent') {
    return ''
  }
  return '元'
}

const useCoupon = (coupon) => {
  alert(`优惠券 ${coupon.title} 已使用！`)
}
</script>

<style scoped>
.coupon-tabs {
  display: flex;
  background-color: var(--bg-primary);
  border-bottom: 1px solid var(--border-color);
}

.coupon-tab {
  background: none;
  border: none;
  padding: 12px 0;
  font-size: 14px;
  color: var(--text-secondary);
  cursor: pointer;
  position: relative;
}

.coupon-tab.active {
  color: var(--primary-color);
  font-weight: 500;
}

.coupon-tab.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 40px;
  height: 3px;
  background-color: var(--primary-color);
  border-radius: 2px;
}

.coupon-card {
  display: flex;
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: var(--shadow-sm);
}

.coupon-card.expired {
  opacity: 0.6;
}

.coupon-left {
  width: 100px;
  background: linear-gradient(135deg, var(--primary-color), var(--primary-light));
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: white;
  position: relative;
}

.coupon-left::before,
.coupon-left::after {
  content: '';
  position: absolute;
  right: -6px;
  width: 12px;
  height: 12px;
  background-color: var(--bg-secondary);
  border-radius: 50%;
}

.coupon-left::before {
  top: -6px;
}

.coupon-left::after {
  bottom: -6px;
}

.coupon-right {
  flex: 1;
  background-color: var(--bg-primary);
  padding: 16px;
}

.empty-state {
  padding: 64px 24px;
  text-align: center;
}

.empty-icon {
  font-size: 64px;
  margin-bottom: 16px;
  opacity: 0.5;
}
</style>
