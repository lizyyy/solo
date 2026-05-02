<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useProfileStore } from '@/stores/profile';
import type { Achievement } from '@/types';

const profileStore = useProfileStore();

const achievements = computed(() => profileStore.achievements);
const unlockedCount = computed(() => profileStore.unlockedAchievements.length);
const totalCount = computed(() => profileStore.achievements.length);
const progressPercent = computed(() => totalCount.value > 0 ? (unlockedCount.value / totalCount.value) * 100 : 0);

function getCategory(achievement: Achievement): string {
  switch (achievement.condition.type) {
    case 'focus-hours':
      return '专注';
    case 'completed-todos':
      return '任务';
    case 'streak-days':
      return '连续';
    case 'total-days':
      return '累计';
    default:
      return '其他';
  }
}

function getProgressText(achievement: Achievement): string {
  if (achievement.isUnlocked) {
    return '已解锁';
  }
  return `${achievement.progress}/${achievement.target}`;
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${year}年${month}月${day}日`;
}

onMounted(() => {
  profileStore.loadProfile();
  profileStore.loadAchievements();
});
</script>

<template>
  <view class="achievements-page">
    <view class="header-section card">
      <view class="header-title">
        <text>🏆 成就勋章</text>
      </view>
      <view class="progress-section">
        <view class="progress-info">
          <text class="progress-text">已解锁 {{ unlockedCount }}/{{ totalCount }}</text>
          <text class="progress-percent">{{ progressPercent.toFixed(0) }}%</text>
        </view>
        <view class="progress-bar">
          <view class="progress-fill" :style="{ width: `${progressPercent}%` }"></view>
        </view>
      </view>
    </view>

    <view class="category-section card">
      <view class="category-title">
        <text>📋 成就分类</text>
      </view>
      <view class="category-grid">
        <view class="category-item">
          <text class="category-icon">⏰</text>
          <text class="category-name">专注</text>
          <text class="category-count">
            {{ achievements.filter(a => a.condition.type === 'focus-hours' && a.isUnlocked).length }}/
            {{ achievements.filter(a => a.condition.type === 'focus-hours').length }}
          </text>
        </view>
        <view class="category-item">
          <text class="category-icon">✅</text>
          <text class="category-name">任务</text>
          <text class="category-count">
            {{ achievements.filter(a => a.condition.type === 'completed-todos' && a.isUnlocked).length }}/
            {{ achievements.filter(a => a.condition.type === 'completed-todos').length }}
          </text>
        </view>
        <view class="category-item">
          <text class="category-icon">🔥</text>
          <text class="category-name">连续</text>
          <text class="category-count">
            {{ achievements.filter(a => a.condition.type === 'streak-days' && a.isUnlocked).length }}/
            {{ achievements.filter(a => a.condition.type === 'streak-days').length }}
          </text>
        </view>
        <view class="category-item">
          <text class="category-icon">📅</text>
          <text class="category-name">累计</text>
          <text class="category-count">
            {{ achievements.filter(a => a.condition.type === 'total-days' && a.isUnlocked).length }}/
            {{ achievements.filter(a => a.condition.type === 'total-days').length }}
          </text>
        </view>
      </view>
    </view>

    <view class="achievements-section">
      <view class="section-header card">
        <text class="section-title">🎖️ 所有成就</text>
      </view>
      
      <view class="achievements-grid">
        <view 
          v-for="achievement in achievements" 
          :key="achievement.id"
          :class="['achievement-card', 'card', { locked: !achievement.isUnlocked }]"
        >
          <view class="achievement-icon-wrapper">
            <view 
              :class="['achievement-icon', { unlocked: achievement.isUnlocked }]"
            >
              <text v-if="achievement.isUnlocked">{{ achievement.icon }}</text>
              <text v-else>🔒</text>
            </view>
            <view v-if="achievement.isUnlocked" class="achievement-badge">
              <text>✓</text>
            </view>
          </view>
          
          <view class="achievement-info">
            <view class="achievement-name">
              <text :class="{ 'locked-text': !achievement.isUnlocked }">
                {{ achievement.isUnlocked ? achievement.name : '???' }}
              </text>
            </view>
            <view class="achievement-category">
              <text>{{ getCategory(achievement) }}</text>
            </view>
            <view class="achievement-desc">
              <text :class="{ 'locked-text': !achievement.isUnlocked }">
                {{ achievement.isUnlocked ? achievement.description : '继续努力解锁此成就' }}
              </text>
            </view>
            
            <view class="achievement-progress">
              <view v-if="!achievement.isUnlocked" class="progress-bar-small">
                <view 
                  class="progress-fill-small" 
                  :style="{ width: `${Math.min(100, (achievement.progress / achievement.target) * 100)}%` }"
                ></view>
              </view>
              <view class="progress-text-small">
                {{ getProgressText(achievement) }}
              </view>
            </view>
            
            <view v-if="achievement.isUnlocked && achievement.unlockedAt" class="achievement-unlock-date">
              <text>🎉 解锁于 {{ formatDate(achievement.unlockedAt) }}</text>
            </view>
          </view>
        </view>
      </view>
    </view>

    <view class="tips-section card">
      <view class="tips-title">
        <text>💡 如何获得更多成就？</text>
      </view>
      <view class="tips-list">
        <view class="tip-item">
          <text class="tip-number">1</text>
          <text class="tip-text">坚持每天专注，解锁更多专注类成就</text>
        </view>
        <view class="tip-item">
          <text class="tip-number">2</text>
          <text class="tip-text">完成更多待办任务，提升任务完成数</text>
        </view>
        <view class="tip-item">
          <text class="tip-number">3</text>
          <text class="tip-text">连续使用应用，保持打卡记录</text>
        </view>
        <view class="tip-item">
          <text class="tip-number">4</text>
          <text class="tip-text">每天都来看看，累计使用天数</text>
        </view>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.achievements-page {
  min-height: 100vh;
  background-color: $bg-color;
  padding: 24rpx;
}

.header-section {
  padding: 24rpx;
  margin-bottom: 24rpx;
}

.header-title {
  font-size: 32rpx;
  font-weight: 600;
  color: $text-color;
  margin-bottom: 24rpx;
}

.progress-section {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.progress-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.progress-text {
  font-size: 26rpx;
  color: $text-color;
}

.progress-percent {
  font-size: 28rpx;
  font-weight: 600;
  color: $primary-color;
}

.progress-bar {
  height: 16rpx;
  background-color: $bg-color;
  border-radius: 8rpx;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, $primary-color, $secondary-color);
  border-radius: 8rpx;
  transition: width 0.3s ease;
}

.category-section {
  padding: 24rpx;
  margin-bottom: 24rpx;
}

.category-title {
  font-size: 28rpx;
  font-weight: 600;
  color: $text-color;
  margin-bottom: 20rpx;
}

.category-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16rpx;
}

.category-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16rpx 8rpx;
  background-color: $bg-color;
  border-radius: 12rpx;
}

.category-icon {
  font-size: 36rpx;
  margin-bottom: 8rpx;
}

.category-name {
  font-size: 22rpx;
  color: $text-color;
  margin-bottom: 4rpx;
}

.category-count {
  font-size: 20rpx;
  color: $text-muted;
}

.achievements-section {
  margin-bottom: 24rpx;
}

.section-header {
  padding: 20rpx 24rpx;
  margin-bottom: 16rpx;
}

.section-title {
  font-size: 28rpx;
  font-weight: 600;
  color: $text-color;
}

.achievements-grid {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.achievement-card {
  padding: 20rpx;
  display: flex;
  gap: 20rpx;

  &.locked {
    opacity: 0.7;
  }
}

.achievement-icon-wrapper {
  position: relative;
  flex-shrink: 0;
}

.achievement-icon {
  width: 100rpx;
  height: 100rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 48rpx;
  background-color: $bg-color;

  &.unlocked {
    background: linear-gradient(135deg, $primary-color, $secondary-color);
  }
}

.achievement-badge {
  position: absolute;
  right: -4rpx;
  bottom: -4rpx;
  width: 36rpx;
  height: 36rpx;
  border-radius: 50%;
  background-color: $success-color;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 3rpx solid $white;

  text {
    color: $white;
    font-size: 20rpx;
    font-weight: bold;
  }
}

.achievement-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}

.achievement-name {
  font-size: 28rpx;
  font-weight: 600;
  color: $text-color;

  .locked-text {
    color: $text-muted;
  }
}

.achievement-category {
  font-size: 22rpx;
  color: $primary-color;
  padding: 4rpx 12rpx;
  background-color: $primary-color + '22';
  border-radius: 12rpx;
  align-self: flex-start;
}

.achievement-desc {
  font-size: 24rpx;
  color: $text-muted;
  line-height: 1.5;

  .locked-text {
    color: $text-muted;
    font-style: italic;
  }
}

.achievement-progress {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-top: 8rpx;
}

.progress-bar-small {
  flex: 1;
  height: 8rpx;
  background-color: $bg-color;
  border-radius: 4rpx;
  overflow: hidden;
  max-width: 200rpx;
}

.progress-fill-small {
  height: 100%;
  background: linear-gradient(90deg, $primary-color, $secondary-color);
  border-radius: 4rpx;
}

.progress-text-small {
  font-size: 22rpx;
  color: $text-muted;
}

.achievement-unlock-date {
  font-size: 22rpx;
  color: $success-color;
  margin-top: 4rpx;
}

.tips-section {
  padding: 24rpx;
  margin-bottom: 24rpx;
}

.tips-title {
  font-size: 28rpx;
  font-weight: 600;
  color: $text-color;
  margin-bottom: 20rpx;
}

.tips-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.tip-item {
  display: flex;
  align-items: flex-start;
  gap: 12rpx;
}

.tip-number {
  width: 36rpx;
  height: 36rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, $primary-color, $secondary-color);
  color: $white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20rpx;
  font-weight: bold;
  flex-shrink: 0;
}

.tip-text {
  flex: 1;
  font-size: 26rpx;
  color: $text-muted;
  line-height: 1.6;
}
</style>
