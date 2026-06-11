import { create } from 'zustand';
import type {
  AuditLog,
  Collision,
  CollisionQuery,
  ExportRow,
  Material,
  UserInfo,
  VersionSnapshot,
} from '@shared/types';
import { auditApi, collisionApi, exportApi, userApi } from '@/api/client';

interface AppState {
  user: UserInfo | null;
  collisions: Collision[];
  materialsByCollision: Record<string, Material[]>;
  versionsByCollision: Record<string, VersionSnapshot[]>;
  audits: AuditLog[];
  exportRows: ExportRow[];
  loading: Partial<Record<string, boolean>>;
  setLoading: (k: string, v: boolean) => void;
  fetchUser: () => Promise<void>;
  fetchCollisions: (q?: CollisionQuery) => Promise<void>;
  fetchOne: (id: string) => Promise<Collision | undefined>;
  fetchMaterials: (id: string) => Promise<void>;
  fetchVersions: (id: string) => Promise<void>;
  fetchAudits: (q?: any) => Promise<void>;
  fetchExport: () => Promise<void>;
  patchCollision: (
    id: string,
    p: any,
  ) => Promise<Collision | undefined>;
  addMaterial: (id: string, p: any) => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  user: null,
  collisions: [],
  materialsByCollision: {},
  versionsByCollision: {},
  audits: [],
  exportRows: [],
  loading: {},
  setLoading: (k, v) => set((s) => ({ loading: { ...s.loading, [k]: v } })),

  fetchUser: async () => {
    const u = await userApi.me();
    set({ user: u });
  },

  fetchCollisions: async (q) => {
    set({ collisions: [] });
    get().setLoading('collisions', true);
    try {
      const list = await collisionApi.list(q);
      set({ collisions: list });
    } finally {
      get().setLoading('collisions', false);
    }
  },

  fetchOne: async (id) => {
    get().setLoading(`c_${id}`, true);
    try {
      const c = await collisionApi.get(id);
      set((s) => {
        const arr = [...s.collisions];
        const i = arr.findIndex((x) => x.id === id);
        if (i >= 0) arr[i] = c;
        else arr.unshift(c);
        return { collisions: arr };
      });
      return c;
    } finally {
      get().setLoading(`c_${id}`, false);
    }
  },

  fetchMaterials: async (id) => {
    const list = await collisionApi.listMaterials(id);
    set((s) => ({ materialsByCollision: { ...s.materialsByCollision, [id]: list } }));
  },

  fetchVersions: async (id) => {
    const list = await collisionApi.listVersions(id);
    set((s) => ({ versionsByCollision: { ...s.versionsByCollision, [id]: list } }));
  },

  fetchAudits: async (q) => {
    get().setLoading('audits', true);
    try {
      const list = await auditApi.list(q);
      set({ audits: list });
    } finally {
      get().setLoading('audits', false);
    }
  },

  fetchExport: async () => {
    get().setLoading('export', true);
    try {
      const list = await exportApi.preview();
      set({ exportRows: list });
    } finally {
      get().setLoading('export', false);
    }
  },

  patchCollision: async (id, p) => {
    const r = await collisionApi.patch(id, p);
    set((s) => {
      const arr = [...s.collisions];
      const i = arr.findIndex((x) => x.id === id);
      if (i >= 0) arr[i] = r;
      const vKey = id;
      const oldV = s.versionsByCollision[vKey] || [];
      // 刷新版本历史
      collisionApi.listVersions(id).then((list) => {
        set((s2) => ({ versionsByCollision: { ...s2.versionsByCollision, [vKey]: list } }));
      });
      return { collisions: arr };
    });
    return r;
  },

  addMaterial: async (id, p) => {
    const list = await collisionApi.addMaterial(id, p);
    set((s) => ({ materialsByCollision: { ...s.materialsByCollision, [id]: list } }));
    // 刷新碰撞点（版本号/最后修改时间会变）
    await get().fetchOne(id);
    await get().fetchVersions(id);
  },
}));
