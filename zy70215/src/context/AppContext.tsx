import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import type { DataState, Screening, CleaningTask, LostItem, EquipmentIssue, TabType } from '../types';
import { loadData, saveData, generateId, formatDateTime } from '../utils/storage';
import { createScreening, parseScreeningsText } from '../utils/screeningParser';
import { hasDataChanged, exportToExcel } from '../utils/export';

interface AppContextType {
  data: DataState;
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  selectedScreening: Screening | null;
  setSelectedScreening: (s: Screening | null) => void;
  selectedTask: CleaningTask | null;
  setSelectedTask: (t: CleaningTask | null) => void;
  importScreenings: (text: string) => { added: number; skipped: number };
  generateCleaningTasks: () => void;
  startTask: (taskId: string, staff: string) => void;
  completeTask: (taskId: string, score: number, notes?: string) => void;
  addLostItem: (task: CleaningTask, item: Omit<LostItem, 'id' | 'cleaningTaskId' | 'screeningId' | 'hallNumber' | 'foundTime' | 'createdAt'>) => void;
  updateLostItem: (id: string, updates: Partial<LostItem>) => void;
  addEquipmentIssue: (task: CleaningTask, issue: Omit<EquipmentIssue, 'id' | 'cleaningTaskId' | 'screeningId' | 'hallNumber' | 'reportedTime' | 'createdAt'>) => void;
  updateEquipmentIssue: (id: string, updates: Partial<EquipmentIssue>) => void;
  exportData: () => void;
  canExport: boolean;
  clearAllData: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<DataState>(() => loadData());
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [selectedScreening, setSelectedScreening] = useState<Screening | null>(null);
  const [selectedTask, setSelectedTask] = useState<CleaningTask | null>(null);

  useEffect(() => {
    saveData(data);
  }, [data]);

  const importScreenings = useCallback((text: string) => {
    const parsed = parseScreeningsText(text);
    const existingIds = new Set(data.screenings.map(s => `${s.date}_${s.hallNumber}_${s.startTime}`));

    let added = 0;
    let skipped = 0;
    const newScreenings: Screening[] = [];

    for (const p of parsed) {
      const key = `${p.date}_${p.hallNumber}_${p.startTime}`;
      if (existingIds.has(key)) {
        skipped++;
      } else {
        newScreenings.push(createScreening(p));
        added++;
      }
    }

    if (added > 0) {
      setData(prev => ({
        ...prev,
        screenings: [...prev.screenings, ...newScreenings],
      }));
    }

    return { added, skipped };
  }, [data.screenings]);

  const generateCleaningTasks = useCallback(() => {
    const screeningsByHall: Record<string, Screening[]> = {};
    for (const s of data.screenings) {
      if (!screeningsByHall[s.hallNumber]) {
        screeningsByHall[s.hallNumber] = [];
      }
      screeningsByHall[s.hallNumber].push(s);
    }

    for (const hallNumber in screeningsByHall) {
      screeningsByHall[hallNumber].sort((a, b) => a.startTime.localeCompare(b.startTime));
    }

    const existingScreeningIds = new Set(data.cleaningTasks.map(t => t.screeningId));
    const newTasks: CleaningTask[] = [];

    for (const hallNumber in screeningsByHall) {
      const screenings = screeningsByHall[hallNumber];
      for (let i = 0; i < screenings.length; i++) {
        const s = screenings[i];
        if (existingScreeningIds.has(s.id)) continue;

        const nextScreening = screenings[i + 1];
        const deadlineMinutes = nextScreening ? 25 : 60;

        const [endH, endM] = s.endTime.split(':').map(Number);
        const deadlineDate = new Date();
        deadlineDate.setHours(endH, endM + deadlineMinutes, 0, 0);

        newTasks.push({
          id: generateId(),
          screeningId: s.id,
          hallNumber: s.hallNumber,
          movieName: s.movieName,
          screeningEndTime: s.endTime,
          nextScreeningStartTime: nextScreening ? nextScreening.startTime : null,
          deadline: formatDateTime(deadlineDate),
          status: 'pending',
          assignedTo: '',
          createdBy: 'system',
          createdAt: formatDateTime(new Date()),
        });
      }
    }

    if (newTasks.length > 0) {
      setData(prev => ({
        ...prev,
        cleaningTasks: [...prev.cleaningTasks, ...newTasks],
      }));
    }
  }, [data.screenings, data.cleaningTasks]);

  const startTask = useCallback((taskId: string, staff: string) => {
    setData(prev => ({
      ...prev,
      cleaningTasks: prev.cleaningTasks.map(t =>
        t.id === taskId
          ? { ...t, status: 'in_progress' as const, assignedTo: staff, startTime: formatDateTime(new Date()) }
          : t
      ),
    }));
  }, []);

  const completeTask = useCallback((taskId: string, score: number, notes?: string) => {
    const now = new Date();
    setData(prev => {
      const task = prev.cleaningTasks.find(t => t.id === taskId);
      if (!task) return prev;

      const deadline = new Date(task.deadline.replace(' ', 'T'));
      const isOverdue = now > deadline;

      return {
        ...prev,
        cleaningTasks: prev.cleaningTasks.map(t =>
          t.id === taskId
            ? {
                ...t,
                status: (isOverdue ? 'overdue' : 'completed') as CleaningTask['status'],
                endTime: formatDateTime(now),
                qualityScore: score,
                notes,
              }
            : t
        ),
      };
    });
  }, []);

  const addLostItem = useCallback((task: CleaningTask, item: Omit<LostItem, 'id' | 'cleaningTaskId' | 'screeningId' | 'hallNumber' | 'foundTime' | 'createdAt'>) => {
    const newItem: LostItem = {
      ...item,
      id: generateId(),
      cleaningTaskId: task.id,
      screeningId: task.screeningId,
      hallNumber: task.hallNumber,
      foundTime: formatDateTime(new Date()),
      createdAt: formatDateTime(new Date()),
    };
    setData(prev => ({
      ...prev,
      lostItems: [...prev.lostItems, newItem],
    }));
  }, []);

  const updateLostItem = useCallback((id: string, updates: Partial<LostItem>) => {
    setData(prev => ({
      ...prev,
      lostItems: prev.lostItems.map(l => (l.id === id ? { ...l, ...updates } : l)),
    }));
  }, []);

  const addEquipmentIssue = useCallback((task: CleaningTask, issue: Omit<EquipmentIssue, 'id' | 'cleaningTaskId' | 'screeningId' | 'hallNumber' | 'reportedTime' | 'createdAt'>) => {
    const newIssue: EquipmentIssue = {
      ...issue,
      id: generateId(),
      cleaningTaskId: task.id,
      screeningId: task.screeningId,
      hallNumber: task.hallNumber,
      reportedTime: formatDateTime(new Date()),
      createdAt: formatDateTime(new Date()),
    };
    setData(prev => ({
      ...prev,
      equipmentIssues: [...prev.equipmentIssues, newIssue],
    }));
  }, []);

  const updateEquipmentIssue = useCallback((id: string, updates: Partial<EquipmentIssue>) => {
    setData(prev => ({
      ...prev,
      equipmentIssues: prev.equipmentIssues.map(e => (e.id === id ? { ...e, ...updates } : e)),
    }));
  }, []);

  const exportData = useCallback(() => {
    exportToExcel(data);
  }, [data]);

  const canExport = hasDataChanged(data);

  const clearAllData = useCallback(() => {
    setData({
      screenings: [],
      cleaningTasks: [],
      lostItems: [],
      equipmentIssues: [],
    });
  }, []);

  const value: AppContextType = {
    data,
    activeTab,
    setActiveTab,
    selectedScreening,
    setSelectedScreening,
    selectedTask,
    setSelectedTask,
    importScreenings,
    generateCleaningTasks,
    startTask,
    completeTask,
    addLostItem,
    updateLostItem,
    addEquipmentIssue,
    updateEquipmentIssue,
    exportData,
    canExport,
    clearAllData,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
