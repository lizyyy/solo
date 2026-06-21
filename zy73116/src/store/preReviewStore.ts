import { create } from "zustand";
import type { BoundarySample, Collision, CollisionStatus, PreReviewFilters, ReviewStats, SupplementNote, VisaLine } from "@/types";
import { mockBoundarySamples, mockCollisions, mockSupplements, mockVisaLines } from "@/data/mockData";

interface PreReviewState {
  filters: PreReviewFilters;
  collisions: Collision[];
  visaLines: VisaLine[];
  boundarySamples: BoundarySample[];
  supplements: SupplementNote[];
  expandedCollisionId: string | null;
  setFilters: (f: Partial<PreReviewFilters>) => void;
  resetFilters: () => void;
  setExpanded: (id: string | null) => void;
  markCollision: (id: string, status: CollisionStatus) => void;
  filteredCollisions: () => Collision[];
  stats: () => ReviewStats;
  getVisaLine: (id: string) => VisaLine | undefined;
  getCollisionsByStatus: (status: CollisionStatus) => Collision[];
  getVisaLinesByNo: (visaNo: string) => VisaLine[];
  getVisaNos: () => string[];
  getBoundaryByCollision: (collisionId: string) => BoundarySample | undefined;
  getSupplementsByCollision: (collisionId: string) => SupplementNote[];
  getCollisionById: (id: string) => Collision | undefined;
}

const defaultFilters: PreReviewFilters = {
  building: "",
  floor: "",
  dateFrom: "2026-06-01",
  dateTo: "2026-06-30",
  status: "all",
};

export const usePreReviewStore = create<PreReviewState>((set, get) => ({
  filters: defaultFilters,
  collisions: mockCollisions,
  visaLines: mockVisaLines,
  boundarySamples: mockBoundarySamples,
  supplements: mockSupplements,
  expandedCollisionId: null,

  setFilters: (f) => set((s) => ({ filters: { ...s.filters, ...f } })),
  resetFilters: () => set({ filters: defaultFilters }),
  setExpanded: (id) => set({ expandedCollisionId: id }),

  markCollision: (id, status) =>
    set((s) => ({
      collisions: s.collisions.map((c) => (c.id === id ? { ...c, status } : c)),
    })),

  filteredCollisions: () => {
    const { filters, collisions } = get();
    return collisions.filter((c) => {
      if (filters.building && c.building !== filters.building) return false;
      if (filters.floor && String(c.floor) !== filters.floor) return false;
      if (filters.dateFrom && c.reviewDate < filters.dateFrom) return false;
      if (filters.dateTo && c.reviewDate > filters.dateTo) return false;
      if (filters.status !== "all" && c.status !== filters.status) return false;
      return true;
    });
  },

  stats: () => {
    const list = get().filteredCollisions();
    return {
      total: list.length,
      confirmed: list.filter((c) => c.status === "confirmed").length,
      pending: list.filter((c) => c.status === "pending").length,
      rejected: list.filter((c) => c.status === "rejected").length,
      duplicates: list.filter((c) => c.isDuplicate).length,
    };
  },

  getVisaLine: (id) => get().visaLines.find((v) => v.id === id),
  getCollisionById: (id) => get().collisions.find((c) => c.id === id),
  getCollisionsByStatus: (status) => get().collisions.filter((c) => c.status === status),
  getVisaLinesByNo: (visaNo) => get().visaLines.filter((v) => v.visaNo === visaNo),
  getVisaNos: () => Array.from(new Set(get().visaLines.map((v) => v.visaNo))),
  getBoundaryByCollision: (collisionId) => get().boundarySamples.find((b) => b.collisionId === collisionId),
  getSupplementsByCollision: (collisionId) => get().supplements.filter((s) => s.collisionId === collisionId),
}));
