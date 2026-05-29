import { create } from 'zustand';
import dayjs from 'dayjs';
import type { Waiver, WaiverHistory, WaiverStatusHistory } from '../types';
import { generateId, getCurrentUser } from '../types';
import { db } from '../db';

interface CreateWaiverParams {
  reason: string;
  approver?: string;
  expireDate?: string;
  notes?: string;
}

interface WaiverState {
  waivers: Waiver[];
  loading: boolean;
  error: string | null;
  loadWaivers: (projectId: string) => Promise<void>;
  createWaiver: (
    projectId: string,
    dependencyId: string,
    params: CreateWaiverParams
  ) => Promise<Waiver>;
  approveWaiver: (waiverId: string, notes?: string) => Promise<void>;
  rejectWaiver: (waiverId: string, reason?: string) => Promise<void>;
  extendWaiver: (
    waiverId: string,
    newExpiryDate: number,
    reason: string
  ) => Promise<void>;
  renewWaiver: (waiverId: string, newExpireDate: string) => Promise<void>;
  checkExpiry: (projectId: string) => Promise<Waiver[]>;
  deleteWaiver: (waiverId: string) => Promise<void>;
}

export const useWaiverStore = create<WaiverState>((set, get) => ({
  waivers: [],
  loading: false,
  error: null,

  loadWaivers: async (projectId: string) => {
    set({ loading: true, error: null });
    try {
      const waivers = await db.waivers
        .where('projectId')
        .equals(projectId)
        .reverse()
        .sortBy('createdAt');

      const now = Date.now();
      for (const waiver of waivers) {
        if (
          waiver.status === 'approved' &&
          (waiver.expiryDate || waiver.expireDate || 0) < now
        ) {
          await db.waivers.update(waiver.id, { status: 'expired' });
          waiver.status = 'expired';
        }
      }

      set({ waivers, loading: false });
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },

  createWaiver: async (
    projectId: string,
    dependencyId: string,
    params: CreateWaiverParams
  ) => {
    const now = Date.now();
    const expiryDate = params.expireDate
      ? dayjs(params.expireDate).valueOf()
      : dayjs().add(90, 'day').valueOf();

    const statusHistory: WaiverStatusHistory[] = [
      {
        status: 'pending',
        timestamp: now,
        operator: getCurrentUser(),
        notes: params.notes,
      },
    ];

    const waiver: Waiver = {
      id: generateId(),
      dependencyId,
      projectId,
      applicant: getCurrentUser(),
      approver: params.approver || null,
      reason: params.reason,
      justification: params.notes || params.reason,
      effectiveDate: now,
      expiryDate,
      expireDate: expiryDate,
      status: 'pending',
      approvalNotes: null,
      approvalDate: null,
      createdAt: now,
      updatedAt: now,
      notes: params.notes,
      statusHistory,
      history: [],
    };

    await db.waivers.add(waiver);
    await db.dependencies.update(dependencyId, {
      waiverId: waiver.id,
      status: 'waiver_pending',
      updatedAt: now,
    });

    set((state) => ({
      waivers: [waiver, ...state.waivers],
    }));

    return waiver;
  },

  approveWaiver: async (waiverId: string, notes?: string) => {
    const waiver = await db.waivers.get(waiverId);
    if (!waiver) return;

    const now = Date.now();
    const newHistory: WaiverStatusHistory = {
      status: 'approved',
      timestamp: now,
      operator: getCurrentUser(),
      notes,
    };

    const statusHistory = [...(waiver.statusHistory || []), newHistory];

    const updates: Partial<Waiver> = {
      status: 'approved',
      approver: getCurrentUser(),
      approvalNotes: notes || null,
      approvalDate: now,
      approvedAt: now,
      updatedAt: now,
      statusHistory,
    };

    await db.waivers.update(waiverId, updates);
    await db.dependencies.update(waiver.dependencyId, {
      status: 'waiver_approved',
      updatedAt: now,
    });

    set((state) => ({
      waivers: state.waivers.map((w) =>
        w.id === waiverId ? { ...w, ...updates } : w
      ),
    }));
  },

  rejectWaiver: async (waiverId: string, reason?: string) => {
    const waiver = await db.waivers.get(waiverId);
    if (!waiver) return;

    const now = Date.now();
    const newHistory: WaiverStatusHistory = {
      status: 'rejected',
      timestamp: now,
      operator: getCurrentUser(),
      notes: reason,
    };

    const statusHistory = [...(waiver.statusHistory || []), newHistory];

    const updates: Partial<Waiver> = {
      status: 'rejected',
      rejectionReason: reason,
      approvalNotes: reason || null,
      updatedAt: now,
      statusHistory,
    };

    await db.waivers.update(waiverId, updates);
    await db.dependencies.update(waiver.dependencyId, {
      status: 'blocked',
      updatedAt: now,
      blockReason: `豁免申请被驳回: ${reason || '未说明原因'}`,
    });

    set((state) => ({
      waivers: state.waivers.map((w) =>
        w.id === waiverId ? { ...w, ...updates } : w
      ),
    }));
  },

  extendWaiver: async (
    waiverId: string,
    newExpiryDate: number,
    reason: string
  ) => {
    const waiver = await db.waivers.get(waiverId);
    if (!waiver) return;

    const now = Date.now();
    const historyEntry: WaiverHistory = {
      id: generateId(),
      waiverId,
      previousExpiryDate: waiver.expiryDate || waiver.expireDate || 0,
      newExpiryDate,
      extendedBy: getCurrentUser(),
      extendedAt: now,
      reason,
    };

    const newStatusHistory: WaiverStatusHistory = {
      status: 'approved',
      timestamp: now,
      operator: getCurrentUser(),
      notes: `续期至 ${dayjs(newExpiryDate).format('YYYY-MM-DD')}`,
    };

    const statusHistory = [...(waiver.statusHistory || []), newStatusHistory];

    const updates: Partial<Waiver> = {
      expiryDate: newExpiryDate,
      expireDate: newExpiryDate,
      status: 'approved',
      updatedAt: now,
      history: [...(waiver.history || []), historyEntry],
      statusHistory,
    };

    await db.waivers.update(waiverId, updates);
    await db.dependencies.update(waiver.dependencyId, {
      status: 'waiver_approved',
      updatedAt: now,
    });

    set((state) => ({
      waivers: state.waivers.map((w) =>
        w.id === waiverId ? { ...w, ...updates } : w
      ),
    }));
  },

  renewWaiver: async (waiverId: string, newExpireDate: string) => {
    const newExpiryDate = dayjs(newExpireDate).valueOf();
    await get().extendWaiver(waiverId, newExpiryDate, '续期90天');
  },

  checkExpiry: async (projectId: string) => {
    const waivers = await db.waivers
      .where('projectId')
      .equals(projectId)
      .toArray();

    const now = Date.now();
    const thirtyDaysLater = dayjs().add(30, 'day').valueOf();

    const expiring = waivers.filter(
      (w) =>
        w.status === 'approved' &&
        (w.expiryDate || w.expireDate || 0) < thirtyDaysLater &&
        (w.expiryDate || w.expireDate || 0) >= now
    );

    const expired = waivers.filter(
      (w) => w.status === 'approved' && (w.expiryDate || w.expireDate || 0) < now
    );

    for (const waiver of expired) {
      await db.waivers.update(waiver.id, { status: 'expired' });
      await db.dependencies.update(waiver.dependencyId, {
        status: 'blocked',
        updatedAt: Date.now(),
        blockReason: `豁免已于 ${dayjs(waiver.expiryDate || waiver.expireDate || 0).format('YYYY-MM-DD')} 过期`,
      });
    }

    if (expired.length > 0) {
      await get().loadWaivers(projectId);
    }

    return [...expiring, ...expired];
  },

  deleteWaiver: async (waiverId: string) => {
    const waiver = await db.waivers.get(waiverId);
    if (!waiver) return;

    await db.waivers.delete(waiverId);
    await db.dependencies.update(waiver.dependencyId, {
      waiverId: undefined,
      status: 'pending_review',
      updatedAt: Date.now(),
    });

    set((state) => ({
      waivers: state.waivers.filter((w) => w.id !== waiverId),
    }));
  },
}));
