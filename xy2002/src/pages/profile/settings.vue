<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useProfileStore } from '@/stores/profile';

const profileStore = useProfileStore();

const themes = computed(() => profileStore.themes);
const currentTheme = computed(() => profileStore.currentTheme);

function selectTheme(themeId: string) {
  profileStore.updateTheme(themeId);
  uni.showToast({
    title: '主题已切换',
    icon: 'success'
  });
}

onMounted(() => {
  profileStore.loadProfile();
});
</script>

<template>
  <view class="settings-page">
    <view class="section card">
      <view class="section-title">
        <text>🎨 主题皮肤</text>
      </view>
      <view class="theme-list">
        <view 
          v-for="theme in themes" 
          :key="theme.id"
          :class="['theme-item', { active: theme.isActive }]"
          @click="selectTheme(theme.id)"
        >
          <view class="theme-preview" :style="{ backgroundColor: theme.secondaryColor }">
            <view class="theme-header" :style="{ backgroundColor: theme.primaryColor }"></view>
            <view class="theme-content">
              <view class="theme-card" :style="{ borderLeftColor: theme.primaryColor }"></view>
              <view class="theme-card" :style="{ borderLeftColor: theme.primaryColor }"></view>
            </view>
          </view>
          <view class="theme-info">
            <view class="theme-name">{{ theme.name }}</view>
            <view class="theme-status" v-if="theme.isActive">
              <text>✓ 已使用</text>
            </view>
            <view class="theme-status" v-else>
              <text>点击使用</text>
            </view>
          </view>
          <view class="theme-check" v-if="theme.isActive">
            <text>✓</text>
          </view>
        </view>
      </view>
    </view>

    <view class="section card">
      <view class="section-title">
        <text>ℹ️ 关于</text>
      </view>
      <view class="about-list">
        <view class="about-item">
          <view class="about-label">版本号</view>
          <view class="about-value">1.0.0</view>
        </view>
        <view class="about-item">
          <view class="about-label">开发者</view>
          <view class="about-value">HelloKitty团队</view>
        </view>
        <view class="about-item">
          <view class="about-label">更新日期</view>
          <view class="about-value">2026-04-24</view>
        </view>
      </view>
    </view>

    <view class="footer-note">
      <text>🎀 HelloKitty计划助手，让每一天都更有计划 🎀</text>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.settings-page {
  min-height: 100vh;
  background-color: $bg-color;
  padding: 24rpx;
}

.section {
  padding: 24rpx;
  margin-bottom: 24rpx;
}

.section-title {
  font-size: 30rpx;
  font-weight: 600;
  color: $text-color;
  margin-bottom: 24rpx;
}

.theme-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.theme-item {
  display: flex;
  align-items: center;
  padding: 16rpx;
  border-radius: 16rpx;
  border: 3rpx solid transparent;
  position: relative;

  &.active {
    border-color: $primary-color;
    background-color: $primary-color + '11';
  }
}

.theme-preview {
  width: 160rpx;
  height: 120rpx;
  border-radius: 12rpx;
  overflow: hidden;
  margin-right: 20rpx;
  position: relative;
}

.theme-header {
  height: 24rpx;
  background-color: $primary-color;
}

.theme-content {
  padding: 12rpx;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.theme-card {
  height: 16rpx;
  background-color: $white;
  border-radius: 4rpx;
  border-left: 4rpx solid $primary-color;
}

.theme-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.theme-name {
  font-size: 28rpx;
  font-weight: 600;
  color: $text-color;
}

.theme-status {
  font-size: 24rpx;
  color: $text-muted;
}

.theme-check {
  width: 44rpx;
  height: 44rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, $primary-color, $secondary-color);
  display: flex;
  align-items: center;
  justify-content: center;

  text {
    color: $white;
    font-size: 24rpx;
    font-weight: bold;
  }
}

.about-list {
  display: flex;
  flex-direction: column;
}

.about-item {
  display: flex;
  justify-content: space-between;
  padding: 20rpx 0;
  border-bottom: 1rpx solid $border-color;

  &:last-child {
    border-bottom: none;
  }
}

.about-label {
  font-size: 28rpx;
  color: $text-muted;
}

.about-value {
  font-size: 28rpx;
  color: $text-color;
  font-weight: 500;
}

.footer-note {
  text-align: center;
  padding: 40rpx 0;
  font-size: 24rpx;
  color: $text-muted;
}
</style>
