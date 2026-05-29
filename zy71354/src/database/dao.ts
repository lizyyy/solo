import db from './db';
import { v4 as uuidv4 } from 'uuid';
import type {
  Installation,
  InstallationBase,
  InstallationStatus,
  Material,
  MaterialType,
  Signature,
  RiskCheck,
  VersionHistory,
} from '../types';

export const installationDao = {
  create: async (data: InstallationBase): Promise<Installation> => {
    await db.read();
    const id = uuidv4();
    const now = new Date().toISOString();
    const installation: Installation = {
      id,
      ...data,
      status: 'draft',
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    db.data!.installations.push(installation);
    await db.write();
    return installation;
  },

  getById: async (id: string): Promise<Installation | null> => {
    await db.read();
    return db.data!.installations.find((i) => i.id === id) || null;
  },

  getAll: async (): Promise<Installation[]> => {
    await db.read();
    return [...db.data!.installations].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  },

  update: async (
    id: string,
    data: Partial<InstallationBase & { status: InstallationStatus }>
  ): Promise<Installation | null> => {
    await db.read();
    const index = db.data!.installations.findIndex((i) => i.id === id);
    if (index === -1) return null;

    const existing = db.data!.installations[index];
    const newVersion = existing.version + 1;
    const now = new Date().toISOString();

    const updated: Installation = {
      ...existing,
      ...data,
      version: newVersion,
      updatedAt: now,
    };

    db.data!.installations[index] = updated;
    await db.write();
    return updated;
  },

  delete: async (id: string): Promise<boolean> => {
    await db.read();
    const initialLength = db.data!.installations.length;
    db.data!.installations = db.data!.installations.filter((i) => i.id !== id);
    db.data!.materials = db.data!.materials.filter((m) => m.installationId !== id);
    db.data!.signatures = db.data!.signatures.filter((s) => s.installationId !== id);
    db.data!.riskChecks = db.data!.riskChecks.filter((r) => r.installationId !== id);
    db.data!.versionHistory = db.data!.versionHistory.filter((v) => v.installationId !== id);
    await db.write();
    return db.data!.installations.length < initialLength;
  },
};

export const materialDao = {
  create: async (
    data: Omit<Material, 'id' | 'uploadedAt' | 'version'>
  ): Promise<Material> => {
    await db.read();
    const id = uuidv4();
    const now = new Date().toISOString();
    const material: Material = {
      id,
      ...data,
      uploadedAt: now,
      version: 1,
    };
    db.data!.materials.push(material);
    await db.write();
    return material;
  },

  getById: async (id: string): Promise<Material | null> => {
    await db.read();
    return db.data!.materials.find((m) => m.id === id) || null;
  },

  getByInstallationId: async (installationId: string): Promise<Material[]> => {
    await db.read();
    return db.data!.materials
      .filter((m) => m.installationId === installationId)
      .sort(
        (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
      );
  },

  getByType: async (installationId: string, type: MaterialType): Promise<Material | null> => {
    await db.read();
    const materials = db.data!.materials
      .filter((m) => m.installationId === installationId && m.type === type)
      .sort((a, b) => b.version - a.version);
    return materials[0] || null;
  },
};

export const signatureDao = {
  create: async (
    data: Omit<Signature, 'id' | 'signedAt' | 'version'>
  ): Promise<Signature> => {
    await db.read();
    const id = uuidv4();
    const now = new Date().toISOString();
    const signature: Signature = {
      id,
      ...data,
      signedAt: now,
      version: 1,
    };
    db.data!.signatures.push(signature);
    await db.write();
    return signature;
  },

  getById: async (id: string): Promise<Signature | null> => {
    await db.read();
    return db.data!.signatures.find((s) => s.id === id) || null;
  },

  getByInstallationId: async (installationId: string): Promise<Signature[]> => {
    await db.read();
    return db.data!.signatures
      .filter((s) => s.installationId === installationId)
      .sort(
        (a, b) => new Date(b.signedAt).getTime() - new Date(a.signedAt).getTime()
      );
  },
};

export const riskCheckDao = {
  create: async (data: Omit<RiskCheck, 'id' | 'checkedAt'>): Promise<RiskCheck> => {
    await db.read();
    const id = uuidv4();
    const now = new Date().toISOString();
    const check: RiskCheck = {
      id,
      ...data,
      checkedAt: now,
    };
    db.data!.riskChecks.push(check);
    await db.write();
    return check;
  },

  getById: async (id: string): Promise<RiskCheck | null> => {
    await db.read();
    return db.data!.riskChecks.find((r) => r.id === id) || null;
  },

  getByInstallationId: async (installationId: string): Promise<RiskCheck[]> => {
    await db.read();
    return db.data!.riskChecks
      .filter((r) => r.installationId === installationId)
      .sort(
        (a, b) => new Date(b.checkedAt).getTime() - new Date(a.checkedAt).getTime()
      );
  },

  deleteByInstallationId: async (installationId: string): Promise<void> => {
    await db.read();
    db.data!.riskChecks = db.data!.riskChecks.filter(
      (r) => r.installationId !== installationId
    );
    await db.write();
  },
};

export const versionHistoryDao = {
  create: async (
    data: Omit<VersionHistory, 'id' | 'changedAt'>
  ): Promise<VersionHistory> => {
    await db.read();
    const id = uuidv4();
    const now = new Date().toISOString();
    const history: VersionHistory = {
      id,
      ...data,
      changedAt: now,
    };
    db.data!.versionHistory.push(history);
    await db.write();
    return history;
  },

  getById: async (id: string): Promise<VersionHistory | null> => {
    await db.read();
    return db.data!.versionHistory.find((v) => v.id === id) || null;
  },

  getByInstallationId: async (installationId: string): Promise<VersionHistory[]> => {
    await db.read();
    return db.data!.versionHistory
      .filter((v) => v.installationId === installationId)
      .sort((a, b) => b.version - a.version);
  },
};
