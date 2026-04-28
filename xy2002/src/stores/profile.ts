import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { UserProfile, Theme, Achievement, AchievementCondition } from '@/types';

const PROFILE_STORAGE_KEY = 'hellokitty_profile';
const ACHIEVEMENT_STORAGE_KEY = 'hellokitty_achievements';

const defaultAchievements: Achievement[] = [
  {
    id: 'first-focus',
    name: '初次专注',
    description: '完成第一次专注',
    icon: '🎀',
    unlockedAt: null,
    isUnlocked: false,
    condition: { type: 'focus-hours', value: 0.01 },
    progress: 0,
    target: 1
  },
  {
    id: 'focus-1-hour',
    name: '专注一小时',
    description: '累计专注满1小时',
    icon: '⏰',
    unlockedAt: null,
    isUnlocked: false,
    condition: { type: 'focus-hours', value: 1 },
    progress: 0,
    target: 1
  },
  {
    id: 'focus-10-hours',
    name: '专注达人',
    description: '累计专注满10小时',
    icon: '🏆',
    unlockedAt: null,
    isUnlocked: false,
    condition: { type: 'focus-hours', value: 10 },
    progress: 0,
    target: 10
  },
  {
    id: 'focus-100-hours',
    name: '专注大师',
    description: '累计专注满100小时',
    icon: '👑',
    unlockedAt: null,
    isUnlocked: false,
    condition: { type: 'focus-hours', value: 100 },
    progress: 0,
    target: 100
  },
  {
    id: 'first-todo',
    name: '任务开始',
    description: '完成第一个待办任务',
    icon: '📝',
    unlockedAt: null,
    isUnlocked: false,
    condition: { type: 'completed-todos', value: 1 },
    progress: 0,
    target: 1
  },
  {
    id: 'todos-10',
    name: '任务达人',
    description: '累计完成10个待办任务',
    icon: '✅',
    unlockedAt: null,
    isUnlocked: false,
    condition: { type: 'completed-todos', value: 10 },
    progress: 0,
    target: 10
  },
  {
    id: 'todos-100',
    name: '任务大师',
    description: '累计完成100个待办任务',
    icon: '🌟',
    unlockedAt: null,
    isUnlocked: false,
    condition: { type: 'completed-todos', value: 100 },
    progress: 0,
    target: 100
  },
  {
    id: 'streak-3-days',
    name: '坚持3天',
    description: '连续使用3天',
    icon: '🔥',
    unlockedAt: null,
    isUnlocked: false,
    condition: { type: 'streak-days', value: 3 },
    progress: 0,
    target: 3
  },
  {
    id: 'streak-7-days',
    name: '坚持一周',
    description: '连续使用7天',
    icon: '🌈',
    unlockedAt: null,
    isUnlocked: false,
    condition: { type: 'streak-days', value: 7 },
    progress: 0,
    target: 7
  },
  {
    id: 'streak-30-days',
    name: '坚持一月',
    description: '连续使用30天',
    icon: '🎊',
    unlockedAt: null,
    isUnlocked: false,
    condition: { type: 'streak-days', value: 30 },
    progress: 0,
    target: 30
  },
  {
    id: 'using-30-days',
    name: '老用户',
    description: '累计使用30天',
    icon: '💝',
    unlockedAt: null,
    isUnlocked: false,
    condition: { type: 'total-days', value: 30 },
    progress: 0,
    target: 30
  },
  {
    id: 'using-100-days',
    name: '忠实用户',
    description: '累计使用100天',
    icon: '💎',
    unlockedAt: null,
    isUnlocked: false,
    condition: { type: 'total-days', value: 100 },
    progress: 0,
    target: 100
  }
];

const defaultThemes: Theme[] = [
  {
    id: 'pink',
    name: '经典粉',
    primaryColor: '#FF69B4',
    secondaryColor: '#FFC0CB',
    bgColor: '#FFF5F8',
    isActive: true
  },
  {
    id: 'purple',
    name: '梦幻紫',
    primaryColor: '#9370DB',
    secondaryColor: '#E6E6FA',
    bgColor: '#FAF8FF',
    isActive: false
  },
  {
    id: 'blue',
    name: '清新蓝',
    primaryColor: '#6495ED',
    secondaryColor: '#ADD8E6',
    bgColor: '#F0F8FF',
    isActive: false
  },
  {
    id: 'green',
    name: '自然绿',
    primaryColor: '#3CB371',
    secondaryColor: '#98FB98',
    bgColor: '#F0FFF0',
    isActive: false
  }
];

export const useProfileStore = defineStore('profile', () => {
  const profile = ref<UserProfile>({
    id: 'default',
    nickname: 'HelloKitty',
    avatar: '',
    theme: 'pink',
    totalFocusHours: 0,
    totalCompletedTodos: 0,
    currentStreak: 0,
    usingDays: 1,
    createdAt: Date.now()
  });

  const achievements = ref<Achievement[]>(defaultAchievements);
  const themes = ref<Theme[]>(defaultThemes);

  function loadProfile() {
    try {
      const stored = uni.getStorageSync(PROFILE_STORAGE_KEY);
      if (stored) {
        profile.value = { ...profile.value, ...JSON.parse(stored) };
      }
      updateUsingDays();
    } catch (e) {
      console.error('Failed to load profile:', e);
    }
  }

  function loadAchievements() {
    try {
      const stored = uni.getStorageSync(ACHIEVEMENT_STORAGE_KEY);
      if (stored) {
        achievements.value = JSON.parse(stored);
      }
    } catch (e) {
      console.error('Failed to load achievements:', e);
    }
  }

  function saveProfile() {
    try {
      uni.setStorageSync(PROFILE_STORAGE_KEY, JSON.stringify(profile.value));
    } catch (e) {
      console.error('Failed to save profile:', e);
    }
  }

  function saveAchievements() {
    try {
      uni.setStorageSync(ACHIEVEMENT_STORAGE_KEY, JSON.stringify(achievements.value));
    } catch (e) {
      console.error('Failed to save achievements:', e);
    }
  }

  function updateUsingDays() {
    const lastUseDate = uni.getStorageSync('last_use_date');
    const today = new Date().toISOString().split('T')[0];

    if (lastUseDate) {
      const lastDate = new Date(lastUseDate);
      const currentDate = new Date(today);
      const diffDays = Math.floor((currentDate.getTime() - lastDate.getTime()) / (24 * 60 * 60 * 1000));

      if (diffDays === 1) {
        profile.value.currentStreak++;
      } else if (diffDays > 1) {
        profile.value.currentStreak = 1;
      }
    }

    profile.value.usingDays++;
    uni.setStorageSync('last_use_date', today);
    saveProfile();
  }

  function updateNickname(nickname: string) {
    profile.value.nickname = nickname;
    saveProfile();
  }

  function updateAvatar(avatar: string) {
    profile.value.avatar = avatar;
    saveProfile();
  }

  function updateTheme(themeId: string) {
    profile.value.theme = themeId;
    themes.value = themes.value.map(t => ({
      ...t,
      isActive: t.id === themeId
    }));
    saveProfile();
  }

  const currentTheme = computed(() => {
    return themes.value.find(t => t.id === profile.value.theme) || themes.value[0];
  });

  function addFocusHours(hours: number) {
    profile.value.totalFocusHours += hours;
    saveProfile();
    checkAchievements();
  }

  function addCompletedTodo() {
    profile.value.totalCompletedTodos++;
    saveProfile();
    checkAchievements();
  }

  function checkAchievements() {
    let hasUnlocks = false;

    achievements.value = achievements.value.map(achievement => {
      if (achievement.isUnlocked) return achievement;

      let progress = 0;
      switch (achievement.condition.type) {
        case 'focus-hours':
          progress = profile.value.totalFocusHours;
          break;
        case 'completed-todos':
          progress = profile.value.totalCompletedTodos;
          break;
        case 'streak-days':
          progress = profile.value.currentStreak;
          break;
        case 'total-days':
          progress = profile.value.usingDays;
          break;
      }

      achievement.progress = Math.min(progress, achievement.target);

      if (progress >= achievement.condition.value && !achievement.isUnlocked) {
        achievement.isUnlocked = true;
        achievement.unlockedAt = Date.now();
        hasUnlocks = true;

        uni.showToast({
          title: `解锁成就：${achievement.name} ${achievement.icon}`,
          icon: 'none',
          duration: 3000
        });
      }

      return achievement;
    });

    if (hasUnlocks) {
      saveAchievements();
    }
  }

  const unlockedAchievements = computed(() => 
    achievements.value.filter(a => a.isUnlocked)
  );

  const lockedAchievements = computed(() => 
    achievements.value.filter(a => !a.isUnlocked)
  );

  loadProfile();
  loadAchievements();
  checkAchievements();

  return {
    profile,
    achievements,
    themes,
    currentTheme,
    unlockedAchievements,
    lockedAchievements,
    loadProfile,
    loadAchievements,
    updateNickname,
    updateAvatar,
    updateTheme,
    addFocusHours,
    addCompletedTodo,
    checkAchievements
  };
});
