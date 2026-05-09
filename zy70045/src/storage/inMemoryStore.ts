import { v4 as uuidv4 } from 'uuid';
import {
  Shift,
  ProductionRecord,
  WasteRecord,
  DowntimeRecord,
  DowntimeAllocation,
  RevisionRecord,
  ShiftSnapshot,
} from '../models/types';

export class InMemoryStore {
  private shifts: Map<string, Shift> = new Map();
  private productions: Map<string, ProductionRecord> = new Map();
  private wastes: Map<string, WasteRecord> = new Map();
  private downtimes: Map<string, DowntimeRecord> = new Map();
  private allocations: Map<string, DowntimeAllocation> = new Map();
  private revisions: Map<string, RevisionRecord> = new Map();
  private snapshots: Map<string, ShiftSnapshot> = new Map();

  reset(): void {
    this.shifts.clear();
    this.productions.clear();
    this.wastes.clear();
    this.downtimes.clear();
    this.allocations.clear();
    this.revisions.clear();
    this.snapshots.clear();
  }

  generateId(): string {
    return uuidv4();
  }

  saveShift(shift: Shift): Shift {
    this.shifts.set(shift.id, shift);
    return shift;
  }

  getShiftById(id: string): Shift | undefined {
    return this.shifts.get(id);
  }

  getShiftsByLine(lineId: string): Shift[] {
    return Array.from(this.shifts.values())
      .filter((s) => s.lineId === lineId)
      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  }

  getActiveShift(lineId: string): Shift | undefined {
    return Array.from(this.shifts.values()).find(
      (s) => s.lineId === lineId && s.status === 'active'
    );
  }

  saveProduction(production: ProductionRecord): ProductionRecord {
    this.productions.set(production.id, production);
    return production;
  }

  getProductionById(id: string): ProductionRecord | undefined {
    return this.productions.get(id);
  }

  getProductionsByShift(shiftId: string): ProductionRecord[] {
    return Array.from(this.productions.values()).filter(
      (p) => p.shiftId === shiftId
    );
  }

  saveWaste(waste: WasteRecord): WasteRecord {
    this.wastes.set(waste.id, waste);
    return waste;
  }

  getWasteById(id: string): WasteRecord | undefined {
    return this.wastes.get(id);
  }

  getWastesByShift(shiftId: string): WasteRecord[] {
    return Array.from(this.wastes.values()).filter((w) => w.shiftId === shiftId);
  }

  saveDowntime(downtime: DowntimeRecord): DowntimeRecord {
    this.downtimes.set(downtime.id, downtime);
    return downtime;
  }

  getDowntimeById(id: string): DowntimeRecord | undefined {
    return this.downtimes.get(id);
  }

  getDowntimesByLine(lineId: string): DowntimeRecord[] {
    return Array.from(this.downtimes.values())
      .filter((d) => d.lineId === lineId)
      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  }

  getDowntimesInTimeRange(
    lineId: string,
    startTime: Date,
    endTime: Date
  ): DowntimeRecord[] {
    return Array.from(this.downtimes.values()).filter((d) => {
      if (d.lineId !== lineId) return false;
      if (!d.endTime) return false;
      return d.endTime > startTime && d.startTime < endTime;
    });
  }

  saveAllocation(allocation: DowntimeAllocation): DowntimeAllocation {
    this.allocations.set(allocation.id, allocation);
    return allocation;
  }

  getAllocationsByDowntime(downtimeId: string): DowntimeAllocation[] {
    return Array.from(this.allocations.values()).filter(
      (a) => a.downtimeId === downtimeId
    );
  }

  getAllocationsByShift(shiftId: string): DowntimeAllocation[] {
    return Array.from(this.allocations.values()).filter(
      (a) => a.shiftId === shiftId
    );
  }

  saveRevision(revision: RevisionRecord): RevisionRecord {
    this.revisions.set(revision.id, revision);
    return revision;
  }

  getRevisionsByTarget(
    targetId: string,
    targetType: RevisionRecord['targetType']
  ): RevisionRecord[] {
    return Array.from(this.revisions.values())
      .filter((r) => r.targetId === targetId && r.targetType === targetType)
      .sort((a, b) => a.revisedAt.getTime() - b.revisedAt.getTime());
  }

  saveSnapshot(snapshot: ShiftSnapshot): ShiftSnapshot {
    this.snapshots.set(snapshot.id, snapshot);
    return snapshot;
  }

  getSnapshotByShiftVersion(
    shiftId: string,
    shiftVersion: number
  ): ShiftSnapshot | undefined {
    return Array.from(this.snapshots.values()).find(
      (s) => s.shiftId === shiftId && s.shiftVersion === shiftVersion
    );
  }

  getSnapshotsByShift(shiftId: string): ShiftSnapshot[] {
    return Array.from(this.snapshots.values())
      .filter((s) => s.shiftId === shiftId)
      .sort((a, b) => a.shiftVersion - b.shiftVersion);
  }

  getLatestSnapshot(shiftId: string): ShiftSnapshot | undefined {
    const snapshots = this.getSnapshotsByShift(shiftId);
    return snapshots.length > 0 ? snapshots[snapshots.length - 1] : undefined;
  }
}

export const store = new InMemoryStore();
