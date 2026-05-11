import {
  DataStore,
  ImportResult,
  Order,
  SignRecord,
  RefuseRecord,
  ClaimRecord,
} from '../types';
import { loadStore, saveStore } from '../utils/store';
import { analyzeAbnormals, analyzeIssues } from './analyzer';

export function importOrders(orders: Order[]): number {
  const store = loadStore();
  const existingTrackingNos = new Set(store.orders.map((o) => o.trackingNo));
  const newOrders = orders.filter((o) => !existingTrackingNos.has(o.trackingNo));
  
  store.orders.push(...newOrders);
  saveStore(store);
  return newOrders.length;
}

export function importSignRecords(records: SignRecord[]): { imported: number; duplicateBatches: string[] } {
  const store = loadStore();
  const duplicateBatches: string[] = [];
  const toImport: SignRecord[] = [];
  
  for (const record of records) {
    if (record.batchId && store.processedBatches.includes(record.batchId)) {
      if (!duplicateBatches.includes(record.batchId)) {
        duplicateBatches.push(record.batchId);
      }
    } else {
      toImport.push(record);
      if (record.batchId && !store.processedBatches.includes(record.batchId)) {
        store.processedBatches.push(record.batchId);
      }
    }
  }
  
  store.signRecords.push(...toImport);
  saveStore(store);
  return { imported: toImport.length, duplicateBatches };
}

export function importRefuseRecords(records: RefuseRecord[]): number {
  const store = loadStore();
  store.refuseRecords.push(...records);
  saveStore(store);
  return records.length;
}

export function importClaimRecords(records: ClaimRecord[]): number {
  const store = loadStore();
  const existingClaimIds = new Set(store.claimRecords.map((c) => c.claimId));
  const newClaims = records.filter((r) => !existingClaimIds.has(r.claimId));
  
  store.claimRecords.push(...newClaims);
  saveStore(store);
  return newClaims.length;
}

export function runAnalysis(): { newAbnormals: number; newIssues: number } {
  const store = loadStore();
  
  const existingAbnormalIds = new Set(store.abnormals.map((a) => a.id));
  const existingIssueIds = new Set(store.issues.map((i) => i.id));
  
  const newAbnormals = analyzeAbnormals(store).filter((a) => !existingAbnormalIds.has(a.id));
  const newIssues = analyzeIssues(store).filter((i) => !existingIssueIds.has(i.id));
  
  store.abnormals.push(...newAbnormals);
  store.issues.push(...newIssues);
  saveStore(store);
  
  return { newAbnormals: newAbnormals.length, newIssues: newIssues.length };
}
