<template>
  <div class="page">
    <div class="header">
      <button class="header-btn" @click="goBack">
        ←
      </button>
      <h1 class="header-title">积分中心</h1>
      <div class="header-placeholder"></div>
    </div>

    <div class="page-content">
      <div class="points-header bg-primary p-6 text-white text-center">
        <div class="text-sm opacity-90 mb-1">我的积分</div>
        <div class="text-4xl font-bold mb-2">{{ userPoints }}</div>
        <div class="text-sm opacity-90">
          当前等级：Lv.{{ userLevel }}
        </div>
      </div>

      <div class="tasks-section p-4 bg-white mt-2">
        <h3 class="section-title text-base font-bold mb-3">每日任务</h3>
        <div class="tasks-list">
          <div class="task-item flex items-center justify-between p-3 bg-secondary/10 rounded-lg mb-2">
            <div class="flex items-center gap-3">
              <span class="text-xl">📅</span>
              <div>
                <div class="font-medium text-sm">每日签到</div>
                <div class="text-xs text-secondary">+50积分</div>
              </div>
            </div>
            <button class="btn btn-primary py-1 text-sm" @click="doSignin">
              签到
            </button>
          </div>
          <div class="task-item flex items-center justify-between p-3 bg-secondary/10 rounded-lg mb-2">
            <div class="flex items-center gap-3">
              <span class="text-xl">📖</span>
              <div>
                <div class="font-medium text-sm">浏览3个菜谱</div>
                <div class="text-xs text-secondary">+20积分</div>
              </div>
            </div>
            <span class="text-sm text-secondary">已完成</span>
          </div>
          <div class="task-item flex items-center justify-between p-3 bg-secondary/10 rounded-lg mb-2">
            <div class="flex items-center gap-3">
              <span class="text-xl">💬</span>
              <div>
                <div class="font-medium text-sm">发表一条评论</div>
                <div class="text-xs text-secondary">+30积分</div>
              </div>
            </div>
            <span class="text-sm text-secondary">去完成</span>
          </div>
          <div class="task-item flex items-center justify-between p-3 bg-secondary/10 rounded-lg">
            <div class="flex items-center gap-3">
              <span class="text-xl">❤️</span>
              <div>
                <div class="font-medium text-sm">收藏2个菜谱</div>
                <div class="text-xs text-secondary">+15积分</div>
              </div>
            </div>
            <span class="text-sm text-secondary">已完成</span>
          </div>
        </div>
      </div>

      <div class="exchange-section p-4 bg-white mt-2">
        <h3 class="section-title text-base font-bold mb-3">积分兑换</h3>
        <div class="exchange-grid grid grid-cols-2 gap-3">
          <div class="exchange-item card p-3 text-center">
            <div class="text-3xl mb-2">🎫</div>
            <div class="font-medium text-sm mb-1">满50减10优惠券</div>
            <div class="text-primary text-sm">100积分</div>
            <button class="btn btn-outline w-full mt-2 py-1 text-xs" @click="exchangeCoupon(100, '满50减10')">
              立即兑换
            </button>
          </div>
          <div class="exchange-item card p-3 text-center">
            <div class="text-3xl mb-2">🎁</div>
            <div class="font-medium text-sm mb-1">转盘抽奖次数+1</div>
            <div class="text-primary text-sm">50积分</div>
            <button class="btn btn-outline w-full mt-2 py-1 text-xs" @click="exchangeChance(50)">
              立即兑换
            </button>
          </div>
          <div class="exchange-item card p-3 text-center">
            <div class="text-3xl mb-2">🎨</div>
            <div class="font-medium text-sm mb-1">专属主题皮肤</div>
            <div class="text-primary text-sm">200积分</div>
            <button class="btn btn-outline w-full mt-2 py-1 text-xs" @click="exchangeTheme(200)">
              立即兑换
            </button>
          </div>
          <div class="exchange-item card p-3 text-center">
            <div class="text-3xl mb-2">⭐</div>
            <div class="font-medium text-sm mb-1">VIP会员1天</div>
            <div class="text-primary text-sm">500积分</div>
            <button class="btn btn-outline w-full mt-2 py-1 text-xs" @click="exchangeVip(500)">
              立即兑换
            </button>
          </div>
        </div>
      </div>

      <div class="history-section p-4 bg-white mt-2">
        <h3 class="section-title text-base font-bold mb-3">积分明细</h3>
        <div class="history-list">
          <div 
            v-for="item in pointsHistory" 
            :key="item.id"
            class="history-item flex items-center justify-between py-3 border-b"
          >
            <div>
              <div class="font-medium text-sm">{{ item.description }}</div>
              <div class="text-xs text-secondary">{{ item.date }}</div>
            </div>
            <div 
              class="font-medium"
              :class="item.type === 'income' ? 'text-success' : 'text-danger'"
            >
              {{ item.type === 'income' ? '+' : '-' }}{{ item.amount }}
            </div>
          </div>
        </div>
      </div>

      <div class="p-4"></div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/userStore'
import { pointsHistory } from '@/data/mockData'

const router = useRouter()
const userStore = useUserStore()

const userPoints = computed(() => userStore.userPoints)
const userLevel = computed(() => userStore.userLevel)

const goBack = () => {
  router.back()
}

const doSignin = () => {
  userStore.addPoints(50, '每日签到')
  alert('签到成功！获得50积分')
}

const exchangeCoupon = (points, name) => {
  if (userStore.usePoints(points, `兑换${name}优惠券`)) {
    alert(`兑换成功！${name}优惠券已发放到账户`)
  } else {
    alert('积分不足')
  }
}

const exchangeChance = (points) => {
  if (userStore.usePoints(points, '兑换转盘抽奖次数')) {
    userStore.addExtraWheelChance(1)
    alert('兑换成功！转盘抽奖次数+1')
  } else {
    alert('积分不足')
  }
}

const exchangeTheme = (points) => {
  if (userStore.usePoints(points, '兑换专属主题皮肤')) {
    alert('兑换成功！专属主题已解锁')
  } else {
    alert('积分不足')
  }
}

const exchangeVip = (points) => {
  if (userStore.usePoints(points, '兑换VIP会员1天')) {
    alert('兑换成功！VIP会员已生效')
  } else {
    alert('积分不足')
  }
}
</script>

<style scoped>
.points-header {
  background: linear-gradient(135deg, var(--primary-color), var(--primary-light));
  padding-top: calc(24px + env(safe-area-inset-top));
}

.section-title {
  color: var(--text-primary);
}

.exchange-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.text-success {
  color: var(--success-color);
}

.text-danger {
  color: var(--danger-color);
}
</style>
