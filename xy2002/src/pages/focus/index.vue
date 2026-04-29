<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { useFocusStore } from '@/stores/focus';
import { useProfileStore } from '@/stores/profile';
import type { FocusType } from '@/types';

const focusStore = useFocusStore();
const profileStore = useProfileStore();

type TimerMode = 'countdown' | 'pomodoro' | 'stopwatch';

const currentMode = ref<TimerMode>('pomodoro');
const customDuration = ref(25);
const showCustomInput = ref(false);
const taskName = ref('');

const isRunning = computed(() => focusStore.currentTimer?.status === 'running');
const isPaused = computed(() => focusStore.currentTimer?.status === 'paused');
const hasActiveTimer = computed(() => !!focusStore.currentTimer);

const displayTime = computed(() => {
  if (focusStore.currentTimer) {
    return focusStore.formatTime(focusStore.currentTimer.remainingTime);
  }
  if (currentMode.value === 'stopwatch') {
    return '00:00';
  }
  const duration = customDuration.value * 60;
  return focusStore.formatTime(duration);
});

const currentPresets = computed(() => {
  if (currentMode.value === 'pomodoro') {
    return focusStore.presets.pomodoro;
  }
  return focusStore.presets.countdown;
});

const progressPercent = computed(() => {
  if (!focusStore.currentTimer || focusStore.currentTimer.type === 'stopwatch') {
    return 100;
  }
  const { duration, remainingTime } = focusStore.currentTimer;
  if (duration === 0) return 0;
  return (remainingTime / duration) * 100;
});

const todayStats = computed(() => ({
  focusMinutes: focusStore.todayFocusMinutes,
  pomodoroCount: focusStore.getTodayRecords().filter(r => r.type === 'pomodoro' && r.status === 'completed').length
}));

function setMode(mode: TimerMode) {
  if (hasActiveTimer.value) {
    uni.showModal({
      title: '确认切换',
      content: '当前有正在进行的专注，切换模式将终止当前专注。确定要切换吗？',
      success: (res) => {
        if (res.confirm) {
          focusStore.stopTimer();
          currentMode.value = mode;
        }
      }
    });
    return;
  }
  currentMode.value = mode;
}

function selectPreset(preset: { name: string; duration: number }) {
  customDuration.value = preset.duration / 60;
}

function startTimer() {
  let duration: number;
  if (currentMode.value === 'stopwatch') {
    duration = 0;
  } else {
    duration = customDuration.value * 60;
  }

  focusStore.startTimer(currentMode.value as FocusType, duration, taskName.value);
}

function pauseTimer() {
  focusStore.pauseTimer();
}

function resumeTimer() {
  focusStore.resumeTimer();
}

function stopTimer() {
  uni.showModal({
    title: '确认终止',
    content: '确定要终止当前专注吗？本次专注时间将不会被记录。',
    success: (res) => {
      if (res.confirm) {
        focusStore.stopTimer();
      }
    }
  });
}

function goToRecords() {
  uni.navigateTo({
    url: '/pages/profile/focus-records'
  });
}

function handleTimerComplete() {
  if (focusStore.currentTimer?.status === 'completed') {
    const hours = focusStore.currentTimer.duration / 3600;
    profileStore.addFocusHours(hours);
  }
}

onMounted(() => {
  focusStore.loadRecords();
});

onShow(() => {
  focusStore.loadRecords();
});

onUnmounted(() => {
  if (hasActiveTimer.value) {
    handleTimerComplete();
  }
});
</script>

<template>
  <view class="focus-page">
    <view class="kitty-header">
      <view class="kitty-ears">
        <view class="kitty-ear left-ear"></view>
        <view class="kitty-ear right-ear"></view>
        <view class="kitty-bow">🎀</view>
      </view>
      <view class="kitty-title">
        <text class="kitty-icon">🐱</text>
        <text>专注计时</text>
      </view>
      <view class="kitty-whiskers">
        <view class="whisker whisker-left-top"></view>
        <view class="whisker whisker-left-bottom"></view>
        <view class="whisker whisker-right-top"></view>
        <view class="whisker whisker-right-bottom"></view>
      </view>
    </view>
    
    <view class="mode-tabs">
      <view 
        :class="['mode-tab', { active: currentMode === 'pomodoro', disabled: hasActiveTimer }]"
        @click="setMode('pomodoro')"
      >
        🍅 番茄钟
      </view>
      <view 
        :class="['mode-tab', { active: currentMode === 'countdown', disabled: hasActiveTimer }]"
        @click="setMode('countdown')"
      >
        ⏰ 倒计时
      </view>
      <view 
        :class="['mode-tab', { active: currentMode === 'stopwatch', disabled: hasActiveTimer }]"
        @click="setMode('stopwatch')"
      >
        ⏱️ 正计时
      </view>
    </view>

    <view class="stats-card card">
      <view class="stat-item">
        <view class="stat-icon">⏰</view>
        <view class="stat-info">
          <view class="stat-value">{{ todayStats.focusMinutes }}分钟</view>
          <view class="stat-label">今日专注</view>
        </view>
      </view>
      <view class="stat-divider"></view>
      <view class="stat-item">
        <view class="stat-icon">🍅</view>
        <view class="stat-info">
          <view class="stat-value">{{ todayStats.pomodoroCount }}个</view>
          <view class="stat-label">完成番茄</view>
        </view>
      </view>
      <view class="history-btn" @click="goToRecords">
        <text>查看记录</text>
        <text>▶</text>
      </view>
    </view>

    <view class="timer-section card">
      <view v-if="currentMode !== 'stopwatch' && !hasActiveTimer" class="preset-section">
        <view class="section-title">选择时长</view>
        <view class="preset-list">
          <view 
            v-for="preset in currentPresets" 
            :key="preset.name"
            :class="['preset-item', { active: customDuration === preset.duration / 60 }]"
            @click="selectPreset(preset)"
          >
            {{ preset.name }}
          </view>
        </view>
        <view class="custom-section">
          <view class="custom-label" @click="showCustomInput = !showCustomInput">
            <text>自定义时长</text>
            <text class="arrow">{{ showCustomInput ? '▼' : '▶' }}</text>
          </view>
          <view v-if="showCustomInput" class="custom-input-section">
            <input 
              v-model.number="customDuration" 
              type="number" 
              class="custom-input"
              placeholder="输入分钟数"
            />
            <text class="unit">分钟</text>
          </view>
        </view>
      </view>

      <view class="task-input-section" v-if="!hasActiveTimer">
        <view class="section-title">专注任务</view>
        <input 
          v-model="taskName" 
          class="task-input"
          placeholder="输入本次专注的任务名称（可选）"
          maxlength="50"
        />
      </view>

      <view class="timer-display">
        <view class="timer-circle">
          <view class="timer-circle-inner">
            <text class="timer-text">{{ displayTime }}</text>
            <view v-if="hasActiveTimer" class="timer-status">
              <text v-if="isRunning" class="status-running">专注中...</text>
              <text v-else-if="isPaused" class="status-paused">已暂停</text>
            </view>
            <view v-else class="timer-mode-label">
              <text v-if="currentMode === 'pomodoro'">🍅 番茄钟模式</text>
              <text v-else-if="currentMode === 'countdown'">⏰ 倒计时模式</text>
              <text v-else>⏱️ 正计时模式</text>
            </view>
          </view>
          <view v-if="currentMode !== 'stopwatch'" class="progress-ring">
            <svg viewBox="0 0 100 100">
              <circle 
                class="progress-bg" 
                cx="50" 
                cy="50" 
                r="45"
              />
              <circle 
                class="progress-bar" 
                cx="50" 
                cy="50" 
                r="45"
                :stroke-dasharray="283"
                :stroke-dashoffset="283 * (1 - progressPercent / 100)"
                stroke-linecap="round"
              />
            </svg>
          </view>
        </view>
      </view>

      <view class="timer-controls">
        <view v-if="!hasActiveTimer" class="control-btn start" @click="startTimer">
          <text>开始专注</text>
          <text class="kitty-icon">🎀</text>
        </view>
        
        <view v-else class="controls-row">
          <view v-if="isRunning" class="control-btn pause" @click="pauseTimer">
            ⏸️ 暂停
          </view>
          <view v-else-if="isPaused" class="control-btn resume" @click="resumeTimer">
            ▶️ 继续
          </view>
          <view class="control-btn stop" @click="stopTimer">
            ⏹️ 终止
          </view>
        </view>
      </view>
    </view>

    <view class="tips-card card" v-if="!hasActiveTimer">
      <view class="tips-title">
        <text>💡 专注小贴士</text>
      </view>
      <view class="tips-list">
        <view class="tip-item">
          <text class="tip-number">1</text>
          <text class="tip-text">番茄钟建议：专注25分钟，休息5分钟</text>
        </view>
        <view class="tip-item">
          <text class="tip-number">2</text>
          <text class="tip-text">专注时关闭手机通知，保持专注</text>
        </view>
        <view class="tip-item">
          <text class="tip-number">3</text>
          <text class="tip-text">每完成4个番茄钟，休息15-30分钟</text>
        </view>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.focus-page {
  min-height: 100vh;
  background-color: $bg-color;
  padding: 24rpx;
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

.mode-tabs {
  display: flex;
  background-color: $white;
  border-radius: 20rpx;
  padding: 8rpx;
  margin-bottom: 24rpx;
}

.mode-tab {
  flex: 1;
  text-align: center;
  padding: 20rpx 0;
  border-radius: 16rpx;
  font-size: 26rpx;
  color: $text-muted;
  transition: all 0.3s;

  &.active {
    background: linear-gradient(135deg, $primary-color, $secondary-color);
    color: $white;
    font-weight: 500;
  }

  &.disabled {
    opacity: 0.5;
  }
}

.stats-card {
  display: flex;
  align-items: center;
  margin-bottom: 24rpx;
  position: relative;
}

.stat-item {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.stat-icon {
  font-size: 40rpx;
}

.stat-info {
  display: flex;
  flex-direction: column;
}

.stat-value {
  font-size: 32rpx;
  font-weight: 600;
  color: $text-color;
}

.stat-label {
  font-size: 22rpx;
  color: $text-muted;
}

.stat-divider {
  width: 1rpx;
  height: 60rpx;
  background-color: $border-color;
  margin: 0 24rpx;
}

.history-btn {
  display: flex;
  align-items: center;
  gap: 8rpx;
  padding: 12rpx 20rpx;
  background-color: $primary-color + '22';
  color: $primary-color;
  border-radius: 20rpx;
  font-size: 24rpx;
}

.timer-section {
  padding: 32rpx;
  margin-bottom: 24rpx;
}

.preset-section {
  margin-bottom: 32rpx;
}

.section-title {
  font-size: 28rpx;
  font-weight: 600;
  color: $text-color;
  margin-bottom: 16rpx;
}

.preset-list {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.preset-item {
  padding: 16rpx 32rpx;
  background-color: $bg-color;
  border-radius: 30rpx;
  font-size: 26rpx;
  color: $text-color;
  border: 2rpx solid transparent;

  &.active {
    background: linear-gradient(135deg, $primary-color, $secondary-color);
    color: $white;
    border-color: $primary-color;
  }
}

.custom-section {
  margin-top: 16rpx;
}

.custom-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16rpx 0;
  font-size: 26rpx;
  color: $text-color;
}

.arrow {
  font-size: 20rpx;
  color: $text-muted;
}

.custom-input-section {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 12rpx 0;
}

.custom-input {
  flex: 1;
  padding: 16rpx 24rpx;
  background-color: $bg-color;
  border-radius: 16rpx;
  font-size: 28rpx;
}

.unit {
  font-size: 26rpx;
  color: $text-muted;
}

.task-input-section {
  margin-bottom: 32rpx;
}

.task-input {
  width: 100%;
  padding: 20rpx 24rpx;
  background-color: $bg-color;
  border-radius: 16rpx;
  font-size: 28rpx;
}

.timer-display {
  display: flex;
  justify-content: center;
  margin: 40rpx 0;
}

.timer-circle {
  width: 400rpx;
  height: 400rpx;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.timer-circle-inner {
  width: 300rpx;
  height: 300rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, $white, $secondary-color);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8rpx 32rpx rgba(255, 105, 180, 0.2);
  position: relative;
  z-index: 1;
}

.timer-text {
  font-size: 80rpx;
  font-weight: 700;
  color: $primary-color;
  font-family: 'SF Mono', 'Monaco', monospace;
}

.timer-status {
  margin-top: 16rpx;
}

.status-running {
  font-size: 28rpx;
  color: $primary-color;
  animation: pulse 1.5s infinite;
}

.status-paused {
  font-size: 28rpx;
  color: $text-muted;
}

.timer-mode-label {
  margin-top: 16rpx;
  font-size: 26rpx;
  color: $text-muted;
}

.progress-ring {
  position: absolute;
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}

.progress-bg {
  fill: none;
  stroke: $border-color;
  stroke-width: 8;
}

.progress-bar {
  fill: none;
  stroke: $primary-color;
  stroke-width: 8;
  transition: stroke-dashoffset 0.3s ease;
}

.timer-controls {
  margin-top: 24rpx;
}

.control-btn {
  padding: 28rpx;
  border-radius: 50rpx;
  text-align: center;
  font-size: 32rpx;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;

  &.start {
    background: linear-gradient(135deg, $primary-color, $secondary-color);
    color: $white;
    box-shadow: 0 8rpx 24rpx rgba(255, 105, 180, 0.3);
  }

  &.pause,
  &.resume {
    flex: 1;
    background-color: $primary-color + '22';
    color: $primary-color;
  }

  &.stop {
    flex: 1;
    background-color: $danger-color + '22';
    color: $danger-color;
  }
}

.kitty-icon {
  font-size: 32rpx;
}

.controls-row {
  display: flex;
  gap: 24rpx;
}

.tips-card {
  padding: 24rpx;
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
  width: 40rpx;
  height: 40rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, $primary-color, $secondary-color);
  color: $white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22rpx;
  flex-shrink: 0;
}

.tip-text {
  flex: 1;
  font-size: 26rpx;
  color: $text-muted;
  line-height: 1.6;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.6;
  }
}
</style>
