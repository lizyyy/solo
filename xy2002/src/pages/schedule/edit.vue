<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { useScheduleStore } from '@/stores/schedule';
import type { Schedule } from '@/types';

const scheduleStore = useScheduleStore();

const scheduleId = ref('');
const schedule = ref<Schedule | null>(null);

const title = ref('');
const description = ref('');
const date = ref('');
const startTime = ref('');
const endTime = ref('');
const color = ref('#FF69B4');
const isAllDay = ref(false);
const location = ref('');
const remindMinutesBefore = ref(0);

const remindOptions = [
  { value: 0, label: '不提醒' },
  { value: 5, label: '提前5分钟' },
  { value: 15, label: '提前15分钟' },
  { value: 30, label: '提前30分钟' },
  { value: 60, label: '提前1小时' },
  { value: 1440, label: '提前1天' }
];

const colorOptions = [
  '#FF69B4',
  '#FFB6C1',
  '#FF6B6B',
  '#4ECDC4',
  '#45B7D1',
  '#96CEB4',
  '#FFEAA7',
  '#DDA0DD'
];

onLoad((options) => {
  if (options.id) {
    scheduleId.value = options.id;
    loadSchedule();
  }
});

function loadSchedule() {
  const found = scheduleStore.schedules.find(s => s.id === scheduleId.value);
  if (found) {
    schedule.value = found;
    title.value = found.title;
    description.value = found.description;
    date.value = found.date;
    startTime.value = found.startTime;
    endTime.value = found.endTime;
    color.value = found.color;
    isAllDay.value = found.isAllDay;
    location.value = found.location;
    remindMinutesBefore.value = found.remindMinutesBefore;
  }
}

function selectColor(selectedColor: string) {
  color.value = selectedColor;
}

function saveSchedule() {
  if (!title.value.trim()) {
    uni.showToast({
      title: '请输入日程标题',
      icon: 'none'
    });
    return;
  }

  if (!isAllDay.value && startTime.value >= endTime.value) {
    uni.showToast({
      title: '结束时间必须晚于开始时间',
      icon: 'none'
    });
    return;
  }

  scheduleStore.updateSchedule(scheduleId.value, {
    title: title.value,
    description: description.value,
    date: date.value,
    startTime: startTime.value,
    endTime: endTime.value,
    color: color.value,
    isAllDay: isAllDay.value,
    location: location.value,
    remindMinutesBefore: remindMinutesBefore.value
  });

  uni.showToast({
    title: '保存成功',
    icon: 'success'
  });

  setTimeout(() => {
    uni.navigateBack();
  }, 1500);
}

function deleteSchedule() {
  uni.showModal({
    title: '确认删除',
    content: '确定要删除这个日程吗？',
    success: (res) => {
      if (res.confirm) {
        scheduleStore.deleteSchedule(scheduleId.value);
        uni.showToast({
          title: '删除成功',
          icon: 'success'
        });
        setTimeout(() => {
          uni.navigateBack();
        }, 1500);
      }
    }
  });
}

function onDateChange(e: any) {
  date.value = e.detail.value;
}

function onStartTimeChange(e: any) {
  startTime.value = e.detail.value;
}

function onEndTimeChange(e: any) {
  endTime.value = e.detail.value;
}
</script>

<template>
  <view class="edit-schedule-page">
    <view class="form-section">
      <view class="form-item">
        <view class="form-label">日程标题</view>
        <input 
          v-model="title" 
          class="form-input" 
          placeholder="请输入日程标题"
          maxlength="50"
        />
      </view>

      <view class="form-item">
        <view class="form-label">日期</view>
        <picker 
          mode="date" 
          :value="date"
          :start="new Date().toISOString().split('T')[0]"
          @change="onDateChange"
        >
          <view class="form-value">
            <text>{{ date }}</text>
            <text class="arrow">▶</text>
          </view>
        </picker>
      </view>

      <view class="form-item">
        <view class="form-label">
          <text>全天</text>
          <switch v-model="isAllDay" color="#FF69B4" />
        </view>
      </view>

      <view v-if="!isAllDay" class="form-item time-row">
        <view class="time-item">
          <view class="form-label">开始时间</view>
          <picker 
            mode="time" 
            :value="startTime"
            @change="onStartTimeChange"
          >
            <view class="form-value">
              <text>{{ startTime }}</text>
            </view>
          </picker>
        </view>
        <view class="time-separator">
          <text>至</text>
        </view>
        <view class="time-item">
          <view class="form-label">结束时间</view>
          <picker 
            mode="time" 
            :value="endTime"
            @change="onEndTimeChange"
          >
            <view class="form-value">
              <text>{{ endTime }}</text>
            </view>
          </picker>
        </view>
      </view>

      <view class="form-item">
        <view class="form-label">颜色</view>
        <view class="color-options">
          <view 
            v-for="c in colorOptions" 
            :key="c"
            :class="['color-option', { active: color === c }]"
            :style="{ backgroundColor: c }"
            @click="selectColor(c)"
          >
            <text v-if="color === c" class="check">✓</text>
          </view>
        </view>
      </view>

      <view class="form-item">
        <view class="form-label">提醒</view>
        <picker 
          :value="remindMinutesBefore" 
          :range="remindOptions" 
          range-key="label"
          @change="(e) => remindMinutesBefore = remindOptions[e.detail.value].value"
        >
          <view class="form-value">
            <text>{{ remindOptions.find(o => o.value === remindMinutesBefore)?.label || '不提醒' }}</text>
            <text class="arrow">▶</text>
          </view>
        </picker>
      </view>

      <view class="form-item">
        <view class="form-label">地点</view>
        <input 
          v-model="location" 
          class="form-input" 
          placeholder="请输入地点（可选）"
          maxlength="100"
        />
      </view>

      <view class="form-item">
        <view class="form-label">描述</view>
        <textarea 
          v-model="description" 
          class="form-textarea" 
          placeholder="请输入日程描述（可选）"
          maxlength="500"
        />
      </view>

      <view class="delete-section" @click="deleteSchedule">
        <text class="delete-text">🗑️ 删除日程</text>
      </view>
    </view>

    <view class="submit-section">
      <view class="btn-primary" @click="saveSchedule">
        💾 保存修改
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.edit-schedule-page {
  min-height: 100vh;
  background-color: $bg-color;
  padding: 24rpx;
  padding-bottom: 200rpx;
}

.form-section {
  background-color: $white;
  border-radius: 20rpx;
  padding: 24rpx;
}

.form-item {
  padding: 24rpx 0;
  border-bottom: 1rpx solid $border-color;

  &:last-child {
    border-bottom: none;
  }
}

.form-label {
  font-size: 28rpx;
  color: $text-color;
  font-weight: 500;
  margin-bottom: 16rpx;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.form-input {
  width: 100%;
  font-size: 30rpx;
  color: $text-color;
  padding: 16rpx 0;
}

.form-textarea {
  width: 100%;
  height: 160rpx;
  font-size: 30rpx;
  color: $text-color;
  padding: 16rpx 0;
}

.form-value {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16rpx 0;
  font-size: 30rpx;
  color: $text-color;
}

.arrow {
  font-size: 24rpx;
  color: $text-muted;
}

.time-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.time-item {
  flex: 1;
}

.time-separator {
  padding-top: 48rpx;
  font-size: 28rpx;
  color: $text-muted;
}

.color-options {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
  padding-top: 8rpx;
}

.color-option {
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  box-sizing: border-box;
  transition: all 0.2s ease;
  cursor: pointer;

  &.active {
    transform: scale(1.15);
    box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.3);
  }

  &:active {
    transform: scale(0.95);
  }
}

.check {
  color: $white;
  font-size: 32rpx;
  font-weight: bold;
  text-shadow: 0 2rpx 4rpx rgba(0, 0, 0, 0.5);
}

.delete-section {
  padding: 24rpx 0;
  text-align: center;
}

.delete-text {
  font-size: 28rpx;
  color: $danger-color;
}

.submit-section {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 24rpx;
  background-color: $white;
  box-shadow: 0 -4rpx 20rpx rgba(0, 0, 0, 0.05);
}
</style>
