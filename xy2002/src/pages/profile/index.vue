<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { useProfileStore } from '@/stores/profile';
import { useFocusStore } from '@/stores/focus';
import { useTodoStore } from '@/stores/todo';

const profileStore = useProfileStore();
const focusStore = useFocusStore();
const todoStore = useTodoStore();

const showEditNickname = ref(false);
const newNickname = ref('');

const menuItems = [
  {
    icon: '⏰',
    title: '专注记录',
    desc: '查看您的专注历史',
    path: '/pages/profile/focus-records'
  },
  {
    icon: '🏆',
    title: '成就勋章',
    desc: '收集更多成就',
    path: '/pages/profile/achievements'
  },
  {
    icon: '🎨',
    title: '主题皮肤',
    desc: '选择您喜欢的主题',
    path: '/pages/profile/settings'
  },
  {
    icon: '📊',
    title: '数据统计',
    desc: '查看使用数据',
    path: ''
  },
  {
    icon: '💝',
    title: '关于我们',
    desc: 'HelloKitty计划助手',
    path: ''
  }
];

const unlockedCount = computed(() => profileStore.unlockedAchievements.length);
const totalAchievements = computed(() => profileStore.achievements.length);
const totalFocusHours = computed(() => profileStore.profile.totalFocusHours.toFixed(1));
const totalCompletedTodos = computed(() => profileStore.profile.totalCompletedTodos);
const currentStreak = computed(() => profileStore.profile.currentStreak);
const usingDays = computed(() => profileStore.profile.usingDays);

function editNickname() {
  newNickname.value = profileStore.profile.nickname;
  showEditNickname.value = true;
}

function saveNickname() {
  if (!newNickname.value.trim()) {
    uni.showToast({
      title: '昵称不能为空',
      icon: 'none'
    });
    return;
  }
  profileStore.updateNickname(newNickname.value.trim());
  showEditNickname.value = false;
  uni.showToast({
    title: '保存成功',
    icon: 'success'
  });
}

function chooseAvatar() {
  uni.chooseImage({
    count: 1,
    sizeType: ['compressed'],
    sourceType: ['album', 'camera'],
    success: (res) => {
      profileStore.updateAvatar(res.tempFilePaths[0]);
      uni.showToast({
        title: '头像已更新',
        icon: 'success'
      });
    }
  });
}

function navigateTo(item: typeof menuItems[0]) {
  if (item.path) {
    uni.navigateTo({
      url: item.path
    });
  } else {
    uni.showToast({
      title: '功能开发中',
      icon: 'none'
    });
  }
}

onMounted(() => {
  profileStore.loadProfile();
  profileStore.loadAchievements();
  focusStore.loadRecords();
  todoStore.loadTodos();
});

onShow(() => {
  profileStore.loadProfile();
  profileStore.loadAchievements();
});
</script>

<template>
  <view class="profile-page">
    <view class="kitty-header">
      <view class="kitty-ears">
        <view class="kitty-ear left-ear"></view>
        <view class="kitty-ear right-ear"></view>
        <view class="kitty-bow">🎀</view>
      </view>
      <view class="kitty-title">
        <text class="kitty-icon">🐱</text>
        <text>个人中心</text>
      </view>
      <view class="kitty-whiskers">
        <view class="whisker whisker-left-top"></view>
        <view class="whisker whisker-left-bottom"></view>
        <view class="whisker whisker-right-top"></view>
        <view class="whisker whisker-right-bottom"></view>
      </view>
    </view>
    
    <view class="profile-header card">
      <view class="avatar-section">
        <view class="avatar-container" @click="chooseAvatar">
          <image 
            v-if="profileStore.profile.avatar" 
            :src="profileStore.profile.avatar" 
            class="avatar"
          />
          <view v-else class="avatar-placeholder">
            <text class="kitty-icon">🐱</text>
          </view>
          <view class="edit-avatar-badge">
            <text>📷</text>
          </view>
        </view>
        <view class="user-info">
          <view class="nickname-row" @click="editNickname">
            <text class="nickname">{{ profileStore.profile.nickname }}</text>
            <text class="edit-icon">✏️</text>
          </view>
          <view class="user-stats">
            <text class="stat-item">
              <text class="stat-value">{{ usingDays }}</text>
              <text class="stat-label">使用天数</text>
            </text>
            <text class="stat-divider">|</text>
            <text class="stat-item">
              <text class="stat-value">{{ currentStreak }}</text>
              <text class="stat-label">连续打卡</text>
            </text>
          </view>
        </view>
      </view>

      <view class="quick-stats">
        <view class="quick-stat-item">
          <view class="quick-stat-value">{{ totalFocusHours }}</view>
          <view class="quick-stat-label">专注小时</view>
        </view>
        <view class="quick-stat-divider"></view>
        <view class="quick-stat-item">
          <view class="quick-stat-value">{{ totalCompletedTodos }}</view>
          <view class="quick-stat-label">完成任务</view>
        </view>
        <view class="quick-stat-divider"></view>
        <view class="quick-stat-item">
          <view class="quick-stat-value">{{ unlockedCount }}/{{ totalAchievements }}</view>
          <view class="quick-stat-label">成就勋章</view>
        </view>
      </view>

      <view class="streak-badge" v-if="currentStreak > 0">
        <text class="streak-icon">🔥</text>
        <text class="streak-text">连续专注 {{ currentStreak }} 天</text>
      </view>
    </view>

    <view class="achievement-preview card" @click="navigateTo(menuItems[1])">
      <view class="preview-header">
        <text class="preview-title">🏆 成就进度</text>
        <text class="preview-more">查看全部 ▶</text>
      </view>
      <view class="achievement-icons">
        <view 
          v-for="achievement in profileStore.unlockedAchievements.slice(0, 5)" 
          :key="achievement.id"
          class="achievement-icon unlocked"
          :title="achievement.name"
        >
          <text>{{ achievement.icon }}</text>
        </view>
        <view 
          v-for="achievement in profileStore.lockedAchievements.slice(0, Math.max(0, 5 - unlockedCount))" 
          :key="achievement.id"
          class="achievement-icon locked"
          :title="achievement.name"
        >
          <text>🔒</text>
        </view>
      </view>
      <view class="progress-bar">
        <view class="progress-fill" :style="{ width: `${(unlockedCount / totalAchievements) * 100}%` }"></view>
      </view>
      <view class="progress-text">
        已解锁 {{ unlockedCount }}/{{ totalAchievements }} 个成就
      </view>
    </view>

    <view class="menu-section card">
      <view 
        v-for="item in menuItems" 
        :key="item.title"
        class="menu-item"
        @click="navigateTo(item)"
      >
        <view class="menu-icon">
          <text>{{ item.icon }}</text>
        </view>
        <view class="menu-content">
          <view class="menu-title">{{ item.title }}</view>
          <view class="menu-desc">{{ item.desc }}</view>
        </view>
        <view class="menu-arrow">
          <text>▶</text>
        </view>
      </view>
    </view>

    <view class="footer-section">
      <text class="footer-text">HelloKitty计划助手 v1.0.0</text>
      <text class="footer-text">🎀 可爱陪伴每一天 🎀</text>
    </view>

    <view v-if="showEditNickname" class="modal-overlay" @click="showEditNickname = false">
      <view class="modal-content" @click.stop>
        <view class="modal-title">修改昵称</view>
        <input 
          v-model="newNickname" 
          class="modal-input"
          placeholder="请输入新昵称"
          maxlength="20"
        />
        <view class="modal-actions">
          <view class="modal-btn cancel" @click="showEditNickname = false">取消</view>
          <view class="modal-btn confirm" @click="saveNickname">保存</view>
        </view>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.profile-page {
  min-height: 100vh;
  background-color: $bg-color;
  padding: 24rpx;
  padding-bottom: 40rpx;
}

.kitty-header {
  position: relative;
  padding: 24rpx;
  padding-top: 40rpx;
  text-align: center;
  margin-bottom: 16rpx;
}

.kitty-ears {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 240rpx;
  height: 60rpx;
}

.kitty-ear {
  position: absolute;
  width: 60rpx;
  height: 60rpx;
  background-color: $secondary-color;
  border-radius: 50%;

  &.left-ear {
    left: 20rpx;
    top: 10rpx;
  }

  &.right-ear {
    right: 20rpx;
    top: 10rpx;
  }
}

.kitty-bow {
  position: absolute;
  top: 20rpx;
  left: 50%;
  transform: translateX(-50%);
  font-size: 48rpx;
  z-index: 2;
}

.kitty-title {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  padding-top: 20rpx;
  margin-top: 20rpx;
}

.kitty-title .kitty-icon {
  font-size: 48rpx;
}

.kitty-title text:not(.kitty-icon) {
  font-size: 36rpx;
  font-weight: 700;
  color: $primary-color;
}

.kitty-whiskers {
  position: absolute;
  top: 70rpx;
  left: 50%;
  transform: translateX(-50%);
  width: 100%;
  max-width: 600rpx;
  pointer-events: none;
}

.whisker {
  position: absolute;
  width: 60rpx;
  height: 3rpx;
  background-color: $text-color;

  &.whisker-left-top {
    left: 40rpx;
    top: 0;
    transform: rotate(-15deg);
  }

  &.whisker-left-bottom {
    left: 30rpx;
    top: 20rpx;
    transform: rotate(15deg);
  }

  &.whisker-right-top {
    right: 40rpx;
    top: 0;
    transform: rotate(15deg);
  }

  &.whisker-right-bottom {
    right: 30rpx;
    top: 20rpx;
    transform: rotate(-15deg);
  }
}

.profile-header {
  padding: 32rpx;
  margin-bottom: 24rpx;
}

.avatar-section {
  display: flex;
  align-items: center;
  gap: 24rpx;
  margin-bottom: 24rpx;
}

.avatar-container {
  position: relative;
  width: 140rpx;
  height: 140rpx;
}

.avatar {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  border: 4rpx solid $secondary-color;
}

.avatar-placeholder {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: linear-gradient(135deg, $primary-color, $secondary-color);
  display: flex;
  align-items: center;
  justify-content: center;
  border: 4rpx solid $secondary-color;
}

.kitty-icon {
  font-size: 60rpx;
}

.edit-avatar-badge {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 40rpx;
  height: 40rpx;
  background-color: $white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.1);
  font-size: 20rpx;
}

.user-info {
  flex: 1;
}

.nickname-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 12rpx;
}

.nickname {
  font-size: 36rpx;
  font-weight: 600;
  color: $text-color;
}

.edit-icon {
  font-size: 24rpx;
  color: $text-muted;
}

.user-stats {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 6rpx;
}

.stat-value {
  font-size: 28rpx;
  font-weight: 600;
  color: $primary-color;
}

.stat-label {
  font-size: 24rpx;
  color: $text-muted;
}

.stat-divider {
  font-size: 24rpx;
  color: $border-color;
}

.quick-stats {
  display: flex;
  align-items: center;
  justify-content: space-around;
  padding: 24rpx 0;
  border-top: 1rpx solid $border-color;
  border-bottom: 1rpx solid $border-color;
  margin-bottom: 24rpx;
}

.quick-stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.quick-stat-value {
  font-size: 40rpx;
  font-weight: 700;
  color: $primary-color;
  margin-bottom: 4rpx;
}

.quick-stat-label {
  font-size: 22rpx;
  color: $text-muted;
}

.quick-stat-divider {
  width: 1rpx;
  height: 50rpx;
  background-color: $border-color;
}

.streak-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  padding: 16rpx 32rpx;
  background: linear-gradient(135deg, #FF6B6B, #FFE66D);
  border-radius: 30rpx;
}

.streak-icon {
  font-size: 28rpx;
}

.streak-text {
  font-size: 24rpx;
  color: $white;
  font-weight: 500;
}

.achievement-preview {
  padding: 24rpx;
  margin-bottom: 24rpx;
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20rpx;
}

.preview-title {
  font-size: 28rpx;
  font-weight: 600;
  color: $text-color;
}

.preview-more {
  font-size: 24rpx;
  color: $text-muted;
}

.achievement-icons {
  display: flex;
  gap: 16rpx;
  margin-bottom: 20rpx;
}

.achievement-icon {
  width: 70rpx;
  height: 70rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;

  &.unlocked {
    background: linear-gradient(135deg, $primary-color, $secondary-color);
    font-size: 32rpx;
  }

  &.locked {
    background-color: $bg-color;
    font-size: 28rpx;
    opacity: 0.5;
  }
}

.progress-bar {
  height: 12rpx;
  background-color: $bg-color;
  border-radius: 6rpx;
  overflow: hidden;
  margin-bottom: 8rpx;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, $primary-color, $secondary-color);
  border-radius: 6rpx;
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 24rpx;
  color: $text-muted;
  text-align: center;
}

.menu-section {
  padding: 8rpx 0;
  margin-bottom: 24rpx;
}

.menu-item {
  display: flex;
  align-items: center;
  padding: 24rpx;
  border-bottom: 1rpx solid $border-color;

  &:last-child {
    border-bottom: none;
  }
}

.menu-icon {
  width: 80rpx;
  height: 80rpx;
  background-color: $bg-color;
  border-radius: 16rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 20rpx;
  font-size: 36rpx;
}

.menu-content {
  flex: 1;
}

.menu-title {
  font-size: 30rpx;
  font-weight: 500;
  color: $text-color;
  margin-bottom: 4rpx;
}

.menu-desc {
  font-size: 24rpx;
  color: $text-muted;
}

.menu-arrow {
  font-size: 24rpx;
  color: $text-muted;
}

.footer-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40rpx 0;
}

.footer-text {
  font-size: 24rpx;
  color: $text-muted;
  margin-bottom: 8rpx;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  width: 80%;
  background-color: $white;
  border-radius: 24rpx;
  padding: 32rpx;
}

.modal-title {
  font-size: 32rpx;
  font-weight: 600;
  color: $text-color;
  text-align: center;
  margin-bottom: 24rpx;
}

.modal-input {
  width: 100%;
  padding: 20rpx 24rpx;
  background-color: $bg-color;
  border-radius: 16rpx;
  font-size: 28rpx;
  margin-bottom: 24rpx;
}

.modal-actions {
  display: flex;
  gap: 24rpx;
}

.modal-btn {
  flex: 1;
  padding: 24rpx;
  text-align: center;
  border-radius: 16rpx;
  font-size: 28rpx;

  &.cancel {
    background-color: $bg-color;
    color: $text-muted;
  }

  &.confirm {
    background: linear-gradient(135deg, $primary-color, $secondary-color);
    color: $white;
  }
}
</style>
