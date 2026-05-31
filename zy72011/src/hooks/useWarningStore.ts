import { useState, useEffect, useCallback } from 'react';
import { WarningRecord, WarningStatus, HistoryRecord } from '../types';
import { mockData } from '../data/mockData';
import { generateUniqueId } from '../utils/duplicateChecker';

const STORAGE_KEY = 'supplier_bill_warning_data';

export function useWarningStore() {
  const [records, setRecords] = useState<WarningRecord[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setRecords(JSON.parse(stored));
      } catch {
        setRecords(mockData);
      }
    } else {
      setRecords(mockData);
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    }
  }, [records, isLoaded]);

  const getRecordById = useCallback(
    (id: string) => records.find((r) => r.id === id),
    [records]
  );

  const addHistory = (
    _record: WarningRecord,
    action: HistoryRecord['action'],
    operator: string,
    note?: string,
    oldValue?: any,
    newValue?: any
  ): HistoryRecord => ({
    id: generateUniqueId(),
    action,
    operator,
    time: new Date().toLocaleString('zh-CN'),
    oldValue,
    newValue,
    note,
  });

  const updateRecordStatus = useCallback(
    (id: string, newStatus: WarningStatus, note?: string) => {
      setRecords((prev) =>
        prev.map((record) => {
          if (record.id !== id) return record;
          const historyRecord = addHistory(
            record,
            'judge',
            '林姐',
            note,
            record.status,
            newStatus
          );
          return {
            ...record,
            status: newStatus,
            history: [...record.history, historyRecord],
            updatedAt: new Date().toLocaleString('zh-CN'),
          };
        })
      );
    },
    []
  );

  const updateRecordRemark = useCallback((id: string, remark: string) => {
    setRecords((prev) =>
      prev.map((record) => {
        if (record.id !== id) return record;
        const historyRecord = addHistory(
          record,
          'remark',
          '林姐',
          '补充备注',
          record.currentRemark,
          remark
        );
        return {
          ...record,
          currentRemark: remark,
          history: [...record.history, historyRecord],
          updatedAt: new Date().toLocaleString('zh-CN'),
        };
      })
    );
  }, []);

  const rollbackToHistory = useCallback((id: string, historyIndex: number) => {
    setRecords((prev) =>
      prev.map((record) => {
        if (record.id !== id) return record;
        
        const targetHistory = record.history[historyIndex];
        if (!targetHistory) return record;

        const rollbackRecord = addHistory(
          record,
          'rollback',
          '林姐',
          `回退到: ${targetHistory.time}`
        );

        let rolledBackRecord = { ...record };
        if (targetHistory.action === 'judge' && targetHistory.oldValue) {
          rolledBackRecord.status = targetHistory.oldValue;
        }

        return {
          ...rolledBackRecord,
          history: [...record.history, rollbackRecord],
          updatedAt: new Date().toLocaleString('zh-CN'),
        };
      })
    );
  }, []);

  const addRecords = useCallback((newRecords: WarningRecord[]) => {
    setRecords((prev) => [...prev, ...newRecords]);
  }, []);

  const updateRecords = useCallback((updatedRecords: WarningRecord[]) => {
    setRecords((prev) => {
      const updatedMap = new Map(updatedRecords.map((r) => [r.id, r]));
      return prev.map((r) => updatedMap.get(r.id) || r);
    });
  }, []);

  const resetToMockData = useCallback(() => {
    setRecords(mockData);
  }, []);

  const filterRecords = useCallback(
    (filters: { status?: WarningStatus; search?: string }) => {
      return records.filter((record) => {
        if (filters.status && record.status !== filters.status) return false;
        if (filters.search) {
          const searchLower = filters.search.toLowerCase();
          return (
            record.supplierName.toLowerCase().includes(searchLower) ||
            record.currentRemark.toLowerCase().includes(searchLower)
          );
        }
        return true;
      });
    },
    [records]
  );

  return {
    records,
    isLoaded,
    getRecordById,
    updateRecordStatus,
    updateRecordRemark,
    rollbackToHistory,
    addRecords,
    updateRecords,
    resetToMockData,
    filterRecords,
  };
}
