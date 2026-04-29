import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { Schedule } from '@/types';

const STORAGE_KEY = 'hellokitty_schedules';

export const useScheduleStore = defineStore('schedule', () => {
  const schedules = ref<Schedule[]>([]);

  function loadSchedules() {
    try {
      const stored = uni.getStorageSync(STORAGE_KEY);
      if (stored) {
        schedules.value = JSON.parse(stored);
      }
    } catch (e) {
      console.error('Failed to load schedules:', e);
    }
  }

  function saveSchedules() {
    try {
      uni.setStorageSync(STORAGE_KEY, JSON.stringify(schedules.value));
    } catch (e) {
      console.error('Failed to save schedules:', e);
    }
  }

  function generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  function getSchedulesByDate(date: string): Schedule[] {
    return schedules.value.filter(s => s.date === date);
  }

  function getSchedulesByMonth(year: number, month: number): Schedule[] {
    const monthStr = `${year}-${String(month).padStart(2, '0')}`;
    return schedules.value.filter(s => s.date.startsWith(monthStr));
  }

  function getSchedulesByWeek(startDate: Date): Schedule[] {
    const dates: string[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      dates.push(date.toISOString().split('T')[0]);
    }
    return schedules.value.filter(s => dates.includes(s.date));
  }

  function addSchedule(schedule: Omit<Schedule, 'id' | 'createdAt' | 'updatedAt'>): Schedule {
    const newSchedule: Schedule = {
      ...schedule,
      id: generateId(),
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    schedules.value.push(newSchedule);
    saveSchedules();
    return newSchedule;
  }

  function updateSchedule(id: string, updates: Partial<Omit<Schedule, 'id' | 'createdAt'>>): boolean {
    const index = schedules.value.findIndex(s => s.id === id);
    if (index !== -1) {
      schedules.value[index] = {
        ...schedules.value[index],
        ...updates,
        updatedAt: Date.now()
      };
      saveSchedules();
      return true;
    }
    return false;
  }

  function deleteSchedule(id: string): boolean {
    const index = schedules.value.findIndex(s => s.id === id);
    if (index !== -1) {
      schedules.value.splice(index, 1);
      saveSchedules();
      return true;
    }
    return false;
  }

  function getUpcomingSchedules(): Schedule[] {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const nowTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    return schedules.value
      .filter(s => {
        if (s.date > today) return true;
        if (s.date === today && s.startTime > nowTime) return true;
        return false;
      })
      .sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return a.startTime.localeCompare(b.startTime);
      })
      .slice(0, 10);
  }

  const scheduleColors = [
    '#FF69B4',
    '#FFB6C1',
    '#FF6B6B',
    '#4ECDC4',
    '#45B7D1',
    '#96CEB4',
    '#FFEAA7',
    '#DDA0DD'
  ];

  loadSchedules();

  return {
    schedules,
    scheduleColors,
    loadSchedules,
    getSchedulesByDate,
    getSchedulesByMonth,
    getSchedulesByWeek,
    addSchedule,
    updateSchedule,
    deleteSchedule,
    getUpcomingSchedules
  };
});
