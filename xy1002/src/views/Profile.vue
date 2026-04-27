<template>
  <div class="profile-page">
    <div class="profile-header">
      <div class="user-info">
        <div class="avatar-wrapper">
          <img :src="userStore.user.avatar" alt="头像" class="avatar" />
          <div class="vip-badge">
            <span class="vip-icon">⭐</span>
            <span class="vip-level">V{{ userStore.user.level }}</span>
          </div>
        </div>
        <div class="info-text">
          <h2 class="nickname">{{ userStore.user.nickname }}</h2>
          <p class="level-name">{{ userStore.user.levelName }}</p>
          <p class="phone">{{ userStore.user.phone }}</p>
        </div>
      </div>

      <div class="points-card">
        <div class="points-info">
          <span class="points-label">当前积分</span>
          <span class="points-value">{{ userStore.user.points }}</span>
        </div>
        <div class="level-progress">
          <div class="progress-bar">
            <div 
              class="progress-fill"
              :style="{ width: progressPercentage + '%' }"
            ></div>
          </div>
          <div class="progress-text">
            <span>距离下一等级</span>
            <span class="points-need">{{ nextLevelPoints }}</span>
            <span>积分</span>
          </div>
        </div>
      </div>
    </div>

    <div class="section-block">
      <div class="section-header">
        <span class="section-title">我的订单</span>
        <span class="section-more" @click="goToOrders">
          查看全部 →
        </span>
      </div>
      <div class="order-tabs">
        <div class="order-tab-item" @click="goToOrders">
          <div class="tab-icon">💳</div>
          <span class="tab-label">待付款</span>
          <span v-if="pendingOrderCount > 0" class="tab-badge">{{ pendingOrderCount }}</span>
        </div>
        <div class="order-tab-item" @click="goToOrders">
          <div class="tab-icon">📦</div>
          <span class="tab-label">待发货</span>
          <span v-if="paidOrderCount > 0" class="tab-badge">{{ paidOrderCount }}</span>
        </div>
        <div class="order-tab-item" @click="goToOrders">
          <div class="tab-icon">🚚</div>
          <span class="tab-label">已发货</span>
          <span v-if="shippedOrderCount > 0" class="tab-badge">{{ shippedOrderCount }}</span>
        </div>
        <div class="order-tab-item" @click="goToOrders">
          <div class="tab-icon">✨</div>
          <span class="tab-label">已完成</span>
        </div>
        <div class="order-tab-item" @click="goToOrders">
          <div class="tab-icon">↩️</div>
          <span class="tab-label">退换货</span>
        </div>
      </div>
    </div>

    <div class="section-block">
      <div class="section-header">
        <span class="section-title">我的收藏</span>
      </div>
      <div class="menu-list">
        <div class="menu-item" @click="goToFavorites">
          <div class="menu-icon-wrapper">
            <span class="menu-icon">❤️</span>
          </div>
          <span class="menu-text">收藏的商品</span>
          <span class="menu-count">{{ userStore.user.favoriteProducts.length }}</span>
          <span class="menu-arrow">›</span>
        </div>
        <div class="menu-item" @click="goToFavorites">
          <div class="menu-icon-wrapper">
            <span class="menu-icon">🏆</span>
          </div>
          <span class="menu-text">收藏的选手</span>
          <span class="menu-count">{{ userStore.user.favoritePlayers.length }}</span>
          <span class="menu-arrow">›</span>
        </div>
      </div>
    </div>

    <div class="section-block">
      <div class="section-header">
        <span class="section-title">会员特权</span>
      </div>
      <div class="privilege-grid">
        <div class="privilege-item" @click="showPrivilegeDetail('birthday')">
          <div class="privilege-icon">🎁</div>
          <span class="privilege-text">生日礼包</span>
        </div>
        <div class="privilege-item" @click="showPrivilegeDetail('priority')">
          <div class="privilege-icon">🎫</div>
          <span class="privilege-text">活动优先</span>
        </div>
        <div class="privilege-item" @click="showPrivilegeDetail('double')">
          <div class="privilege-icon">💎</div>
          <span class="privilege-text">积分加倍</span>
        </div>
        <div class="privilege-item" @click="showPrivilegeDetail('exclusive')">
          <div class="privilege-icon">🎨</div>
          <span class="privilege-text">专属周边</span>
        </div>
      </div>
    </div>

    <div class="section-block">
      <div class="section-header">
        <span class="section-title">其他服务</span>
      </div>
      <div class="menu-list">
        <div class="menu-item" @click="goToFanService">
          <div class="menu-icon-wrapper">
            <span class="menu-icon">💬</span>
          </div>
          <span class="menu-text">留言墙</span>
          <span class="menu-arrow">›</span>
        </div>
        <div class="menu-item" @click="showAddressSettings">
          <div class="menu-icon-wrapper">
            <span class="menu-icon">📍</span>
          </div>
          <span class="menu-text">收货地址</span>
          <span class="menu-arrow">›</span>
        </div>
        <div class="menu-item" @click="showSettings">
          <div class="menu-icon-wrapper">
            <span class="menu-icon">⚙️</span>
          </div>
          <span class="menu-text">设置</span>
          <span class="menu-arrow">›</span>
        </div>
      </div>
    </div>

    <!-- 会员特权详情弹窗 -->
    <div v-if="showPrivilegeModal" class="modal-overlay" @click="showPrivilegeModal = false">
      <div class="modal-content" @click.stop>
        <button class="close-btn" @click="showPrivilegeModal = false">✕</button>
        <h2 class="modal-title">{{ currentPrivilege?.title }}</h2>
        <div class="privilege-detail">
          <div class="privilege-detail-icon">{{ currentPrivilege?.icon }}</div>
          <p class="privilege-detail-desc">{{ currentPrivilege?.description }}</p>
          <div class="privilege-level-info">
            <span class="level-badge">V{{ userStore.user.level }} 会员</span>
            <span class="level-status">
              {{ userStore.user.level >= currentPrivilege?.level ? '✓ 已解锁' : '🔒 未解锁' }}
            </span>
          </div>
        </div>
        <button class="btn btn-primary" @click="showPrivilegeModal = false">
          我知道了
        </button>
      </div>
    </div>

    <!-- 设置弹窗 -->
    <div v-if="showSettingsModal" class="modal-overlay" @click="showSettingsModal = false">
      <div class="modal-content" @click.stop>
        <button class="close-btn" @click="showSettingsModal = false">✕</button>
        <h2 class="modal-title">设置</h2>
        <div class="settings-list">
          <div class="setting-item" @click="showAbout">
            <span class="setting-text">关于我们</span>
            <span class="menu-arrow">›</span>
          </div>
          <div class="setting-item" @click="clearCache">
            <span class="setting-text">清除缓存</span>
            <span class="menu-arrow">›</span>
          </div>
          <div class="setting-item" @click="showFeedback">
            <span class="setting-text">意见反馈</span>
            <span class="menu-arrow">›</span>
          </div>
          <div class="setting-item" @click="showPrivacy">
            <span class="setting-text">隐私政策</span>
            <span class="menu-arrow">›</span>
          </div>
        </div>
      </div>
    </div>

    <div class="app-info">
      <p class="app-version">星芒电竞 v1.0.0</p>
      <p class="app-copyright">© 2024 星芒电竞俱乐部 版权所有</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/store/userStore'

const router = useRouter()
const userStore = useUserStore()

const showPrivilegeModal = ref(false)
const showSettingsModal = ref(false)

const privileges = {
  birthday: {
    title: '生日礼包',
    icon: '🎁',
    level: 2,
    description: '每年生日当天，V2及以上会员可领取专属生日礼包！礼包包含：100积分、限定头像框、随机周边一件。生日福利将在生日当天自动发放到您的账户中，请注意查收！'
  },
  priority: {
    title: '活动优先',
    icon: '🎫',
    level: 1,
    description: '所有会员均可享受活动优先参与权！粉丝见面会、线下活动、限量周边发售等，会员用户可提前1小时开始报名/抢购。VIP3及以上会员更有专属活动通道！'
  },
  double: {
    title: '积分加倍',
    icon: '💎',
    level: 3,
    description: 'V3及以上会员在商城消费可享受积分加倍特权！普通会员消费1元获得1积分，V3会员获得2积分，V4会员获得3积分，V5及以上会员获得4积分！积分可用于兑换周边、参与抽奖等。'
  },
  exclusive: {
    title: '专属周边',
    icon: '🎨',
    level: 4,
    description: 'V4及以上会员可购买会员专属限定周边！专属周边包括：选手签名款、限定配色、独家编号等。每季度会更新专属周边款式，敬请期待！'
  }
}

const currentPrivilege = ref<any>(null)

const progressPercentage = computed(() => {
  const currentPoints = userStore.user.points
  const nextLevelPoints = userStore.user.nextLevelPoints
  const prevLevelPoints = nextLevelPoints - 2000
  const total = nextLevelPoints - prevLevelPoints
  const current = currentPoints - prevLevelPoints
  return Math.min(100, Math.max(0, (current / total) * 100))
})

const nextLevelPoints = computed(() => {
  return Math.max(0, userStore.user.nextLevelPoints - userStore.user.points)
})

const pendingOrderCount = computed(() => {
  return userStore.orders.filter(o => o.status === 'pending').length
})

const paidOrderCount = computed(() => {
  return userStore.orders.filter(o => o.status === 'paid').length
})

const shippedOrderCount = computed(() => {
  return userStore.orders.filter(o => o.status === 'shipped').length
})

function goToOrders(): void {
  router.push('/orders')
}

function goToFavorites(): void {
  router.push('/favorites')
}

function goToFanService(): void {
  router.push('/fan-service')
}

function showPrivilegeDetail(type: string): void {
  if (type in privileges) {
    currentPrivilege.value = (privileges as any)[type]
    showPrivilegeModal.value = true
  }
}

function showAddressSettings(): void {
  alert('收货地址管理功能开发中...\n\n当前默认地址：\n上海市浦东新区张江高科技园区科苑路88号\n收件人：星芒小粉丝\n电话：138****8888')
}

function showSettings(): void {
  showSettingsModal.value = true
}

function showAbout(): void {
  showSettingsModal.value = false
  alert('星芒电竞俱乐部 v1.0.0\n\n成立于2019年，是中国最具影响力的电竞俱乐部之一。\n\n我们的愿景：让电竞成为一种生活方式\n\n联系邮箱：support@starlight.com')
}

function clearCache(): void {
  if (confirm('确定要清除缓存吗？\n\n这将清空本地存储的所有数据，包括：\n• 购物车\n• 订单记录\n• 留言\n• 积分\n• 收藏')) {
    localStorage.clear()
    alert('缓存已清除！页面即将刷新...')
    location.reload()
  }
}

function showFeedback(): void {
  showSettingsModal.value = false
  alert('意见反馈功能开发中...\n\n您可以通过以下方式反馈：\n• 客服热线：400-888-8888\n• 邮箱：support@starlight.com\n• 粉丝服务页面留言')
}

function showPrivacy(): void {
  showSettingsModal.value = false
  alert('隐私政策\n\n星芒电竞俱乐部非常重视您的隐私保护。\n\n我们收集的信息：\n• 基本账户信息（昵称、头像）\n• 购物和订单信息\n• 浏览行为数据\n\n我们承诺：\n• 不会向第三方出售您的个人信息\n• 采用加密技术保护您的数据安全\n• 您有权随时查看和删除个人数据\n\n如需了解更多，请访问官方网站。')
}
</script>

<style lang="scss" scoped>
.profile-page {
  padding-bottom: 80px;
  background: #f5f5f5;
  min-height: 100vh;
}

.profile-header {
  background: linear-gradient(135deg, #ff6b9d 0%, #c44569 30%, #8854d0 100%);
  padding: 24px 20px;
  padding-bottom: 36px;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 20px;
}

.avatar-wrapper {
  position: relative;

  .avatar {
    width: 72px;
    height: 72px;
    border-radius: 50%;
    border: 3px solid rgba(255, 255, 255, 0.5);
  }

  .vip-badge {
    position: absolute;
    bottom: -2px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 2px;
    background: linear-gradient(135deg, #ffd700, #ffaa00);
    padding: 2px 8px;
    border-radius: 10px;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);

    .vip-icon {
      font-size: 10px;
    }

    .vip-level {
      font-size: 10px;
      font-weight: 700;
      color: #8b4513;
    }
  }
}

.info-text {
  color: white;

  .nickname {
    font-size: 20px;
    font-weight: 700;
    margin-bottom: 4px;
  }

  .level-name {
    font-size: 13px;
    opacity: 0.9;
    margin-bottom: 2px;
  }

  .phone {
    font-size: 12px;
    opacity: 0.8;
  }
}

.points-card {
  background: rgba(255, 255, 255, 0.95);
  border-radius: 16px;
  padding: 16px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.points-info {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 12px;

  .points-label {
    font-size: 14px;
    color: #666;
  }

  .points-value {
    font-size: 28px;
    font-weight: 700;
    background: linear-gradient(135deg, #ff6b9d, #8854d0);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
}

.level-progress {
  .progress-bar {
    height: 8px;
    background: #f0f0f0;
    border-radius: 4px;
    overflow: hidden;
    margin-bottom: 8px;

    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #ff6b9d, #8854d0);
      border-radius: 4px;
      transition: width 0.3s ease;
    }
  }

  .progress-text {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    color: #999;

    .points-need {
      color: #c44569;
      font-weight: 600;
    }
  }
}

.section-block {
  background: white;
  margin-bottom: 10px;
  padding: 16px 20px;

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;

    .section-title {
      font-size: 16px;
      font-weight: 700;
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

    .section-more {
      font-size: 13px;
      color: #c44569;
      cursor: pointer;
    }
  }
}

.order-tabs {
  display: flex;
  justify-content: space-around;
}

.order-tab-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  position: relative;
  padding: 4px;

  .tab-icon {
    font-size: 28px;
  }

  .tab-label {
    font-size: 12px;
    color: #666;
  }

  .tab-badge {
    position: absolute;
    top: 0;
    right: 0;
    min-width: 16px;
    height: 16px;
    background: #ff6b6b;
    color: white;
    font-size: 10px;
    font-weight: 700;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 4px;
  }

  &:active {
    opacity: 0.8;
  }
}

.menu-list {
  display: flex;
  flex-direction: column;
}

.menu-item {
  display: flex;
  align-items: center;
  padding: 14px 0;
  border-bottom: 1px solid #f5f5f5;
  cursor: pointer;

  &:last-child {
    border-bottom: none;
  }

  .menu-icon-wrapper {
    width: 32px;
    height: 32px;
    background: linear-gradient(135deg, rgba(255, 107, 157, 0.1), rgba(136, 84, 208, 0.1));
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-right: 12px;

    .menu-icon {
      font-size: 18px;
    }
  }

  .menu-text {
    flex: 1;
    font-size: 15px;
    color: #333;
  }

  .menu-count {
    font-size: 13px;
    color: #999;
    margin-right: 8px;
  }

  .menu-arrow {
    font-size: 18px;
    color: #ccc;
  }

  &:active {
    opacity: 0.8;
  }
}

.privilege-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

.privilege-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  cursor: pointer;

  .privilege-icon {
    font-size: 32px;
  }

  .privilege-text {
    font-size: 12px;
    color: #666;
  }

  &:active {
    opacity: 0.8;
  }
}

.app-info {
  padding: 24px 20px;
  text-align: center;

  .app-version {
    font-size: 12px;
    color: #999;
    margin-bottom: 4px;
  }

  .app-copyright {
    font-size: 11px;
    color: #ccc;
  }
}

/* 弹窗样式 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.modal-content {
  background: white;
  border-radius: 20px;
  padding: 24px;
  max-width: 360px;
  width: 100%;
  position: relative;
  max-height: 80vh;
  overflow-y: auto;

  .close-btn {
    position: absolute;
    top: 16px;
    right: 16px;
    width: 28px;
    height: 28px;
    border: none;
    background: #f5f5f5;
    border-radius: 50%;
    font-size: 16px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;

    &:hover {
      background: #e8e8e8;
    }
  }

  .modal-title {
    font-size: 20px;
    font-weight: 700;
    color: #333;
    margin-bottom: 20px;
    padding-right: 40px;
  }
}

/* 会员特权详情 */
.privilege-detail {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  margin-bottom: 20px;

  .privilege-detail-icon {
    font-size: 64px;
    margin-bottom: 16px;
  }

  .privilege-detail-desc {
    font-size: 14px;
    color: #666;
    line-height: 1.8;
    margin-bottom: 16px;
  }

  .privilege-level-info {
    display: flex;
    gap: 12px;
    align-items: center;

    .level-badge {
      background: linear-gradient(135deg, #ffd700, #ffaa00);
      color: #8b4513;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 700;
    }

    .level-status {
      font-size: 13px;
      color: #c44569;
      font-weight: 600;
    }
  }
}

/* 设置列表 */
.settings-list {
  display: flex;
  flex-direction: column;
  gap: 4px;

  .setting-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 0;
    border-bottom: 1px solid #f5f5f5;
    cursor: pointer;
    transition: all 0.2s;

    &:last-child {
      border-bottom: none;
    }

    &:active {
      opacity: 0.7;
    }

    .setting-text {
      font-size: 15px;
      color: #333;
    }

    .menu-arrow {
      font-size: 18px;
      color: #ccc;
    }
  }
}

.btn {
  width: 100%;
  padding: 14px 24px;
  border-radius: 25px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  border: none;

  &.btn-primary {
    background: linear-gradient(135deg, #ff6b9d, #c44569, #8854d0);
    color: white;

    &:hover {
      opacity: 0.9;
    }
  }

  &.btn-secondary {
    background: #f5f5f5;
    color: #666;

    &:hover {
      background: #e8e8e8;
    }
  }
}
</style>
