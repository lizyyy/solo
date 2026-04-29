import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { OperationType, UserProgress, TaskProgress, SkillProgress, DailyCheckIn, TaskStatus } from '../types';
import { getSkillsByPosition } from '../data/skills';
import { getTasksByPosition } from '../data/tasks';
import { getPositionById } from '../data/positions';

interface AppContextType {
  selectedPosition: OperationType | null;
  userProgress: UserProgress | null;
  selectPosition: (positionId: OperationType) => void;
  clearSelection: () => void;
  updateTaskProgress: (taskId: string, updates: Partial<TaskProgress>) => void;
  updateSkillProgress: (skillId: string, updates: Partial<SkillProgress>) => void;
  addDailyCheckIn: (checkIn: Omit<DailyCheckIn, 'date'>) => void;
  getTaskProgress: (taskId: string) => TaskProgress | undefined;
  getSkillProgress: (skillId: string) => SkillProgress | undefined;
  getOverallProgress: () => number;
  getWeeklyProgress: (weekNumber: number) => { total: number; completed: number; percentage: number };
  isPositionSelected: boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

const getTodayString = (): string => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
};

const STORAGE_KEY = 'operation_navigator_progress';

const migrateProgress = (progress: UserProgress): UserProgress => {
  const positionId = progress.positionId;
  const allSkills = getSkillsByPosition(positionId);
  const allTasks = getTasksByPosition(positionId);

  const existingSkillIds = new Set(progress.skills.map(s => s.skillId));
  const existingTaskIds = new Set(progress.tasks.map(t => t.taskId));

  const updatedSkills = [...progress.skills];
  allSkills.forEach((skill, index) => {
    if (!existingSkillIds.has(skill.id)) {
      updatedSkills.push({
        skillId: skill.id,
        status: index === 0 ? 'available' : 'locked',
        progressPercentage: 0,
        notes: '',
      });
    }
  });

  const updatedTasks = [...progress.tasks];
  allTasks.forEach(task => {
    if (!existingTaskIds.has(task.id)) {
      updatedTasks.push({
        taskId: task.id,
        status: 'pending',
        actualMinutes: 0,
        deliverableUrls: [],
        notes: '',
      });
    }
  });

  const availableSkill = updatedSkills.find(s => s.status === 'available');
  if (!availableSkill && updatedSkills.length > 0) {
    const firstLocked = updatedSkills.findIndex(s => s.status === 'locked');
    if (firstLocked !== -1) {
      updatedSkills[firstLocked].status = 'available';
    }
  }

  return {
    ...progress,
    skills: updatedSkills,
    tasks: updatedTasks,
  };
};

const loadFromStorage = (): UserProgress | null => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const progress = JSON.parse(stored);
      return migrateProgress(progress);
    }
  } catch (error) {
    console.error('Failed to load from storage:', error);
  }
  return null;
};

const saveToStorage = (progress: UserProgress): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch (error) {
    console.error('Failed to save to storage:', error);
  }
};

const initializeProgress = (positionId: OperationType): UserProgress => {
  const skills = getSkillsByPosition(positionId);
  const tasks = getTasksByPosition(positionId);

  const skillProgresses: SkillProgress[] = skills.map((skill, index) => ({
    skillId: skill.id,
    status: index === 0 ? 'available' : 'locked',
    progressPercentage: 0,
    notes: '',
  }));

  const taskProgresses: TaskProgress[] = tasks.map(task => ({
    taskId: task.id,
    status: 'pending',
    actualMinutes: 0,
    deliverableUrls: [],
    notes: '',
  }));

  return {
    id: generateId(),
    positionId,
    selectedAt: new Date().toISOString(),
    currentWeek: 1,
    skills: skillProgresses,
    tasks: taskProgresses,
    dailyCheckIns: [],
  };
};

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [userProgress, setUserProgress] = useState<UserProgress | null>(() => {
    return loadFromStorage();
  });

  const [selectedPosition, setSelectedPosition] = useState<OperationType | null>(() => {
    const stored = loadFromStorage();
    return stored ? stored.positionId : null;
  });

  useEffect(() => {
    if (userProgress) {
      saveToStorage(userProgress);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [userProgress]);

  const selectPosition = (positionId: OperationType) => {
    const position = getPositionById(positionId);
    if (!position) return;

    const newProgress = initializeProgress(positionId);
    setUserProgress(newProgress);
    setSelectedPosition(positionId);
  };

  const clearSelection = () => {
    setUserProgress(null);
    setSelectedPosition(null);
  };

  const updateTaskProgress = (taskId: string, updates: Partial<TaskProgress>) => {
    setUserProgress(prev => {
      if (!prev) return prev;

      const existingTaskIndex = prev.tasks.findIndex(t => t.taskId === taskId);
      let updatedTasks;

      if (existingTaskIndex >= 0) {
        updatedTasks = prev.tasks.map(task =>
          task.taskId === taskId ? { ...task, ...updates } : task
        );
      } else {
        const newTask: TaskProgress = {
          taskId,
          status: updates.status || 'pending',
          startedAt: updates.startedAt,
          completedAt: updates.completedAt,
          actualMinutes: updates.actualMinutes || 0,
          deliverableUrls: updates.deliverableUrls || [],
          notes: updates.notes || '',
          ...updates,
        };
        updatedTasks = [...prev.tasks, newTask];
      }

      const completedTasks = updatedTasks.filter(t => t.status === 'completed').length;
      const totalTasks = updatedTasks.length;
      const newCurrentWeek = Math.min(
        Math.floor((completedTasks / totalTasks) * 12) + 1,
        12
      );

      return {
        ...prev,
        tasks: updatedTasks,
        currentWeek: newCurrentWeek,
      };
    });
  };

  const updateSkillProgress = (skillId: string, updates: Partial<SkillProgress>) => {
    if (!userProgress) return;

    setUserProgress(prev => {
      if (!prev) return prev;

      const updatedSkills = prev.skills.map(skill =>
        skill.skillId === skillId ? { ...skill, ...updates } : skill
      );

      const currentIndex = updatedSkills.findIndex(s => s.skillId === skillId);
      if (updates.status === 'completed' && currentIndex < updatedSkills.length - 1) {
        updatedSkills[currentIndex + 1].status = 'available';
      }

      return {
        ...prev,
        skills: updatedSkills,
      };
    });
  };

  const addDailyCheckIn = (checkIn: Omit<DailyCheckIn, 'date'>) => {
    if (!userProgress) return;

    const today = getTodayString();
    const existingIndex = userProgress.dailyCheckIns.findIndex(c => c.date === today);

    setUserProgress(prev => {
      if (!prev) return prev;

      const newCheckIn: DailyCheckIn = {
        ...checkIn,
        date: today,
      };

      let updatedCheckIns;
      if (existingIndex >= 0) {
        updatedCheckIns = [...prev.dailyCheckIns];
        updatedCheckIns[existingIndex] = newCheckIn;
      } else {
        updatedCheckIns = [...prev.dailyCheckIns, newCheckIn];
      }

      return {
        ...prev,
        dailyCheckIns: updatedCheckIns,
      };
    });
  };

  const getTaskProgress = (taskId: string): TaskProgress | undefined => {
    return userProgress?.tasks.find(t => t.taskId === taskId);
  };

  const getSkillProgress = (skillId: string): SkillProgress | undefined => {
    return userProgress?.skills.find(s => s.skillId === skillId);
  };

  const getOverallProgress = (): number => {
    if (!userProgress) return 0;

    const completedTasks = userProgress.tasks.filter(t => t.status === 'completed').length;
    const totalTasks = userProgress.tasks.length;

    return totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  };

  const getWeeklyProgress = (weekNumber: number) => {
    if (!userProgress || !selectedPosition) {
      return { total: 0, completed: 0, percentage: 0 };
    }

    const tasks = getTasksByPosition(selectedPosition);
    const weekTasks = tasks.filter(t => t.weekNumber === weekNumber);
    const total = weekTasks.length;

    const completed = weekTasks.filter(task => {
      const progress = getTaskProgress(task.id);
      return progress?.status === 'completed';
    }).length;

    return {
      total,
      completed,
      percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  };

  const value: AppContextType = {
    selectedPosition,
    userProgress,
    selectPosition,
    clearSelection,
    updateTaskProgress,
    updateSkillProgress,
    addDailyCheckIn,
    getTaskProgress,
    getSkillProgress,
    getOverallProgress,
    getWeeklyProgress,
    isPositionSelected: selectedPosition !== null,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = (): AppContextType => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
