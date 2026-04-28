import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { FocusRecord, FocusType, FocusStatus } from '@/types';

const STORAGE_KEY = 'hellokitty_focus_records';

export const useFocusStore = defineStore('focus', () => {
  const records = ref<FocusRecord[]>([]);
  const currentTimer = ref<FocusRecord | null>(null);
  const timerInterval = ref<number | null>(null);

  function loadRecords() {
    try {
      const stored = uni.getStorageSync(STORAGE_KEY);
      if (stored) {
        records.value = JSON.parse(stored);
      }
    } catch (e) {
      console.error('Failed to load focus records:', e);
    }
  }

  function saveRecords() {
    try {
      uni.setStorageSync(STORAGE_KEY, JSON.stringify(records.value));
    } catch (e) {
      console.error('Failed to save focus records:', e);
    }
  }

  function generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  function startTimer(type: FocusType, duration: number, taskName: string = ''): FocusRecord {
    if (currentTimer.value && currentTimer.value.status === 'running') {
      pauseTimer();
    }

    const record: FocusRecord = {
      id: generateId(),
      type,
      duration,
      remainingTime: duration,
      status: 'running',
      startTime: Date.now(),
      endTime: null,
      taskName: taskName || (type === 'pomodoro' ? '番茄钟专注' : type === 'countdown' ? '倒计时专注' : '正计时专注'),
      createdAt: Date.now()
    };

    currentTimer.value = record;
    startCountdown();

    return record;
  }

  function startCountdown() {
    if (timerInterval.value) {
      clearInterval(timerInterval.value);
    }

    timerInterval.value = setInterval(() => {
      if (!currentTimer.value || currentTimer.value.status !== 'running') return;

      if (currentTimer.value.type === 'stopwatch') {
        currentTimer.value.remainingTime++;
      } else {
        if (currentTimer.value.remainingTime > 0) {
          currentTimer.value.remainingTime--;
        } else {
          completeTimer();
        }
      }
    }, 1000) as unknown as number;
  }

  function pauseTimer() {
    if (!currentTimer.value || currentTimer.value.status !== 'running') return;

    currentTimer.value.status = 'paused';
    if (timerInterval.value) {
      clearInterval(timerInterval.value);
      timerInterval.value = null;
    }
  }

  function resumeTimer() {
    if (!currentTimer.value || currentTimer.value.status !== 'paused') return;

    currentTimer.value.status = 'running';
    startCountdown();
  }

  function stopTimer() {
    if (!currentTimer.value) return;

    if (timerInterval.value) {
      clearInterval(timerInterval.value);
      timerInterval.value = null;
    }

    currentTimer.value.status = 'interrupted';
    currentTimer.value.endTime = Date.now();
    records.value.push({ ...currentTimer.value });
    saveRecords();

    currentTimer.value = null;
  }

  function completeTimer() {
    if (!currentTimer.value) return;

    if (timerInterval.value) {
      clearInterval(timerInterval.value);
      timerInterval.value = null;
    }

    currentTimer.value.status = 'completed';
    currentTimer.value.endTime = Date.now();
    records.value.push({ ...currentTimer.value });
    saveRecords();

    uni.showToast({
      title: '专注完成！🎉',
      icon: 'success',
      duration: 2000
    });

    currentTimer.value = null;
  }

  function getTodayRecords(): FocusRecord[] {
    const today = new Date().toISOString().split('T')[0];
    return records.value.filter(r => {
      const recordDate = new Date(r.createdAt).toISOString().split('T')[0];
      return recordDate === today;
    });
  }

  function getWeekRecords(): FocusRecord[] {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return records.value.filter(r => r.createdAt >= weekAgo.getTime());
  }

  const totalFocusMinutes = computed(() => {
    return records.value
      .filter(r => r.status === 'completed')
      .reduce((sum, r) => {
        const actualTime = r.type === 'stopwatch' ? r.remainingTime : (r.duration - r.remainingTime);
        return sum + Math.floor(actualTime / 60);
      }, 0);
  });

  const todayFocusMinutes = computed(() => {
    const todayRecords = getTodayRecords();
    return todayRecords
      .filter(r => r.status === 'completed')
      .reduce((sum, r) => {
        const actualTime = r.type === 'stopwatch' ? r.remainingTime : (r.duration - r.remainingTime);
        return sum + Math.floor(actualTime / 60);
      }, 0);
  });

  const pomodoroCount = computed(() => {
    return records.value.filter(r => r.type === 'pomodoro' && r.status === 'completed').length;
  });

  const presets = {
    pomodoro: [
      { name: '25分钟', duration: 25 * 60 },
      { name: '30分钟', duration: 30 * 60 },
      { name: '45分钟', duration: 45 * 60 },
      { name: '60分钟', duration: 60 * 60 }
    ],
    countdown: [
      { name: '10分钟', duration: 10 * 60 },
      { name: '25分钟', duration: 25 * 60 },
      { name: '45分钟', duration: 45 * 60 },
      { name: '60分钟', duration: 60 * 60 },
      { name: '90分钟', duration: 90 * 60 }
    ]
  };

  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  loadRecords();

  return {
    records,
    currentTimer,
    presets,
    totalFocusMinutes,
    todayFocusMinutes,
    pomodoroCount,
    loadRecords,
    startTimer,
    pauseTimer,
    resumeTimer,
    stopTimer,
    completeTimer,
    getTodayRecords,
    getWeekRecords,
    formatTime
  };
});
