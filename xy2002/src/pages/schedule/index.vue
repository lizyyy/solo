<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { useScheduleStore } from '@/stores/schedule';
import type { Schedule } from '@/types';

const scheduleStore = useScheduleStore();

type ViewType = 'day' | 'week' | 'month';

const currentView = ref<ViewType>('month');
const currentDate = ref(new Date());
const selectedDate = ref(new Date());

const monthDays = computed(() => {
  const year = currentDate.value.getFullYear();
  const month = currentDate.value.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDay = firstDay.getDay();
  
  const days: Array<{
    date: Date;
    day: number;
    isCurrentMonth: boolean;
    isToday: boolean;
    isSelected: boolean;
    schedules: Schedule[];
  }> = [];

  const prevMonthLastDay = new Date(year, month, 0).getDate();
  for (let i = startDay - 1; i >= 0; i--) {
    const date = new Date(year, month - 1, prevMonthLastDay - i);
    days.push({
      date,
      day: date.getDate(),
      isCurrentMonth: false,
      isToday: isSameDay(date, new Date()),
      isSelected: isSameDay(date, selectedDate.value),
      schedules: scheduleStore.getSchedulesByDate(date.toISOString().split('T')[0])
    });
  }

  for (let i = 1; i <= lastDay.getDate(); i++) {
    const date = new Date(year, month, i);
    days.push({
      date,
      day: i,
      isCurrentMonth: true,
      isToday: isSameDay(date, new Date()),
      isSelected: isSameDay(date, selectedDate.value),
      schedules: scheduleStore.getSchedulesByDate(date.toISOString().split('T')[0])
    });
  }

  const remaining = 42 - days.length;
  for (let i = 1; i <= remaining; i++) {
    const date = new Date(year, month + 1, i);
    days.push({
      date,
      day: i,
      isCurrentMonth: false,
      isToday: isSameDay(date, new Date()),
      isSelected: isSameDay(date, selectedDate.value),
      schedules: scheduleStore.getSchedulesByDate(date.toISOString().split('T')[0])
    });
  }

  return days;
});

const weekDays = computed(() => {
  const startOfWeek = new Date(selectedDate.value);
  const day = startOfWeek.getDay();
  startOfWeek.setDate(startOfWeek.getDate() - day);

  const days: Array<{
    date: Date;
    day: number;
    weekDay: string;
    isToday: boolean;
    isSelected: boolean;
    schedules: Schedule[];
  }> = [];

  const weekDayNames = ['日', '一', '二', '三', '四', '五', '六'];

  for (let i = 0; i < 7; i++) {
    const date = new Date(startOfWeek);
    date.setDate(startOfWeek.getDate() + i);
    days.push({
      date,
      day: date.getDate(),
      weekDay: weekDayNames[date.getDay()],
      isToday: isSameDay(date, new Date()),
      isSelected: isSameDay(date, selectedDate.value),
      schedules: scheduleStore.getSchedulesByDate(date.toISOString().split('T')[0])
    });
  }

  return days;
});

const dayTimeSlots = computed(() => {
  const slots: Array<{
    time: string;
    hour: number;
    schedules: Schedule[];
  }> = [];

  const dateStr = selectedDate.value.toISOString().split('T')[0];
  const daySchedules = scheduleStore.getSchedulesByDate(dateStr);

  for (let i = 0; i < 24; i++) {
    const timeStr = `${String(i).padStart(2, '0')}:00`;
    const hourSchedules = daySchedules.filter(s => {
      const startHour = parseInt(s.startTime.split(':')[0]);
      const endHour = parseInt(s.endTime.split(':')[0]);
      return i >= startHour && i <= endHour;
    });
    slots.push({
      time: timeStr,
      hour: i,
      schedules: hourSchedules
    });
  }

  return slots;
});

const selectedDateSchedules = computed(() => {
  const dateStr = selectedDate.value.toISOString().split('T')[0];
  return scheduleStore.getSchedulesByDate(dateStr).sort((a, b) => 
    a.startTime.localeCompare(b.startTime)
  );
});

const currentMonthStr = computed(() => {
  const year = currentDate.value.getFullYear();
  const month = currentDate.value.getMonth() + 1;
  return `${year}年${month}月`;
});

function isSameDay(date1: Date, date2: Date): boolean {
  return date1.getFullYear() === date2.getFullYear() &&
         date1.getMonth() === date2.getMonth() &&
         date1.getDate() === date2.getDate();
}

function setView(view: ViewType) {
  currentView.value = view;
}

function prevMonth() {
  currentDate.value = new Date(
    currentDate.value.getFullYear(),
    currentDate.value.getMonth() - 1,
    1
  );
}

function nextMonth() {
  currentDate.value = new Date(
    currentDate.value.getFullYear(),
    currentDate.value.getMonth() + 1,
    1
  );
}

function prevWeek() {
  selectedDate.value = new Date(selectedDate.value.getTime() - 7 * 24 * 60 * 60 * 1000);
}

function nextWeek() {
  selectedDate.value = new Date(selectedDate.value.getTime() + 7 * 24 * 60 * 60 * 1000);
}

function selectDate(day: { date: Date }) {
  selectedDate.value = day.date;
  currentDate.value = new Date(day.date.getFullYear(), day.date.getMonth(), 1);
  currentView.value = 'day';
}

function goToday() {
  const today = new Date();
  selectedDate.value = today;
  currentDate.value = new Date(today.getFullYear(), today.getMonth(), 1);
}

function addSchedule() {
  const dateStr = selectedDate.value.toISOString().split('T')[0];
  uni.navigateTo({
    url: `/pages/schedule/add?date=${dateStr}`
  });
}

function editSchedule(schedule: Schedule) {
  uni.navigateTo({
    url: `/pages/schedule/edit?id=${schedule.id}`
  });
}

function deleteSchedule(schedule: Schedule) {
  uni.showModal({
    title: '确认删除',
    content: `确定要删除日程"${schedule.title}"吗？`,
    success: (res) => {
      if (res.confirm) {
        scheduleStore.deleteSchedule(schedule.id);
        uni.showToast({
          title: '删除成功',
          icon: 'success'
        });
      }
    }
  });
}

onMounted(() => {
  scheduleStore.loadSchedules();
});

onShow(() => {
  scheduleStore.loadSchedules();
});
</script>

<template>
  <view class="schedule-page">
    <view class="kitty-header">
      <view class="kitty-ears">
        <view class="kitty-ear left-ear"></view>
        <view class="kitty-ear right-ear"></view>
        <view class="kitty-bow">🎀</view>
      </view>
      <view class="kitty-title">
        <text class="kitty-icon">🐱</text>
        <text>我的日程</text>
      </view>
      <view class="kitty-whiskers">
        <view class="whisker whisker-left-top"></view>
        <view class="whisker whisker-left-bottom"></view>
        <view class="whisker whisker-right-top"></view>
        <view class="whisker whisker-right-bottom"></view>
      </view>
    </view>
    
    <view class="view-tabs">
      <view 
        :class="['tab-item', { active: currentView === 'month' }]"
        @click="setView('month')"
      >
        月视图
      </view>
      <view 
        :class="['tab-item', { active: currentView === 'week' }]"
        @click="setView('week')"
      >
        周视图
      </view>
      <view 
        :class="['tab-item', { active: currentView === 'day' }]"
        @click="setView('day')"
      >
        日视图
      </view>
    </view>

    <view v-if="currentView === 'month'" class="calendar-container">
      <view class="calendar-header">
        <view class="nav-btn" @click="prevMonth">
          <text>◀</text>
        </view>
        <view class="month-title">{{ currentMonthStr }}</view>
        <view class="nav-btn" @click="nextMonth">
          <text>▶</text>
        </view>
        <view class="today-btn" @click="goToday">今天</view>
      </view>

      <view class="week-days-header">
        <view v-for="day in ['日', '一', '二', '三', '四', '五', '六']" :key="day" class="week-day">
          {{ day }}
        </view>
      </view>

      <view class="days-grid">
        <view 
          v-for="(day, index) in monthDays" 
          :key="index"
          :class="[
            'day-cell',
            { 'other-month': !day.isCurrentMonth },
            { 'today': day.isToday },
            { 'selected': day.isSelected }
          ]"
          @click="selectDate(day)"
        >
          <view class="day-number">{{ day.day }}</view>
          <view class="day-dots">
            <view 
              v-for="(schedule, sIndex) in day.schedules.slice(0, 3)" 
              :key="sIndex"
              class="dot"
              :style="{ backgroundColor: schedule.color }"
            ></view>
          </view>
        </view>
      </view>
    </view>

    <view v-if="currentView === 'week'" class="week-container">
      <view class="week-header">
        <view class="nav-btn" @click="prevWeek">
          <text>◀</text>
        </view>
        <view class="today-btn" @click="goToday">今天</view>
        <view class="nav-btn" @click="nextWeek">
          <text>▶</text>
        </view>
      </view>

      <view class="week-days">
        <view 
          v-for="(day, index) in weekDays" 
          :key="index"
          :class="[
            'week-day-card',
            { 'today': day.isToday },
            { 'selected': day.isSelected }
          ]"
          @click="selectDate(day)"
        >
          <view class="week-day-name">{{ day.weekDay }}</view>
          <view class="week-day-num">{{ day.day }}</view>
          <view class="week-day-dots">
            <view 
              v-for="(schedule, sIndex) in day.schedules.slice(0, 2)" 
              :key="sIndex"
              class="dot"
              :style="{ backgroundColor: schedule.color }"
            ></view>
          </view>
        </view>
      </view>

      <view class="day-schedules">
        <view class="section-title">
          <text class="kitty-icon">📅</text>
          <text>{{ selectedDate.getMonth() + 1 }}月{{ selectedDate.getDate() }}日 日程</text>
        </view>
        <view v-if="selectedDateSchedules.length === 0" class="empty-state">
          <text class="kitty-icon">🎀</text>
          <text>暂无日程安排</text>
        </view>
        <view v-else class="schedule-list">
          <view 
            v-for="schedule in selectedDateSchedules" 
            :key="schedule.id"
            class="schedule-item card"
            :style="{ borderLeftColor: schedule.color }"
          >
            <view class="schedule-info">
              <view class="schedule-time">
                {{ schedule.startTime }} - {{ schedule.endTime }}
              </view>
              <view class="schedule-title">{{ schedule.title }}</view>
              <view v-if="schedule.description" class="schedule-desc">
                {{ schedule.description }}
              </view>
              <view v-if="schedule.location" class="schedule-location">
                📍 {{ schedule.location }}
              </view>
            </view>
            <view class="schedule-actions">
              <view class="action-btn edit" @click="editSchedule(schedule)">编辑</view>
              <view class="action-btn delete" @click="deleteSchedule(schedule)">删除</view>
            </view>
          </view>
        </view>
      </view>
    </view>

    <view v-if="currentView === 'day'" class="day-container">
      <view class="day-header">
        <view class="nav-btn" @click="() => selectedDate = new Date(selectedDate.getTime() - 24 * 60 * 60 * 1000)">
          <text>◀</text>
        </view>
        <view class="date-display">
          {{ selectedDate.getFullYear() }}年{{ selectedDate.getMonth() + 1 }}月{{ selectedDate.getDate() }}日
        </view>
        <view class="today-btn" @click="goToday">今天</view>
        <view class="nav-btn" @click="() => selectedDate = new Date(selectedDate.getTime() + 24 * 60 * 60 * 1000)">
          <text>▶</text>
        </view>
      </view>

      <scroll-view scroll-y class="time-slots">
        <view 
          v-for="slot in dayTimeSlots" 
          :key="slot.time"
          class="time-slot"
        >
          <view class="time-label">{{ slot.time }}</view>
          <view class="time-content">
            <view 
              v-for="schedule in slot.schedules" 
              :key="schedule.id"
              class="time-schedule"
              :style="{ backgroundColor: schedule.color + '33', borderLeftColor: schedule.color }"
              @click="editSchedule(schedule)"
            >
              <view class="time-schedule-title">{{ schedule.title }}</view>
              <view class="time-schedule-time">{{ schedule.startTime }} - {{ schedule.endTime }}</view>
            </view>
          </view>
        </view>
      </scroll-view>
    </view>

    <view class="add-btn" @click="addSchedule">
      <text class="add-icon">+</text>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.schedule-page {
  min-height: 100vh;
  background-color: $bg-color;
  padding-bottom: 120rpx;
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

.view-tabs {
  display: flex;
  background-color: $white;
  padding: 16rpx 24rpx;
  gap: 16rpx;
  box-shadow: 0 2rpx 10rpx rgba(0, 0, 0, 0.05);
}

.tab-item {
  flex: 1;
  text-align: center;
  padding: 16rpx 0;
  border-radius: 20rpx;
  font-size: 28rpx;
  color: $text-muted;
  transition: all 0.3s;

  &.active {
    background: linear-gradient(135deg, $primary-color, $secondary-color);
    color: $white;
    font-weight: 500;
  }
}

.calendar-container {
  padding: 24rpx;
}

.calendar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24rpx;
}

.nav-btn {
  width: 60rpx;
  height: 60rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: $white;
  border-radius: 50%;
  box-shadow: 0 2rpx 10rpx rgba(0, 0, 0, 0.05);
  font-size: 24rpx;
}

.month-title {
  font-size: 36rpx;
  font-weight: 600;
  color: $text-color;
}

.today-btn {
  padding: 12rpx 24rpx;
  background: linear-gradient(135deg, $primary-color, $secondary-color);
  color: $white;
  border-radius: 20rpx;
  font-size: 24rpx;
}

.week-days-header {
  display: flex;
  background-color: $white;
  border-radius: 16rpx;
  padding: 16rpx 0;
  margin-bottom: 16rpx;
}

.week-day {
  flex: 1;
  text-align: center;
  font-size: 26rpx;
  color: $text-muted;
}

.days-grid {
  display: flex;
  flex-wrap: wrap;
  background-color: $white;
  border-radius: 16rpx;
  padding: 8rpx;
}

.day-cell {
  width: calc(100% / 7);
  aspect-ratio: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-radius: 12rpx;
  margin: 4rpx 0;
  position: relative;

  &.other-month {
    .day-number {
      color: $text-muted;
      opacity: 0.5;
    }
  }

  &.today {
    background-color: $secondary-color;

    .day-number {
      color: $primary-color;
      font-weight: 600;
    }
  }

  &.selected {
    background: linear-gradient(135deg, $primary-color, $secondary-color);

    .day-number {
      color: $white;
      font-weight: 600;
    }
  }
}

.day-number {
  font-size: 28rpx;
  color: $text-color;
}

.day-dots {
  display: flex;
  gap: 4rpx;
  margin-top: 4rpx;
}

.dot {
  width: 8rpx;
  height: 8rpx;
  border-radius: 50%;
}

.week-container {
  padding: 24rpx;
}

.week-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 24rpx;
  margin-bottom: 24rpx;
}

.week-days {
  display: flex;
  gap: 12rpx;
  margin-bottom: 24rpx;
}

.week-day-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20rpx 0;
  background-color: $white;
  border-radius: 16rpx;
  box-shadow: 0 2rpx 10rpx rgba(0, 0, 0, 0.05);

  &.today {
    background-color: $secondary-color;

    .week-day-name,
    .week-day-num {
      color: $primary-color;
    }
  }

  &.selected {
    background: linear-gradient(135deg, $primary-color, $secondary-color);

    .week-day-name,
    .week-day-num {
      color: $white;
    }
  }
}

.week-day-name {
  font-size: 24rpx;
  color: $text-muted;
  margin-bottom: 8rpx;
}

.week-day-num {
  font-size: 36rpx;
  font-weight: 600;
  color: $text-color;
}

.week-day-dots {
  display: flex;
  gap: 4rpx;
  margin-top: 8rpx;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 12rpx;
  font-size: 32rpx;
  font-weight: 600;
  color: $text-color;
  margin-bottom: 16rpx;
}

.kitty-icon {
  font-size: 36rpx;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80rpx 0;
  color: $text-muted;
  gap: 16rpx;
}

.schedule-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.schedule-item {
  border-left: 6rpx solid $primary-color;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.schedule-time {
  font-size: 26rpx;
  color: $primary-color;
  font-weight: 500;
  margin-bottom: 8rpx;
}

.schedule-title {
  font-size: 30rpx;
  font-weight: 600;
  color: $text-color;
  margin-bottom: 8rpx;
}

.schedule-desc,
.schedule-location {
  font-size: 24rpx;
  color: $text-muted;
}

.schedule-actions {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.action-btn {
  padding: 8rpx 20rpx;
  border-radius: 20rpx;
  font-size: 24rpx;

  &.edit {
    background-color: $primary-color + '22';
    color: $primary-color;
  }

  &.delete {
    background-color: $danger-color + '22';
    color: $danger-color;
  }
}

.day-container {
  padding: 24rpx;
}

.day-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24rpx;
}

.date-display {
  font-size: 32rpx;
  font-weight: 600;
  color: $text-color;
}

.time-slots {
  height: calc(100vh - 300rpx);
  background-color: $white;
  border-radius: 16rpx;
}

.time-slot {
  display: flex;
  min-height: 100rpx;
  border-bottom: 1rpx solid $border-color;
}

.time-label {
  width: 100rpx;
  padding: 16rpx;
  font-size: 24rpx;
  color: $text-muted;
  text-align: center;
  border-right: 1rpx solid $border-color;
}

.time-content {
  flex: 1;
  padding: 8rpx;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.time-schedule {
  padding: 12rpx;
  border-radius: 8rpx;
  border-left: 4rpx solid $primary-color;

  .time-schedule-title {
    font-size: 26rpx;
    font-weight: 600;
    color: $text-color;
  }

  .time-schedule-time {
    font-size: 22rpx;
    color: $text-muted;
    margin-top: 4rpx;
  }
}

.add-btn {
  position: fixed;
  right: 32rpx;
  bottom: 120rpx;
  width: 100rpx;
  height: 100rpx;
  background: linear-gradient(135deg, $primary-color, $secondary-color);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8rpx 24rpx rgba(255, 105, 180, 0.3);
}

.add-icon {
  font-size: 48rpx;
  color: $white;
  font-weight: 300;
}
</style>
