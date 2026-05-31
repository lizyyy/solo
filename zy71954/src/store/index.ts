import { create } from "zustand";
import { db } from "@/db";
import type {
  Sortie,
  SortieStatus,
  InspectionPhoto,
  KmlRoute,
  Confirmation,
  FlightReview,
  ImportBatch,
  AuditLog,
  FilterState,
} from "@/types";
import { generateMockData } from "@/mock/data";

interface AppState {
  sorties: Sortie[];
  photos: InspectionPhoto[];
  kmlRoutes: KmlRoute[];
  confirmations: Confirmation[];
  flightReviews: FlightReview[];
  importBatches: ImportBatch[];
  auditLogs: AuditLog[];
  filters: FilterState;
  currentSortieId: string | null;

  loadAllData: () => Promise<void>;
  addSortie: (sortie: Sortie) => Promise<void>;
  updateSortieStatus: (id: string, status: SortieStatus) => Promise<void>;
  addPhoto: (photo: InspectionPhoto) => Promise<void>;
  addKmlRoute: (route: KmlRoute) => Promise<void>;
  addConfirmation: (confirmation: Confirmation) => Promise<void>;
  addFlightReview: (review: FlightReview) => Promise<void>;
  addImportBatch: (batch: ImportBatch) => Promise<void>;
  addAuditLog: (log: AuditLog) => Promise<void>;
  revertImportBatch: (batchId: string) => Promise<void>;
  setFilters: (filters: Partial<FilterState>) => void;
  resetFilters: () => void;
  setCurrentSortieId: (id: string | null) => void;
  getSortieById: (id: string) => Sortie | undefined;
  loadMockData: () => Promise<void>;
}

const defaultFilters: FilterState = {
  status: [],
  anomalyTags: [],
  dateRange: { start: null, end: null },
  batteryId: "",
  sortieNo: "",
};

export const useAppStore = create<AppState>((set, get) => ({
  sorties: [],
  photos: [],
  kmlRoutes: [],
  confirmations: [],
  flightReviews: [],
  importBatches: [],
  auditLogs: [],
  filters: { ...defaultFilters },
  currentSortieId: null,

  loadAllData: async () => {
    const [sorties, photos, kmlRoutes, confirmations, flightReviews, importBatches, auditLogs] =
      await Promise.all([
        db.sorties.toArray(),
        db.inspectionPhotos.toArray(),
        db.kmlRoutes.toArray(),
        db.confirmations.toArray(),
        db.flightReviews.toArray(),
        db.importBatches.toArray(),
        db.auditLogs.toArray(),
      ]);
    set({ sorties, photos, kmlRoutes, confirmations, flightReviews, importBatches, auditLogs });
  },

  addSortie: async (sortie) => {
    await db.sorties.add(sortie);
    set((s) => ({ sorties: [...s.sorties, sortie] }));
  },

  updateSortieStatus: async (id, status) => {
    await db.sorties.update(id, { status });
    set((s) => ({
      sorties: s.sorties.map((si) => (si.id === id ? { ...si, status } : si)),
    }));
  },

  addPhoto: async (photo) => {
    await db.inspectionPhotos.add(photo);
    set((s) => ({ photos: [...s.photos, photo] }));
  },

  addKmlRoute: async (route) => {
    await db.kmlRoutes.add(route);
    set((s) => ({ kmlRoutes: [...s.kmlRoutes, route] }));
  },

  addConfirmation: async (confirmation) => {
    await db.confirmations.add(confirmation);
    set((s) => ({ confirmations: [...s.confirmations, confirmation] }));
  },

  addFlightReview: async (review) => {
    await db.flightReviews.add(review);
    set((s) => ({ flightReviews: [...s.flightReviews, review] }));
  },

  addImportBatch: async (batch) => {
    await db.importBatches.add(batch);
    set((s) => ({ importBatches: [...s.importBatches, batch] }));
  },

  addAuditLog: async (log) => {
    await db.auditLogs.add(log);
    set((s) => ({ auditLogs: [...s.auditLogs, log] }));
  },

  revertImportBatch: async (batchId) => {
    await db.importBatches.update(batchId, { status: "reverted" as const });
    const relatedSortieIds = (await db.sorties.where("importBatchId").equals(batchId).toArray()).map(
      (s) => s.id,
    );
    await db.sorties.bulkDelete(relatedSortieIds);
    await db.inspectionPhotos.where("sortieId").anyOf(relatedSortieIds).delete();
    await db.kmlRoutes.where("sortieId").anyOf(relatedSortieIds).delete();
    await db.confirmations.where("sortieId").anyOf(relatedSortieIds).delete();
    await db.flightReviews.where("sortieId").anyOf(relatedSortieIds).delete();
    await get().loadAllData();
  },

  setFilters: (filters) => {
    set((s) => ({ filters: { ...s.filters, ...filters } }));
  },

  resetFilters: () => {
    set({ filters: { ...defaultFilters } });
  },

  setCurrentSortieId: (id) => {
    set({ currentSortieId: id });
  },

  getSortieById: (id) => {
    return get().sorties.find((s) => s.id === id);
  },

  loadMockData: async () => {
    const mock = generateMockData();
    await db.sorties.bulkPut(mock.sorties);
    await db.inspectionPhotos.bulkPut(mock.photos);
    await db.kmlRoutes.bulkPut(mock.kmlRoutes);
    await db.confirmations.bulkPut(mock.confirmations);
    await db.flightReviews.bulkPut(mock.flightReviews);
    await db.importBatches.bulkPut(mock.importBatches);
    await db.auditLogs.bulkPut(mock.auditLogs);
    await get().loadAllData();
  },
}));
