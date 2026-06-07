import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import { InspectionRecord, NightSamplingPoint, ResidentComplaint, SelfCheckResult, ConflictEvidence, InspectionStatus } from '@/types';
import { generateId, generateChecksum } from '@/utils/helpers';
import dayjs from 'dayjs';

interface InspectionState {
  records: InspectionRecord[];
  samplingPoints: NightSamplingPoint[];
  complaints: ResidentComplaint[];
  selfCheckResults: SelfCheckResult[];
  currentOperator: string;
}

type InspectionAction =
  | { type: 'IMPORT_SAMPLING_POINTS'; payload: NightSamplingPoint[] }
  | { type: 'ADD_COMPLAINTS'; payload: ResidentComplaint[] }
  | { type: 'UPDATE_RECORD'; payload: InspectionRecord }
  | { type: 'SUPPLEMENT_RAMP'; payload: { pointCode: string; score: number } }
  | { type: 'RESOLVE_CONFLICT'; payload: { recordId: string; conflictId: string; resolution: 'confirmed' | 'rejected' } }
  | { type: 'UPDATE_SUGGESTION'; payload: { recordId: string; suggestion: string } }
  | { type: 'RUN_SELF_CHECK'; payload: SelfCheckResult[] }
  | { type: 'SET_RECORDS'; payload: InspectionRecord[] };

const initialState: InspectionState = {
  records: [],
  samplingPoints: [],
  complaints: [],
  selfCheckResults: [],
  currentOperator: '市政巡检员小付'
};

function inspectionReducer(state: InspectionState, action: InspectionAction): InspectionState {
  switch (action.type) {
    case 'IMPORT_SAMPLING_POINTS': {
      const newPoints = action.payload;
      const existingCodes = new Set(state.samplingPoints.map(p => p.pointCode));
      const duplicateCodes = new Set<string>();
      const pointsToAdd: NightSamplingPoint[] = [];
      const newRecords: InspectionRecord[] = [];

      newPoints.forEach(point => {
        if (existingCodes.has(point.pointCode)) {
          duplicateCodes.add(point.pointCode);
          pointsToAdd.push({ ...point, isDuplicate: true });
        } else {
          pointsToAdd.push(point);
          existingCodes.add(point.pointCode);
          
          const newRecord: InspectionRecord = {
            id: generateId(),
            pointCode: point.pointCode,
            location: point.location,
            nightSampling: point,
            complaints: [],
            score: point.score,
            originalScore: point.score,
            rampScoreUnchanged: false,
            status: 'pending',
            conflictEvidence: [],
            rectificationSuggestion: '',
            updateTime: dayjs().toISOString(),
            createTime: dayjs().toISOString()
          };
          newRecords.push(newRecord);
        }
      });

      return {
        ...state,
        samplingPoints: [...state.samplingPoints, ...pointsToAdd],
        records: [...state.records, ...newRecords]
      };
    }

    case 'ADD_COMPLAINTS': {
      const newComplaints = action.payload;
      const updatedRecords = state.records.map(record => {
        const relatedComplaints = newComplaints.filter(c => c.pointCode === record.pointCode);
        if (relatedComplaints.length === 0) return record;

        const conflicts: ConflictEvidence[] = [];
        
        relatedComplaints.forEach(complaint => {
          if (record.nightSampling) {
            const samplingLocation = record.nightSampling.location.trim();
            const complaintLocation = complaint.location.trim();
            if (samplingLocation !== complaintLocation || 
                (record.nightSampling.illumination > 50 && complaint.description.includes('严重不足'))) {
              conflicts.push({
                id: generateId(),
                type: 'sampling_vs_complaint',
                description: `采样数据与居民投诉存在矛盾`,
                samplingData: {
                  pointCode: record.nightSampling.pointCode,
                  location: record.nightSampling.location,
                  illumination: record.nightSampling.illumination
                },
                complaintData: {
                  complaintCode: complaint.complaintCode,
                  location: complaint.location,
                  description: complaint.description
                },
                resolved: false
              });
            }
          }
        });

        return {
          ...record,
          complaints: [...record.complaints, ...relatedComplaints],
          conflictEvidence: [...record.conflictEvidence, ...conflicts],
          status: (conflicts.length > 0 ? 'processing' : record.status) as InspectionStatus,
          updateTime: dayjs().toISOString()
        };
      });

      return {
        ...state,
        complaints: [...state.complaints, ...newComplaints],
        records: updatedRecords
      };
    }

    case 'SUPPLEMENT_RAMP': {
      const { pointCode, score } = action.payload;
      const updatedRecords = state.records.map(record => {
        if (record.pointCode !== pointCode) return record;
        
        const scoreUnchanged = score === record.score;
        
        const conflicts: ConflictEvidence[] = [];
        if (scoreUnchanged) {
          conflicts.push({
            id: generateId(),
            type: 'ramp_score_unchanged',
            description: '坡道补录后评分未发生变化，需交通协管复核',
            samplingData: {
              score: record.score,
              hasRamp: true
            },
            resolved: false
          });
        }

        return {
          ...record,
          score,
          rampScoreUnchanged: scoreUnchanged,
          rampSupplementTime: dayjs().toISOString(),
          status: (scoreUnchanged ? 'need_review' : 'processing') as InspectionStatus,
          conflictEvidence: [...record.conflictEvidence, ...conflicts],
          updateTime: dayjs().toISOString()
        };
      });

      return {
        ...state,
        records: updatedRecords
      };
    }

    case 'RESOLVE_CONFLICT': {
      const { recordId, conflictId, resolution } = action.payload;
      const updatedRecords = state.records.map(record => {
        if (record.id !== recordId) return record;
        
        const updatedConflicts = record.conflictEvidence.map(conflict => {
          if (conflict.id !== conflictId) return conflict;
          return {
            ...conflict,
            resolved: true,
            resolution,
            resolvedBy: state.currentOperator,
            resolvedTime: dayjs().toISOString()
          };
        });

        const allResolved = updatedConflicts.every(c => c.resolved);
        
        return {
          ...record,
          conflictEvidence: updatedConflicts,
          status: allResolved ? 'processing' : record.status,
          updateTime: dayjs().toISOString()
        };
      });

      return {
        ...state,
        records: updatedRecords
      };
    }

    case 'UPDATE_SUGGESTION': {
      const { recordId, suggestion } = action.payload;
      const updatedRecords = state.records.map(record => {
        if (record.id !== recordId) return record;
        return {
          ...record,
          rectificationSuggestion: suggestion,
          status: 'confirmed' as InspectionStatus,
          updateTime: dayjs().toISOString()
        };
      });

      return {
        ...state,
        records: updatedRecords
      };
    }

    case 'RUN_SELF_CHECK': {
      return {
        ...state,
        selfCheckResults: action.payload
      };
    }

    case 'SET_RECORDS': {
      return {
        ...state,
        records: action.payload
      };
    }

    default:
      return state;
  }
}

const InspectionContext = createContext<{
  state: InspectionState;
  dispatch: React.Dispatch<InspectionAction>;
} | null>(null);

export function InspectionProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(inspectionReducer, initialState);

  return (
    <InspectionContext.Provider value={{ state, dispatch }}>
      {children}
    </InspectionContext.Provider>
  );
}

export function useInspection() {
  const context = useContext(InspectionContext);
  if (!context) {
    throw new Error('useInspection must be used within InspectionProvider');
  }
  return context;
}

export function useUnifiedDataSource() {
  const { state } = useInspection();
  
  const getRecordsForDisplay = () => state.records;
  const getRecordsForExport = () => {
    const data = {
      records: state.records,
      exportTime: dayjs().toISOString(),
      operator: state.currentOperator,
      checksum: generateChecksum(JSON.stringify(state.records))
    };
    return data;
  };
  const getRecordsForApi = () => state.records;
  
  return {
    getRecordsForDisplay,
    getRecordsForExport,
    getRecordsForApi
  };
}
