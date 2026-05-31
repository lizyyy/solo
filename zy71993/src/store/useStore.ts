import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  DirectorySnapshot,
  ChecksumManifest,
  FailureLog,
  RollbackRecord,
  VerificationResult,
  HistoryRecord,
  DataSourceMeta,
} from '@/types';
import { runVerification } from '@/utils/verifyEngine';

interface BackupVerifyState {
  machineId: string;
  snapshot: DirectorySnapshot | null;
  checksum: ChecksumManifest | null;
  failureLog: FailureLog | null;
  rollback: RollbackRecord | null;
  dataSources: DataSourceMeta[];
  result: VerificationResult | null;
  isVerifying: boolean;
  history: Record<string, HistoryRecord[]>;
  expandedIssueId: string | null;

  setMachineId: (id: string) => void;
  loadSnapshot: (data: DirectorySnapshot) => void;
  loadChecksum: (data: ChecksumManifest) => void;
  loadFailureLog: (data: FailureLog) => void;
  loadRollback: (data: RollbackRecord) => void;
  setDataSource: (type: DataSourceMeta['type'], fileName: string, loaded: boolean, error?: string) => void;
  runVerify: () => void;
  loadMockData: () => void;
  resolveHistoryIssue: (machineId: string, date: string, issueId: string) => void;
  setExpandedIssueId: (id: string | null) => void;
  getHistoryForMachine: (machineId: string) => HistoryRecord[];
}

export const useStore = create<BackupVerifyState>()(
  persist(
    (set, get) => ({
      machineId: '',
      snapshot: null,
      checksum: null,
      failureLog: null,
      rollback: null,
      dataSources: [],
      result: null,
      isVerifying: false,
      history: {},
      expandedIssueId: null,

      setMachineId: (id) => set({ machineId: id }),

      loadSnapshot: (data) => set({ snapshot: data }),

      loadChecksum: (data) => set({ checksum: data }),

      loadFailureLog: (data) => set({ failureLog: data }),

      loadRollback: (data) => set({ rollback: data }),

      setDataSource: (type, fileName, loaded, error) =>
        set((state) => {
          const filtered = state.dataSources.filter((d) => d.type !== type);
          return {
            dataSources: [...filtered, { type, fileName, loaded, error }],
          };
        }),

      runVerify: () => {
        const { machineId, snapshot, checksum, failureLog, rollback, history } = get();
        set({ isVerifying: true });

        setTimeout(() => {
          const result = runVerification(machineId, snapshot, checksum, failureLog, rollback);
          const mid = result.machineId;
          const record: HistoryRecord = {
            machineId: mid,
            verificationDate: result.timestamp,
            issues: result.issues,
            resolvedIssueIds: [],
          };
          const existing = history[mid] || [];
          set({
            result,
            isVerifying: false,
            history: {
              ...history,
              [mid]: [...existing, record],
            },
          });
        }, 600);
      },

      loadMockData: () => {
        import('@/mock/data').then(({ MOCK_SNAPSHOT, MOCK_CHECKSUM, MOCK_FAILURE_LOG, MOCK_ROLLBACK, MOCK_PREVIOUS_HISTORY }) => {
          set({
            machineId: 'srv-prod-01',
            snapshot: MOCK_SNAPSHOT,
            checksum: MOCK_CHECKSUM,
            failureLog: MOCK_FAILURE_LOG,
            rollback: MOCK_ROLLBACK,
            dataSources: [
              { type: 'snapshot', fileName: 'snapshot.json', loaded: true },
              { type: 'checksum', fileName: 'checksum.csv', loaded: true },
              { type: 'failure_log', fileName: 'failure.log', loaded: true },
              { type: 'rollback', fileName: 'rollback.json', loaded: true },
            ],
            history: {
              'srv-prod-01': MOCK_PREVIOUS_HISTORY.records,
            },
          });
        });
      },

      resolveHistoryIssue: (machineId, date, issueId) =>
        set((state) => {
          const records = state.history[machineId] || [];
          return {
            history: {
              ...state.history,
              [machineId]: records.map((r) =>
                r.verificationDate === date
                  ? { ...r, resolvedIssueIds: [...r.resolvedIssueIds, issueId] }
                  : r
              ),
            },
          };
        }),

      setExpandedIssueId: (id) => set({ expandedIssueId: id }),

      getHistoryForMachine: (machineId) => {
        return get().history[machineId] || [];
      },
    }),
    {
      name: 'bv_store',
      partialize: (state) => ({
        history: state.history,
      }),
    }
  )
);
