import { create } from 'zustand';
import { User, UserRole, BillRecord, ParamVersion, ConflictRecord, GapRecord, OperationHistory } from '../../shared/types';

interface AppState {
  currentUser: User | null;
  login: (username: string, password: string) => Promise<boolean>;
  quickLogin: (role: UserRole) => Promise<boolean>;
  logout: () => void;
  switchRole: (role: UserRole) => void;
  records: BillRecord[];
  setRecords: (records: BillRecord[]) => void;
  versions: ParamVersion[];
  setVersions: (versions: ParamVersion[]) => void;
  conflicts: ConflictRecord[];
  setConflicts: (conflicts: ConflictRecord[]) => void;
  gaps: GapRecord[];
  setGaps: (gaps: GapRecord[]) => void;
  histories: OperationHistory[];
  setHistories: (histories: OperationHistory[]) => void;
  selectedRecord: BillRecord | null;
  setSelectedRecord: (record: BillRecord | null) => void;
  drawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
  compareVersions: [string | null, string | null];
  setCompareVersion: (index: 0 | 1, versionId: string | null) => void;
}

const mockUsers: User[] = [
  { id: '1', username: 'admin', name: '系统管理员', role: 'admin' },
  { id: '2', username: 'coach', name: '张教练', role: 'coach' },
  { id: '3', username: 'reviewer', name: '李审核员', role: 'reviewer' },
];

export const useAppStore = create<AppState>((set) => ({
  currentUser: null,
  login: async (username, password) => {
    const user = mockUsers.find(u => u.username === username);
    if (user && password) {
      set({ currentUser: user });
      return true;
    }
    return false;
  },
  quickLogin: async (role) => {
    const user = mockUsers.find(u => u.role === role);
    if (user) {
      set({ currentUser: user });
      return true;
    }
    return false;
  },
  logout: () => {
    set({ currentUser: null });
  },
  switchRole: (role) => {
    const user = mockUsers.find(u => u.role === role);
    if (user) {
      set({ currentUser: user });
    }
  },
  records: [],
  setRecords: (records) => set({ records }),
  versions: [],
  setVersions: (versions) => set({ versions }),
  conflicts: [],
  setConflicts: (conflicts) => set({ conflicts }),
  gaps: [],
  setGaps: (gaps) => set({ gaps }),
  histories: [],
  setHistories: (histories) => set({ histories }),
  selectedRecord: null,
  setSelectedRecord: (record) => set({ selectedRecord: record }),
  drawerOpen: false,
  setDrawerOpen: (open) => set({ drawerOpen: open }),
  compareVersions: [null, null],
  setCompareVersion: (index, versionId) =>
    set((state) => {
      const newCompare = [...state.compareVersions] as [string | null, string | null];
      newCompare[index] = versionId;
      return { compareVersions: newCompare };
    }),
}));
