import { useCallback, useEffect, useState } from 'react';
import type { AppState, Issue, Rectification, Stall, InspectionRecord } from '../types';
import { getSampleData } from '../data/sampleData';

const STORAGE_KEY = 'night-market-inspection-data';

export const useAppStore = () => {
  const [state, setState] = useState<AppState>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return getSampleData();
      }
    }
    return getSampleData();
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const resetToSampleData = useCallback(() => {
    const sampleData = getSampleData();
    setState(sampleData);
  }, []);

  const updateStallStatus = useCallback((stallId: string, status: Stall['status']) => {
    setState((prev) => ({
      ...prev,
      stalls: prev.stalls.map((stall) =>
        stall.id === stallId ? { ...stall, status } : stall
      ),
    }));
  }, []);

  const addIssue = useCallback((issue: Omit<Issue, 'id'>) => {
    const newIssue: Issue = {
      ...issue,
      id: `issue-${Date.now()}`,
    };
    setState((prev) => ({
      ...prev,
      issues: [...prev.issues, newIssue],
    }));
    return newIssue;
  }, []);

  const addRectification = useCallback((rectification: Omit<Rectification, 'id'>) => {
    const newRectification: Rectification = {
      ...rectification,
      id: `rect-${Date.now()}`,
    };
    setState((prev) => ({
      ...prev,
      rectifications: [...prev.rectifications, newRectification],
    }));
    return newRectification;
  }, []);

  const updateRectification = useCallback((rectificationId: string, updates: Partial<Rectification>) => {
    setState((prev) => ({
      ...prev,
      rectifications: prev.rectifications.map((rect) =>
        rect.id === rectificationId ? { ...rect, ...updates } : rect
      ),
    }));
  }, []);

  const addInspectionRecord = useCallback((record: Omit<InspectionRecord, 'id'>) => {
    const newRecord: InspectionRecord = {
      ...record,
      id: `inspection-${Date.now()}`,
    };
    setState((prev) => ({
      ...prev,
      inspectionRecords: [...prev.inspectionRecords, newRecord],
    }));
    return newRecord;
  }, []);

  const getIssuesByStall = useCallback((stallId: string) => {
    return state.issues.filter((issue) => issue.stallId === stallId);
  }, [state.issues]);

  const getRectificationsByStall = useCallback((stallId: string) => {
    return state.rectifications.filter((rect) => rect.stallId === stallId);
  }, [state.rectifications]);

  const getRectificationByIssue = useCallback((issueId: string) => {
    return state.rectifications.find((rect) => rect.issueId === issueId);
  }, [state.rectifications]);

  const getInspectionRecordsByStall = useCallback((stallId: string) => {
    return state.inspectionRecords.filter((record) => record.stallId === stallId);
  }, [state.inspectionRecords]);

  return {
    state,
    resetToSampleData,
    updateStallStatus,
    addIssue,
    addRectification,
    updateRectification,
    addInspectionRecord,
    getIssuesByStall,
    getRectificationsByStall,
    getRectificationByIssue,
    getInspectionRecordsByStall,
  };
};
