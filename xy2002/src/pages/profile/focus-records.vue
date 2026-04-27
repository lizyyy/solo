<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useFocusStore } from '@/stores/focus';
import type { FocusRecord, FocusType, FocusStatus } from '@/types';

const focusStore = useFocusStore();

type FilterType = 'all' | 'pomodoro' | 'countdown' | 'stopwatch';
const filterType = ref<FilterType>('all');

const records = computed(() => {
  let list = [...focusStore.records];
  if (filterType.value !== 'all') {
    list = list.filter(r => r.type === filterType.value);
  }
  return list.sort((a, b) => b.createdAt - a.createdAt);
});

const stats = computed(() => {
  const allRecords = focusStore.records;
  const completedRecords = allRecords.filter(r => r.status === 'completed');
  
  let totalMinutes = 0;
  completedRecords.forEach(r => {
    const actualTime = r.type === 'stopwatch' ? r.remainingTime : (r.duration - r.remainingTime);
    totalMinutes += Math.floor(actualTime / 60);
  });

  return {
    totalCount: allRecords.length,
    completedCount: completedRecords.length,
    totalMinutes,
    pomodoroCount: allRecords.filter(r => r.type === 'pomodoro' && r.status === 'completed').length
  };
});

const typeNames: Record<FocusType, string> = {
  pomodoro: '🍅 番茄钟',
  countdown: '⏰ 倒计时',
  stopwatch: '⏱️ 正计时'
};

const statusNames: Record<FocusStatus, string> = {
  running: '进行中',
  paused: '已暂停',
  completed: '已完成',
  interrupted: '已终止'
};

const statusColors: Record<FocusStatus, string> = {
  running: '#1890FF',
  paused: '#FAAD14',
  completed: '#52C41A',
  interrupted: '#FF4D4F'
};

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}秒`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}分钟`;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return minutes > 0 ? `${hours}小时${minutes}分钟` : `${hours}小时`;
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')} ${hour}:${minute}`;
}

function setFilter(type: FilterType) {
  filterType.value = type;
}

onMounted(() => {
  focusStore.loadRecords();
});
</script>

<template>
  <view class="focus-records-page">
    <view class="stats-section card">
      <view class="stats-grid">
        <view class="stat-box">
          <view class="stat-value">{{ stats.totalCount }}</view>
          <view class="stat-label">总专注次数</view>
        </view>
        <view class="stat-box">
          <view class="stat-value">{{ stats.completedCount }}</view>
          <view class="stat-label">完成次数</view>
        </view>
        <view class="stat-box">
          <view class="stat-value">{{ stats.totalMinutes }}</view>
          <view class="stat-label">专注分钟</view>
        </view>
        <view class="stat-box">
          <view class="stat-value">{{ stats.pomodoroCount }}</view>
          <view class="stat-label">番茄个数</view>
        </view>
      </view>
    </view>

    <view class="filter-section card">
      <view class="filter-tabs">
        <view 
          :class="['filter-tab', { active: filterType === 'all' }]"
          @click="setFilter('all')"
        >
          全部
        </view>
        <view 
          :class="['filter-tab', { active: filterType === 'pomodoro' }]"
          @click="setFilter('pomodoro')"
        >
          番茄钟
        </view>
        <view 
          :class="['filter-tab', { active: filterType === 'countdown' }]"
          @click="setFilter('countdown')"
        >
          倒计时
        </view>
        <view 
          :class="['filter-tab', { active: filterType === 'stopwatch' }]"
          @click="setFilter('stopwatch')"
        >
          正计时
        </view>
      </view>
    </view>

    <view class="records-section">
      <view v-if="records.length === 0" class="empty-state card">
        <view class="empty-icon">
          <text>🎀</text>
        </view>
        <view class="empty-title">暂无专注记录</view>
        <view class="empty-hint">开始你的第一次专注吧！</view>
      </view>

      <view v-else class="records-list">
        <view 
          v-for="record in records" 
          :key="record.id"
          class="record-item card"
        >
          <view class="record-header">
            <view class="record-type">{{ typeNames[record.type] }}</view>
            <view class="record-status" :style="{ color: statusColors[record.status] }">
              {{ statusNames[record.status] }}
            </view>
          </view>
          
          <view class="record-content">
            <view class="record-task">
              <text class="task-label">任务：</text>
              <text class="task-name">{{ record.taskName || '未命名任务' }}</text>
            </view>
            
            <view class="record-details">
              <view class="detail-item">
                <text class="detail-icon">⏱️</text>
                <text class="detail-text">
                  计划时长：{{ formatDuration(record.duration) }}
                </text>
              </view>
              <view v-if="record.status === 'completed'" class="detail-item">
                <text class="detail-icon">✅</text>
                <text class="detail-text">
                  实际时长：{{ record.type === 'stopwatch' ? formatDuration(record.remainingTime) : formatDuration(record.duration - record.remainingTime) }}
                </text>
              </view>
              <view class="detail-item">
                <text class="detail-icon">📅</text>
                <text class="detail-text">
                  开始时间：{{ formatDate(record.createdAt) }}
                </text>
              </view>
              <view v-if="record.endTime" class="detail-item">
                <text class="detail-icon">🏁</text>
                <text class="detail-text">
                  结束时间：{{ formatDate(record.endTime) }}
                </text>
              </view>
            </view>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.focus-records-page {
  min-height: 100vh;
  background-color: $bg-color;
  padding: 24rpx;
}

.stats-section {
  padding: 24rpx;
  margin-bottom: 24rpx;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16rpx;
}

.stat-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16rpx 8rpx;
  background-color: $bg-color;
  border-radius: 12rpx;
}

.stat-value {
  font-size: 36rpx;
  font-weight: 700;
  color: $primary-color;
  margin-bottom: 4rpx;
}

.stat-label {
  font-size: 20rpx;
  color: $text-muted;
  text-align: center;
}

.filter-section {
  padding: 16rpx;
  margin-bottom: 24rpx;
}

.filter-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.filter-tab {
  padding: 16rpx 28rpx;
  background-color: $bg-color;
  border-radius: 30rpx;
  font-size: 24rpx;
  color: $text-muted;
  border: 2rpx solid transparent;

  &.active {
    background: linear-gradient(135deg, $primary-color, $secondary-color);
    color: $white;
    border-color: $primary-color;
  }
}

.records-section {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80rpx 0;
}

.empty-icon {
  font-size: 80rpx;
  margin-bottom: 24rpx;
}

.empty-title {
  font-size: 32rpx;
  font-weight: 600;
  color: $text-color;
  margin-bottom: 12rpx;
}

.empty-hint {
  font-size: 26rpx;
  color: $text-muted;
}

.records-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.record-item {
  padding: 20rpx;
}

.record-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16rpx;
  padding-bottom: 16rpx;
  border-bottom: 1rpx solid $border-color;
}

.record-type {
  font-size: 26rpx;
  font-weight: 500;
  color: $text-color;
}

.record-status {
  font-size: 24rpx;
  padding: 6rpx 16rpx;
  border-radius: 20rpx;
  background-color: currentColor + '22';
}

.record-content {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.record-task {
  display: flex;
  align-items: flex-start;
}

.task-label {
  font-size: 26rpx;
  color: $text-muted;
}

.task-name {
  font-size: 26rpx;
  color: $text-color;
  font-weight: 500;
  flex: 1;
}

.record-details {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  padding-left: 12rpx;
  border-left: 3rpx solid $secondary-color;
}

.detail-item {
  display: flex;
  align-items: center;
  gap: 8rpx;
}

.detail-icon {
  font-size: 24rpx;
}

.detail-text {
  font-size: 24rpx;
  color: $text-muted;
}
</style>
