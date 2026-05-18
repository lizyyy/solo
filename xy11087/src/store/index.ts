import { ReplenishmentAbnormal, ReplenishmentAbnormalStatus } from '../types';

class DataStore {
  private records: Map<string, ReplenishmentAbnormal> = new Map();

  add(record: ReplenishmentAbnormal): void {
    this.records.set(record.abnormalNo, record);
  }

  get(abnormalNo: string): ReplenishmentAbnormal | undefined {
    return this.records.get(abnormalNo);
  }

  getAll(): ReplenishmentAbnormal[] {
    return Array.from(this.records.values());
  }

  update(abnormalNo: string, record: Partial<ReplenishmentAbnormal>): ReplenishmentAbnormal | undefined {
    const existing = this.records.get(abnormalNo);
    if (!existing) return undefined;
    const updated = { ...existing, ...record };
    this.records.set(abnormalNo, updated);
    return updated;
  }

  exists(abnormalNo: string): boolean {
    return this.records.has(abnormalNo);
  }

  clear(): void {
    this.records.clear();
  }
}

export const dataStore = new DataStore();

export const statusTransitionRules: Map<ReplenishmentAbnormalStatus, ReplenishmentAbnormalStatus[]> = new Map([
  [ReplenishmentAbnormalStatus.PENDING, [
    ReplenishmentAbnormalStatus.PROCESSING,
    ReplenishmentAbnormalStatus.SUSPENDED,
    ReplenishmentAbnormalStatus.CLOSED
  ]],
  [ReplenishmentAbnormalStatus.PROCESSING, [
    ReplenishmentAbnormalStatus.REMARKED,
    ReplenishmentAbnormalStatus.SUSPENDED,
    ReplenishmentAbnormalStatus.RESOLVED,
    ReplenishmentAbnormalStatus.CLOSED
  ]],
  [ReplenishmentAbnormalStatus.REMARKED, [
    ReplenishmentAbnormalStatus.RESOLVED,
    ReplenishmentAbnormalStatus.SUSPENDED,
    ReplenishmentAbnormalStatus.CLOSED
  ]],
  [ReplenishmentAbnormalStatus.SUSPENDED, [
    ReplenishmentAbnormalStatus.PROCESSING,
    ReplenishmentAbnormalStatus.REMARKED,
    ReplenishmentAbnormalStatus.RESOLVED,
    ReplenishmentAbnormalStatus.CLOSED
  ]],
  [ReplenishmentAbnormalStatus.RESOLVED, [
    ReplenishmentAbnormalStatus.CLOSED
  ]],
  [ReplenishmentAbnormalStatus.CLOSED, []]
]);

export const remarkableTypes = [
  'channel_misplacement',
  'replenishment_diff_inconsistency'
];
