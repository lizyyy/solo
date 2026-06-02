import type { Feedback, ConflictDecision, DuplicateGroup } from '@/types';
import { mockFeedbacks, mockDuplicateGroups } from '@/mocks/feedbacks';
import { findDuplicateGroups, mergeDuplicateFeedbacks } from '@/utils/duplicate';
import { resolveConflict, detectEmptyValues, isBoundaryRecord } from '@/utils/conflict';

let feedbacksData: Feedback[] = [...mockFeedbacks];

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export const feedbackService = {
  async getFeedbacks(params?: { pointId?: string; status?: string; type?: string }): Promise<Feedback[]> {
    await delay(300);
    let result = [...feedbacksData];
    if (params?.pointId) {
      result = result.filter(f => f.pointId === params.pointId);
    }
    if (params?.status) {
      result = result.filter(f => f.status === params.status);
    }
    if (params?.type) {
      result = result.filter(f => f.type === params.type);
    }
    return result.sort((a, b) =>
      new Date(b.reportTime).getTime() - new Date(a.reportTime).getTime()
    );
  },

  async getFeedbackById(id: string): Promise<Feedback | null> {
    await delay(200);
    return feedbacksData.find(f => f.id === id) || null;
  },

  async getDuplicateGroups(): Promise<DuplicateGroup[]> {
    await delay(300);
    const activeFeedbacks = feedbacksData.filter(f => !f.isDuplicate);
    const groups = findDuplicateGroups(activeFeedbacks);
    return [...mockDuplicateGroups, ...groups];
  },

  async resolveConflict(
    id: string,
    decision: ConflictDecision,
    note: string
  ): Promise<Feedback> {
    await delay(400);
    const index = feedbacksData.findIndex(f => f.id === id);
    if (index === -1) {
      throw new Error('反馈不存在');
    }
    feedbacksData[index] = resolveConflict(feedbacksData[index], decision, note);
    return feedbacksData[index];
  },

  async createFeedback(data: Omit<Feedback, 'id' | 'createdAt'>): Promise<Feedback> {
    await delay(300);
    const emptyFields = detectEmptyValues(data as Feedback);
    const newFeedback: Feedback = {
      ...data,
      id: `f${Date.now()}`,
      hasEmptyValue: emptyFields.length > 0,
      emptyFields: emptyFields.length > 0 ? emptyFields : undefined,
      isBoundary: isBoundaryRecord(data as Feedback),
      createdAt: new Date().toISOString(),
    };
    feedbacksData.push(newFeedback);
    return newFeedback;
  },

  async updateFeedback(id: string, data: Partial<Feedback>): Promise<Feedback> {
    await delay(300);
    const index = feedbacksData.findIndex(f => f.id === id);
    if (index === -1) {
      throw new Error('反馈不存在');
    }
    const updated = { ...feedbacksData[index], ...data };
    const emptyFields = detectEmptyValues(updated);
    feedbacksData[index] = {
      ...updated,
      hasEmptyValue: emptyFields.length > 0,
      emptyFields: emptyFields.length > 0 ? emptyFields : undefined,
      isBoundary: isBoundaryRecord(updated),
    };
    return feedbacksData[index];
  },

  async mergeDuplicates(primaryId: string, duplicateIds: string[]): Promise<Feedback> {
    await delay(400);
    const primary = feedbacksData.find(f => f.id === primaryId);
    const duplicates = feedbacksData.filter(f => duplicateIds.includes(f.id));
    if (!primary || duplicates.length === 0) {
      throw new Error('无法合并：主记录或重复记录不存在');
    }
    const merged = mergeDuplicateFeedbacks(primary, duplicates);
    feedbacksData = feedbacksData.filter(f => !duplicateIds.includes(f.id));
    const index = feedbacksData.findIndex(f => f.id === primaryId);
    feedbacksData[index] = merged;
    return merged;
  },
};
