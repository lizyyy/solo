import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  AppState,
  AppActions,
  TensionRecord,
  Customer,
  Instrument,
  ErrorTag,
  JudgmentDetail,
  DataLayer,
} from '../types';
import {
  generateId,
  getPitchFrequency,
  calculateTension,
  matchStringSpec,
  validatePitchMapping,
  validateStringLength,
  assessRiskLevel,
} from '../utils/tension';

type StoreState = AppState & AppActions;

const initialState: AppState = {
  records: [],
  customers: [],
  instruments: [],
  currentRecordId: null,
  filters: {
    showTagged: false,
  },
};

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      ...initialState,

      setCurrentRecord: (id: string | null) => {
        set({ currentRecordId: id });
      },

      addRecord: (record) => {
        const now = new Date().toISOString();
        const newRecord: TensionRecord = {
          ...record,
          id: generateId(),
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({
          records: [newRecord, ...state.records],
          currentRecordId: newRecord.id,
        }));
      },

      updateRecord: (id, updates) => {
        const now = new Date().toISOString();
        set((state) => ({
          records: state.records.map((r) =>
            r.id === id ? { ...r, ...updates, updatedAt: now } : r
          ),
        }));
      },

      deleteRecord: (id) => {
        set((state) => ({
          records: state.records.filter((r) => r.id !== id),
          currentRecordId: state.currentRecordId === id ? null : state.currentRecordId,
        }));
      },

      addCustomer: (customer) => {
        const newCustomer: Customer = {
          ...customer,
          id: generateId(),
          createdAt: new Date().toISOString(),
        };
        set((state) => ({
          customers: [...state.customers, newCustomer],
        }));
      },

      updateCustomer: (id, updates) => {
        set((state) => ({
          customers: state.customers.map((c) =>
            c.id === id ? { ...c, ...updates } : c
          ),
        }));
      },

      addInstrument: (instrument) => {
        const newInstrument: Instrument = {
          ...instrument,
          id: generateId(),
        };
        set((state) => ({
          instruments: [...state.instruments, newInstrument],
        }));
      },

      updateInstrument: (id, updates) => {
        set((state) => ({
          instruments: state.instruments.map((i) =>
            i.id === id ? { ...i, ...updates } : i
          ),
        }));
      },

      addErrorTag: (recordId, tag) => {
        const newTag: ErrorTag = {
          ...tag,
          id: generateId(),
          createdAt: new Date().toISOString(),
        };
        set((state) => ({
          records: state.records.map((r) =>
            r.id === recordId
              ? { ...r, errorTags: [...r.errorTags, newTag], updatedAt: new Date().toISOString() }
              : r
          ),
        }));
      },

      resolveErrorTag: (recordId, tagId) => {
        set((state) => ({
          records: state.records.map((r) =>
            r.id === recordId
              ? {
                  ...r,
                  errorTags: r.errorTags.map((t) =>
                    t.id === tagId ? { ...t, resolved: true } : t
                  ),
                  updatedAt: new Date().toISOString(),
                }
              : r
          ),
        }));
      },

      addJudgmentDetail: (recordId, detail) => {
        const newDetail: JudgmentDetail = {
          ...detail,
          id: generateId(),
          createdAt: new Date().toISOString(),
        };
        set((state) => ({
          records: state.records.map((r) =>
            r.id === recordId
              ? { ...r, details: [...r.details, newDetail], updatedAt: new Date().toISOString() }
              : r
          ),
        }));
      },

      setFilters: (filters) => {
        set((state) => ({
          filters: { ...state.filters, ...filters },
        }));
      },

      recalculateRecord: (id) => {
        const state = get();
        const record = state.records.find((r) => r.id === id);
        if (!record) return;

        const instrument = state.instruments.find((i) => i.id === record.instrumentId);
        const instrumentType = instrument?.type || 'other';

        const frequency = getPitchFrequency(record.pitch);
        if (!frequency) {
          get().addErrorTag(id, {
            type: 'pitch_mapping',
            description: `无法识别音高 ${record.pitch}`,
            resolved: false,
          });
          return;
        }

        const specMatch = matchStringSpec(record.stringSpec);
        if (!specMatch.matched) {
          get().addErrorTag(id, {
            type: 'spec_mismatch',
            description: specMatch.reason,
            resolved: false,
          });
        }

        const pitchValidation = validatePitchMapping(
          record.pitch,
          record.stringNumber,
          instrumentType
        );
        if (!pitchValidation.valid) {
          get().addErrorTag(id, {
            type: 'pitch_mapping',
            description: pitchValidation.reason,
            resolved: false,
          });
        }

        const lengthValidation = validateStringLength(
          record.stringLength,
          record.lengthUnit,
          instrumentType
        );
        if (!lengthValidation.valid) {
          get().addErrorTag(id, {
            type: 'unit_error',
            description: lengthValidation.reason,
            resolved: false,
          });
        }

        const linearDensity = specMatch.spec?.linearDensity || 0.001;
        const maxTension = specMatch.spec?.maxTension || 200;

        const tensionResult = calculateTension(
          frequency,
          record.stringLength,
          record.lengthUnit,
          linearDensity
        );

        const historicalBreaks = state.records.filter(
          (r) =>
            r.instrumentId === record.instrumentId &&
            r.stringNumber === record.stringNumber &&
            r.final.riskLevel >= 4
        ).length;

        const riskResult = assessRiskLevel(
          tensionResult.tension,
          maxTension,
          historicalBreaks
        );

        if (tensionResult.tension > maxTension) {
          get().addErrorTag(id, {
            type: 'tension_exceeded',
            description: `张力 ${tensionResult.tension.toFixed(2)}N 超过最大安全张力 ${maxTension}N`,
            resolved: false,
          });
        }

        const now = new Date().toISOString();
        const originalData: DataLayer = {
          tension: tensionResult.tension,
          riskLevel: riskResult.level,
          conclusion: riskResult.reason,
          updatedAt: now,
        };

        const currentRecord = get().records.find((r) => r.id === id);
        const correctedData = currentRecord?.corrected;

        const finalData: DataLayer = correctedData
          ? {
              tension: correctedData.tension,
              riskLevel: correctedData.riskLevel,
              conclusion: correctedData.conclusion,
              updatedAt: now,
            }
          : originalData;

        get().addJudgmentDetail(id, {
          category: 'tension_calc',
          reason: tensionResult.formula,
          evidence: tensionResult.details,
          version: (currentRecord?.details.length || 0) + 1,
        });

        get().addJudgmentDetail(id, {
          category: 'spec_match',
          reason: specMatch.reason,
          evidence: `规格: ${record.stringSpec}, 线密度: ${linearDensity.toFixed(6)} kg/m`,
          version: (currentRecord?.details.length || 0) + 2,
        });

        get().addJudgmentDetail(id, {
          category: 'risk_assess',
          reason: riskResult.reason,
          evidence: riskResult.evidence,
          version: (currentRecord?.details.length || 0) + 3,
        });

        get().updateRecord(id, {
          original: originalData,
          final: finalData,
        });
      },
    }),
    {
      name: 'string-tension-store',
      version: 1,
    }
  )
);

export const getCurrentRecord = (): TensionRecord | undefined => {
  const state = useStore.getState();
  return state.records.find((r) => r.id === state.currentRecordId);
};

export const getInstrument = (instrumentId: string): Instrument | undefined => {
  return useStore.getState().instruments.find((i) => i.id === instrumentId);
};

export const getCustomer = (customerId: string): Customer | undefined => {
  return useStore.getState().customers.find((c) => c.id === customerId);
};
