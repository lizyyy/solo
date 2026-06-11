import axios from 'axios';

export const api = axios.create({
  baseURL: '/api',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    console.error('[API ERROR]', err?.config?.url, err?.response?.data || err.message);
    return Promise.reject(err);
  },
);

import type {
  AuditLog,
  AuditLogQuery,
  Collision,
  CollisionQuery,
  CreateMaterialPayload,
  ExportRow,
  Material,
  PatchCollisionPayload,
  UserInfo,
  VersionSnapshot,
} from '@shared/types';

export const collisionApi = {
  list: (q?: CollisionQuery) =>
    api.get<Collision[]>('/collisions', { params: q }).then((r) => r.data),
  get: (id: string) => api.get<Collision>(`/collisions/${id}`).then((r) => r.data),
  patch: (id: string, p: PatchCollisionPayload) =>
    api.patch<Collision>(`/collisions/${id}`, p).then((r) => r.data),
  listMaterials: (id: string) =>
    api.get<Material[]>(`/collisions/${id}/materials`).then((r) => r.data),
  addMaterial: (id: string, p: Omit<CreateMaterialPayload, 'collisionId'>) =>
    api.post<Material[]>(`/collisions/${id}/materials`, {
      collisionId: id,
      ...p,
    }).then((r) => r.data),
  listVersions: (id: string) =>
    api.get<VersionSnapshot[]>(`/collisions/${id}/versions`).then((r) => r.data),
  diff: (id: string, v1: number, v2: number) =>
    api.get(`/collisions/${id}/versions/${v1}/diff/${v2}`).then((r) => r.data),
};

export const auditApi = {
  list: (q?: AuditLogQuery) => api.get<AuditLog[]>('/audit-logs', { params: q }).then((r) => r.data),
};

export const exportApi = {
  preview: () => api.get<ExportRow[]>('/export/preview').then((r) => r.data),
  csvUrl: '/api/export/csv',
};

export const userApi = {
  me: () => api.get<UserInfo>('/users/me').then((r) => r.data),
};
