export interface Schedule {
  id: string;
  title: string;
  description: string;
  date: string;
  startTime: string;
  endTime: string;
  color: string;
  isAllDay: boolean;
  location: string;
  remindMinutesBefore: number;
  createdAt: number;
  updatedAt: number;
}

export interface Todo {
  id: string;
  title: string;
  description: string;
  isImportant: boolean;
  isUrgent: boolean;
  category: TodoCategory;
  priority: TodoPriority;
  dueDate: string | null;
  dueTime: string | null;
  remindAt: string | null;
  isCompleted: boolean;
  completedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export type TodoCategory = 'important-urgent' | 'important-not-urgent' | 'not-important-urgent' | 'not-important-not-urgent';
export type TodoPriority = 'high' | 'medium' | 'low';

export interface FocusRecord {
  id: string;
  type: FocusType;
  duration: number;
  remainingTime: number;
  status: FocusStatus;
  startTime: number;
  endTime: number | null;
  taskName: string;
  createdAt: number;
}

export type FocusType = 'countdown' | 'pomodoro' | 'stopwatch';
export type FocusStatus = 'running' | 'paused' | 'completed' | 'interrupted';

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlockedAt: number | null;
  isUnlocked: boolean;
  condition: AchievementCondition;
  progress: number;
  target: number;
}

export interface AchievementCondition {
  type: 'focus-hours' | 'completed-todos' | 'streak-days' | 'total-days';
  value: number;
}

export interface UserProfile {
  id: string;
  nickname: string;
  avatar: string;
  theme: string;
  totalFocusHours: number;
  totalCompletedTodos: number;
  currentStreak: number;
  usingDays: number;
  createdAt: number;
}

export interface Theme {
  id: string;
  name: string;
  primaryColor: string;
  secondaryColor: string;
  bgColor: string;
  isActive: boolean;
}
