import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { 
  SystemState, 
  BrakeHeatLoadRecord, 
  SamplingIntervalSpec, 
  TemperatureCalibrationRecord,
  CoefficientModification
} from '../types';
import { demoSamplingIntervals, demoCalibrationRecords, demoHeatLoadRecords } from '../data/demoData';

interface SystemContextType {
  state: SystemState;
  importSamplingInterval: (spec: Omit<SamplingIntervalSpec, 'id' | 'importTime'>) => void;
  importCalibrationRecord: (record: Omit<TemperatureCalibrationRecord, 'id'>) => void;
  addHeatLoadRecord: (record: Omit<BrakeHeatLoadRecord, 'id' | 'replayVersion'>) => void;
  updateHeatLoadRecord: (id: string, updates: Partial<BrakeHeatLoadRecord>) => void;
  addModification: (recordId: string, modification: Omit<CoefficientModification, 'modifyTime'>) => void;
  reviewRecord: (recordId: string, reviewer: string, remark: string) => void;
  recalculateWithCalibration: (recordId: string, calibrationId: string) => void;
  getRecordById: (id: string) => BrakeHeatLoadRecord | undefined;
  getCalibrationById: (id: string) => TemperatureCalibrationRecord | undefined;
  getSamplingIntervalById: (id: string) => SamplingIntervalSpec | undefined;
  setActiveTab: (tab: string) => void;
}

const SystemContext = createContext<SystemContextType | undefined>(undefined);

const initialState: SystemState = {
  samplingIntervals: demoSamplingIntervals,
  calibrationRecords: demoCalibrationRecords,
  heatLoadRecords: demoHeatLoadRecords,
  activeTab: 'dashboard'
};

export function SystemProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SystemState>(initialState);

  const importSamplingInterval = useCallback((spec: Omit<SamplingIntervalSpec, 'id' | 'importTime'>) => {
    setState(prev => {
      const newSpec: SamplingIntervalSpec = {
        ...spec,
        id: `SI-${String(prev.samplingIntervals.length + 1).padStart(3, '0')}`,
        importTime: new Date().toLocaleString('zh-CN')
      };
      return {
        ...prev,
        samplingIntervals: [...prev.samplingIntervals, newSpec]
      };
    });
  }, []);

  const importCalibrationRecord = useCallback((record: Omit<TemperatureCalibrationRecord, 'id'>) => {
    setState(prev => {
      const newRecord: TemperatureCalibrationRecord = {
        ...record,
        id: `TC-${String(prev.calibrationRecords.length + 1).padStart(3, '0')}`
      };
      return {
        ...prev,
        calibrationRecords: [...prev.calibrationRecords, newRecord]
      };
    });
  }, []);

  const addHeatLoadRecord = useCallback((record: Omit<BrakeHeatLoadRecord, 'id' | 'replayVersion'>) => {
    setState(prev => {
      const newRecord: BrakeHeatLoadRecord = {
        ...record,
        id: `HL-${new Date().getFullYear()}-${String(prev.heatLoadRecords.length + 1).padStart(3, '0')}`,
        replayVersion: 1
      };
      return {
        ...prev,
        heatLoadRecords: [...prev.heatLoadRecords, newRecord]
      };
    });
  }, []);

  const updateHeatLoadRecord = useCallback((id: string, updates: Partial<BrakeHeatLoadRecord>) => {
    setState(prev => ({
      ...prev,
      heatLoadRecords: prev.heatLoadRecords.map(r => 
        r.id === id ? { ...r, ...updates } : r
      )
    }));
  }, []);

  const addModification = useCallback((recordId: string, modification: Omit<CoefficientModification, 'modifyTime'>) => {
    setState(prev => ({
      ...prev,
      heatLoadRecords: prev.heatLoadRecords.map(r => {
        if (r.id !== recordId) return r;
        const newMod: CoefficientModification = {
          ...modification,
          modifyTime: new Date().toLocaleString('zh-CN')
        };
        const hasUnreasoned = [...r.modifications, newMod].some(m => !m.hasReason);
        return {
          ...r,
          modifications: [...r.modifications, newMod],
          hasUnreasonedModification: hasUnreasoned,
          status: hasUnreasoned ? 'manual_modified_no_reason' : r.status
        };
      })
    }));
  }, []);

  const reviewRecord = useCallback((recordId: string, reviewer: string, remark: string) => {
    setState(prev => ({
      ...prev,
      heatLoadRecords: prev.heatLoadRecords.map(r => {
        if (r.id !== recordId) return r;
        const newStatus = r.hasUnreasonedModification ? 'pending_review' : r.status;
        return {
          ...r,
          reviewStatus: 'reviewed',
          reviewer,
          reviewTime: new Date().toLocaleString('zh-CN'),
          reviewRemark: remark,
          status: newStatus === 'pending_review' ? 'normal' : r.status
        };
      })
    }));
  }, []);

  const recalculateWithCalibration = useCallback((recordId: string, calibrationId: string) => {
    setState(prev => {
      const calibration = prev.calibrationRecords.find(c => c.id === calibrationId);
      if (!calibration) return prev;

      return {
        ...prev,
        heatLoadRecords: prev.heatLoadRecords.map(r => {
          if (r.id !== recordId) return r;

          const rawHeatLoad = (r.brakingForce * 1000 * r.brakingSpeed * r.brakingDuration 
            * r.frictionCoeff * r.heatDissipationCoeff) / r.contactArea / 1000;
          
          const tempFactor = 1 + (calibration.correctionOffset / 100);
          const calibratedHeatLoad = Math.round(rawHeatLoad * tempFactor * 10) / 10;

          const now = new Date().toLocaleString('zh-CN');
          const newLogs = [
            ...r.calculationLog,
            `${now} 应用温度校准记录 ${calibrationId}${calibration.isOldStandard ? '（旧口径）' : ''}`,
            `${now} 温度校准补偿 ${calibration.correctionOffset > 0 ? '+' : ''}${calibration.correctionOffset}℃`,
            `${now} 重算完成，热负荷 ${r.finalHeatLoad} → ${calibratedHeatLoad} kJ/m²`
          ];

          return {
            ...r,
            rawHeatLoad: Math.round(rawHeatLoad * 10) / 10,
            calibratedHeatLoad,
            finalHeatLoad: calibratedHeatLoad,
            temperatureCalibrationId: calibrationId,
            oldStandardCalibrationId: calibration.isOldStandard ? calibrationId : r.oldStandardCalibrationId,
            status: calibration.isOldStandard ? 'recalibrated' : r.status,
            source: 'recalculation',
            calculationLog: newLogs,
            replayVersion: r.replayVersion + 1
          };
        })
      };
    });
  }, []);

  const getRecordById = useCallback((id: string) => {
    return state.heatLoadRecords.find(r => r.id === id);
  }, [state.heatLoadRecords]);

  const getCalibrationById = useCallback((id: string) => {
    return state.calibrationRecords.find(c => c.id === id);
  }, [state.calibrationRecords]);

  const getSamplingIntervalById = useCallback((id: string) => {
    return state.samplingIntervals.find(s => s.id === id);
  }, [state.samplingIntervals]);

  const setActiveTab = useCallback((tab: string) => {
    setState(prev => ({ ...prev, activeTab: tab }));
  }, []);

  return (
    <SystemContext.Provider value={{
      state,
      importSamplingInterval,
      importCalibrationRecord,
      addHeatLoadRecord,
      updateHeatLoadRecord,
      addModification,
      reviewRecord,
      recalculateWithCalibration,
      getRecordById,
      getCalibrationById,
      getSamplingIntervalById,
      setActiveTab
    }}>
      {children}
    </SystemContext.Provider>
  );
}

export function useSystem() {
  const context = useContext(SystemContext);
  if (!context) {
    throw new Error('useSystem must be used within a SystemProvider');
  }
  return context;
}
