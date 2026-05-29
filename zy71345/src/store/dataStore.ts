import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DataStore, AllData, CheckResult, ImportDataType, DataVersion } from '../types';
import { sampleData } from '../data/sampleData';

const initialData: AllData = {
  parts: [],
  pageRules: [],
  musicians: [],
  revisions: [],
  distributions: [],
  checkReports: [],
  signOffs: [],
};

export const useDataStore = create<DataStore>()(
  persist(
    (set, get) => ({
      currentVersionId: null,
      versions: [],
      currentData: initialData,
      checkResults: [],
      isChecked: false,

      setCurrentVersion: (versionId: string) => {
        const version = get().versions.find(v => v.id === versionId);
        if (version) {
          set({
            currentVersionId: versionId,
            currentData: version.data,
            checkResults: [],
            isChecked: false,
          });
        }
      },

      createVersion: (name: string, description: string, data: Partial<AllData>) => {
        const newVersion: DataVersion = {
          id: `v${Date.now()}`,
          name,
          createdAt: new Date().toISOString(),
          description,
          data: {
            ...get().currentData,
            ...data,
          },
        };
        set(state => ({
          versions: [...state.versions, newVersion],
          currentVersionId: newVersion.id,
          currentData: newVersion.data,
          checkResults: [],
          isChecked: false,
        }));
      },

      updateData: (dataType: ImportDataType, data: any[]) => {
        set(state => ({
          currentData: {
            ...state.currentData,
            [dataType]: data,
          },
          checkResults: [],
          isChecked: false,
        }));
      },

      importSampleData: () => {
        const newVersion: DataVersion = {
          id: `v${Date.now()}`,
          name: '样例数据',
          createdAt: new Date().toISOString(),
          description: '系统预置的样例数据，用于演示功能',
          data: JSON.parse(JSON.stringify(sampleData)),
        };
        set({
          versions: [newVersion],
          currentVersionId: newVersion.id,
          currentData: newVersion.data,
          checkResults: [],
          isChecked: false,
        });
      },

      setCheckResults: (results: CheckResult[]) => {
        set({
          checkResults: results,
          isChecked: true,
        });
      },

      clearData: () => {
        set({
          currentVersionId: null,
          versions: [],
          currentData: initialData,
          checkResults: [],
          isChecked: false,
        });
      },

      exportData: () => {
        return JSON.stringify(get().currentData, null, 2);
      },
    }),
    {
      name: 'score-checker-storage',
    }
  )
);
