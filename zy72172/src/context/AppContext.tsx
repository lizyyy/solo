import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { AppData, SignalPoint, Feedback, PlanVersion, InspectionPhoto, ReviewReport } from '../types';
import { loadData, saveData } from '../utils/storage';

interface AppContextType {
  data: AppData;
  setData: React.Dispatch<React.SetStateAction<AppData>>;
  updatePoint: (point: SignalPoint) => void;
  addFeedback: (feedback: Feedback) => void;
  addReport: (report: ReviewReport) => void;
  resetData: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(() => loadData());

  useEffect(() => {
    const timer = setTimeout(() => {
      saveData(data);
    }, 500);
    return () => clearTimeout(timer);
  }, [data]);

  const updatePoint = useCallback((point: SignalPoint) => {
    setData(prev => ({
      ...prev,
      points: prev.points.map(p => p.id === point.id ? { ...point, updatedAt: new Date().toISOString() } : p)
    }));
  }, []);

  const addFeedback = useCallback((feedback: Feedback) => {
    setData(prev => ({
      ...prev,
      feedbacks: [...prev.feedbacks, feedback]
    }));
  }, []);

  const addReport = useCallback((report: ReviewReport) => {
    setData(prev => ({
      ...prev,
      reports: [...prev.reports.filter(r => r.pointId !== report.pointId), report]
    }));
  }, []);

  const resetData = useCallback(() => {
    localStorage.removeItem('busSignalReviewData');
    setData(loadData());
  }, []);

  return (
    <AppContext.Provider value={{ data, setData, updatePoint, addFeedback, addReport, resetData }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}
