import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Measurement, RecommendationResult, HistoryRecord, AppContextType } from '../types';
import { recommendationService, getCurrentMeasurement, getCurrentRecommendation } from '../services/recommendationService';

const AppContext = createContext<AppContextType | null>(null);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentMeasurement, setCurrentMeasurement] = useState<Measurement | null>(null);
  const [currentRecommendation, setCurrentRecommendation] = useState<RecommendationResult | null>(null);
  const [historyRecords, setHistoryRecords] = useState<HistoryRecord[]>([]);

  useEffect(() => {
    const savedMeasurement = getCurrentMeasurement();
    const savedRecommendation = getCurrentRecommendation();
    const savedRecords = recommendationService.getAllHistoryRecords();

    if (savedMeasurement) setCurrentMeasurement(savedMeasurement);
    if (savedRecommendation) setCurrentRecommendation(savedRecommendation);
    setHistoryRecords(savedRecords);
  }, []);

  const addHistoryRecord = (record: Omit<HistoryRecord, 'id' | 'createdAt' | 'updatedAt'>): string => {
    const newRecord = recommendationService.createHistoryRecord(
      record.petName,
      record.measurement,
      record.recommendation
    );
    setHistoryRecords(recommendationService.getAllHistoryRecords());
    return newRecord.id;
  };

  const updateHistoryRecord = (id: string, updates: Partial<HistoryRecord>): void => {
    recommendationService.updateHistoryRecord(id, updates);
    setHistoryRecords(recommendationService.getAllHistoryRecords());
  };

  const deleteHistoryRecord = (id: string): void => {
    recommendationService.deleteHistoryRecord(id);
    setHistoryRecords(recommendationService.getAllHistoryRecords());
  };

  const value: AppContextType = {
    currentMeasurement,
    setCurrentMeasurement,
    currentRecommendation,
    setCurrentRecommendation,
    historyRecords,
    addHistoryRecord,
    updateHistoryRecord,
    deleteHistoryRecord,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useAppContext = (): AppContextType => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};
