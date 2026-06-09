import { create } from "zustand";
import {
  initialReconcileState,
  type ReconcileState,
} from "./reconcileSlice";

export const useReconcileStore = create<ReconcileState>((set, get) => {
  const withBoundThis = (obj: ReconcileState): ReconcileState => {
    const bound = { ...obj } as ReconcileState & ThisType<ReconcileState>;
    (Object.keys(obj) as (keyof ReconcileState)[]).forEach((k) => {
      const v = obj[k];
      if (typeof v === "function") {
        (bound as Record<string, unknown>)[k] = function (...args: unknown[]) {
          const self = get();
          const result = (v as (...a: unknown[]) => unknown).apply(self, args);
          return result;
        };
      }
    });
    return bound;
  };

  const state = withBoundThis(initialReconcileState);
  queueMicrotask(() => {
    get()._init();
  });
  return state;
});

export function useStoreSnapshot() {
  return useReconcileStore((s) => ({
    pets: s.pets,
    aliases: s.aliases,
    dataSources: s.dataSources,
    schedules: s.schedules,
    medicalRecords: s.medicalRecords,
    operationLogs: s.operationLogs,
    currentOperator: s.currentOperator,
  }));
}
