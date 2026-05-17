import { v4 as uuidv4 } from 'uuid';
import { Advertiser, AdPlan, SpendCallback, ReviewRecord, PlanStatus, FlowType, ReviewResult } from './types';

class DataStore {
  private advertisers: Map<string, Advertiser> = new Map();
  private adPlans: Map<string, AdPlan> = new Map();
  private spendCallbacks: Map<string, SpendCallback> = new Map();
  private reviewRecords: Map<string, ReviewRecord> = new Map();

  addAdvertiser(advertiser: Omit<Advertiser, 'id' | 'createdAt'>): Advertiser {
    const id = uuidv4();
    const newAdvertiser: Advertiser = {
      ...advertiser,
      id,
      createdAt: new Date()
    };
    this.advertisers.set(id, newAdvertiser);
    return newAdvertiser;
  }

  getAdvertiser(id: string): Advertiser | undefined {
    return this.advertisers.get(id);
  }

  getAllAdvertisers(): Advertiser[] {
    return Array.from(this.advertisers.values());
  }

  addAdPlan(plan: Omit<AdPlan, 'id' | 'createdAt' | 'updatedAt'>): AdPlan {
    const id = uuidv4();
    const now = new Date();
    const newPlan: AdPlan = {
      ...plan,
      id,
      createdAt: now,
      updatedAt: now
    };
    this.adPlans.set(id, newPlan);
    return newPlan;
  }

  updateAdPlan(id: string, updates: Partial<AdPlan>): AdPlan | undefined {
    const plan = this.adPlans.get(id);
    if (!plan) return undefined;
    
    const updatedPlan: AdPlan = {
      ...plan,
      ...updates,
      updatedAt: new Date()
    };
    this.adPlans.set(id, updatedPlan);
    return updatedPlan;
  }

  getAdPlan(id: string): AdPlan | undefined {
    return this.adPlans.get(id);
  }

  getAllAdPlans(): AdPlan[] {
    return Array.from(this.adPlans.values());
  }

  getAdPlansByAdvertiser(advertiserId: string): AdPlan[] {
    return this.getAllAdPlans().filter(p => p.advertiserId === advertiserId);
  }

  addSpendCallback(callback: Omit<SpendCallback, 'id' | 'createdAt'>): SpendCallback {
    const id = uuidv4();
    const newCallback: SpendCallback = {
      ...callback,
      id,
      createdAt: new Date()
    };
    this.spendCallbacks.set(id, newCallback);
    return newCallback;
  }

  getSpendCallbacksByPlan(planId: string): SpendCallback[] {
    return Array.from(this.spendCallbacks.values())
      .filter(c => c.planId === planId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  addReviewRecord(record: Omit<ReviewRecord, 'id' | 'createdAt'>): ReviewRecord {
    const id = uuidv4();
    const newRecord: ReviewRecord = {
      ...record,
      id,
      createdAt: new Date()
    };
    this.reviewRecords.set(id, newRecord);
    return newRecord;
  }

  getReviewRecordsByPlan(planId: string): ReviewRecord[] {
    return Array.from(this.reviewRecords.values())
      .filter(r => r.planId === planId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  clear(): void {
    this.advertisers.clear();
    this.adPlans.clear();
    this.spendCallbacks.clear();
    this.reviewRecords.clear();
  }
}

export const store = new DataStore();
