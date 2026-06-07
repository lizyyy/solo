import { create } from 'zustand';
import {
  Review,
  TrainingLog,
  ChangeHistory,
  ThresholdNote,
  SummaryItem,
  ReviewFullData,
  ReviewStatus,
  ReviewStep,
} from '@/types';
import { storage } from '@/utils/storage';
import { generateId, nowISO } from '@/utils/common';
import { parseTrainingLogs, computeSourceHash } from '@/utils/logParser';
import { applyBoundaryRules, canTransitionStep, getNextStep } from '@/utils/boundaryRules';

interface ReviewState {
  reviews: Review[];
  currentReview: ReviewFullData | null;
  viewMode: 'standard' | 'summary';
  currentUser: string;
  loadReviews: () => void;
  loadReviewDetail: (id: string) => void;
  createReview: (title: string) => Review;
  updateReview: (id: string, updates: Partial<Review>) => { success: boolean; messages: string[] };
  importTrainingLogs: (reviewId: string, logText: string, batchId: string) => {
    added: number;
    skipped: number;
    messages: string[];
  };
  updateTrainingLog: (logId: string, content: string) => void;
  addThresholdNote: (reviewId: string, title: string, content: string, relatedLogIds: string[]) => void;
  addSummaryItem: (reviewId: string, content: string, source: SummaryItem['source'], needsConfirmation: boolean) => void;
  updateSummaryItem: (itemId: string, updates: Partial<SummaryItem>) => void;
  confirmReview: (reviewId: string, comment: string, confirmed: boolean) => { success: boolean; messages: string[] };
  advanceStep: (reviewId: string) => { success: boolean; nextStep: ReviewStep | null; messages: string[] };
  setViewMode: (mode: 'standard' | 'summary') => void;
  setCurrentUser: (user: string) => void;
  clearCurrent: () => void;
}

export const useReviewStore = create<ReviewState>((set, get) => ({
  reviews: [],
  currentReview: null,
  viewMode: 'standard',
  currentUser: '算法工程师-小乔',

  loadReviews: () => {
    const reviews = storage.getReviews().sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
    set({ reviews });
  },

  loadReviewDetail: (id: string) => {
    const data = storage.getReviewFullData(id);
    if (data) {
      data.changeHistories.sort(
        (a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime()
      );
      data.trainingLogs.sort((a, b) => a.originalLineNumber - b.originalLineNumber);
    }
    set({ currentReview: data });
  },

  createReview: (title: string) => {
    const now = nowISO();
    const review: Review = {
      id: generateId(),
      title,
      status: 'draft',
      currentStep: 'log_import',
      createdBy: get().currentUser,
      createdAt: now,
      updatedAt: now,
      assignee: get().currentUser,
      hasDefaultScoreIssue: false,
    };
    const reviews = [review, ...storage.getReviews()];
    storage.setReviews(reviews);
    set({ reviews });

    const history: ChangeHistory = {
      id: generateId(),
      reviewId: review.id,
      fieldName: 'review',
      oldValue: '',
      newValue: JSON.stringify(review),
      modifiedBy: get().currentUser,
      modifiedAt: now,
      changeType: 'create',
    };
    const histories = [history, ...storage.getChangeHistories()];
    storage.setChangeHistories(histories);

    return review;
  },

  updateReview: (id: string, updates: Partial<Review>) => {
    const reviews = storage.getReviews();
    const idx = reviews.findIndex(r => r.id === id);
    if (idx === -1) return { success: false, messages: ['复盘记录不存在'] };

    const oldReview = reviews[idx];
    const now = nowISO();
    const updatedReview = { ...oldReview, ...updates, updatedAt: now };

    const result = applyBoundaryRules(
      { review: updatedReview, modifiedBy: get().currentUser },
      updates.status
    );

    if (!result.success) {
      return { success: false, messages: result.messages };
    }

    Object.assign(updatedReview, result.updates);
    reviews[idx] = updatedReview;
    storage.setReviews(reviews);
    set({ reviews });

    for (const [key, value] of Object.entries(updates)) {
      const oldVal = String(oldReview[key as keyof Review] ?? '');
      const newVal = String(value ?? '');
      if (oldVal !== newVal) {
        const history: ChangeHistory = {
          id: generateId(),
          reviewId: id,
          fieldName: key,
          oldValue: oldVal,
          newValue: newVal,
          modifiedBy: get().currentUser,
          modifiedAt: now,
          changeType: key === 'status' ? 'status_change' : 'update',
        };
        const histories = [history, ...storage.getChangeHistories()];
        storage.setChangeHistories(histories);
      }
    }

    if (get().currentReview?.review.id === id) {
      get().loadReviewDetail(id);
    }

    return { success: true, messages: result.messages };
  },

  importTrainingLogs: (reviewId: string, logText: string, batchId: string) => {
    const parsed = parseTrainingLogs(logText, batchId);
    const existingLogs = storage.getTrainingLogs().filter(l => l.reviewId === reviewId);
    const existingHashes = new Set(existingLogs.map(l => l.sourceHash));

    const newLogs: TrainingLog[] = [];
    let skipped = 0;

    for (const item of parsed) {
      if (existingHashes.has(item.sourceHash)) {
        skipped++;
        continue;
      }
      newLogs.push({
        id: generateId(),
        reviewId,
        originalLineNumber: item.lineNumber,
        content: item.content,
        originalContent: item.content,
        status: 'original',
        sourceHash: item.sourceHash,
        isModified: false,
      });
    }

    const allLogs = [...existingLogs, ...newLogs];
    storage.setTrainingLogs([...storage.getTrainingLogs().filter(l => l.reviewId !== reviewId), ...allLogs]);

    const messages: string[] = [];
    if (newLogs.length > 0) {
      messages.push(`成功导入 ${newLogs.length} 条训练日志`);
    }
    if (skipped > 0) {
      messages.push(`跳过 ${skipped} 条重复日志（基于内容哈希去重）`);
    }

    const reviews = storage.getReviews();
    const idx = reviews.findIndex(r => r.id === reviewId);
    if (idx !== -1 && reviews[idx].currentStep === 'log_import' && newLogs.length > 0) {
      const now = nowISO();
      reviews[idx] = { ...reviews[idx], status: 'in_progress', updatedAt: now };
      storage.setReviews(reviews);
      set({ reviews });
    }

    if (newLogs.length > 0) {
      const ruleResult = applyBoundaryRules({
        review: reviews[idx],
        trainingLogs: allLogs,
        modifiedBy: get().currentUser,
      });
      if (ruleResult.updates) {
        reviews[idx] = { ...reviews[idx], ...ruleResult.updates };
        storage.setReviews(reviews);
        set({ reviews });
        messages.push(...ruleResult.messages);
      }
    }

    if (get().currentReview?.review.id === reviewId) {
      get().loadReviewDetail(reviewId);
    } else {
      get().loadReviews();
    }

    return { added: newLogs.length, skipped, messages };
  },

  updateTrainingLog: (logId: string, content: string) => {
    const logs = storage.getTrainingLogs();
    const idx = logs.findIndex(l => l.id === logId);
    if (idx === -1) return;

    const oldLog = logs[idx];
    if (oldLog.content === content) return;

    const now = nowISO();
    logs[idx] = {
      ...oldLog,
      content,
      isModified: true,
      status: 'modified',
      modifiedBy: get().currentUser,
      modifiedAt: now,
    };
    storage.setTrainingLogs(logs);

    const history: ChangeHistory = {
      id: generateId(),
      reviewId: oldLog.reviewId,
      fieldName: `training_log[${oldLog.originalLineNumber}]`,
      oldValue: oldLog.content,
      newValue: content,
      modifiedBy: get().currentUser,
      modifiedAt: now,
      changeType: 'update',
    };
    const histories = [history, ...storage.getChangeHistories()];
    storage.setChangeHistories(histories);

    if (get().currentReview?.review.id === oldLog.reviewId) {
      get().loadReviewDetail(oldLog.reviewId);
    }
  },

  addThresholdNote: (reviewId: string, title: string, content: string, relatedLogIds: string[]) => {
    const note: ThresholdNote = {
      id: generateId(),
      reviewId,
      title,
      content,
      relatedLogIds,
      createdBy: get().currentUser,
      createdAt: nowISO(),
    };
    const notes = [note, ...storage.getThresholdNotes()];
    storage.setThresholdNotes(notes);

    if (get().currentReview?.review.id === reviewId) {
      get().loadReviewDetail(reviewId);
    }
  },

  addSummaryItem: (reviewId: string, content: string, source: SummaryItem['source'], needsConfirmation: boolean) => {
    const item: SummaryItem = {
      id: generateId(),
      reviewId,
      content,
      source,
      needsConfirmation,
      isConfirmed: false,
    };
    const items = [item, ...storage.getSummaryItems()];
    storage.setSummaryItems(items);

    if (get().currentReview?.review.id === reviewId) {
      get().loadReviewDetail(reviewId);
    }
  },

  updateSummaryItem: (itemId: string, updates: Partial<SummaryItem>) => {
    const items = storage.getSummaryItems();
    const idx = items.findIndex(i => i.id === itemId);
    if (idx === -1) return;

    const oldItem = items[idx];
    items[idx] = { ...oldItem, ...updates };
    storage.setSummaryItems(items);

    if (get().currentReview?.review.id === oldItem.reviewId) {
      get().loadReviewDetail(oldItem.reviewId);
    }
  },

  confirmReview: (reviewId: string, comment: string, confirmed: boolean) => {
    const reviews = storage.getReviews();
    const idx = reviews.findIndex(r => r.id === reviewId);
    if (idx === -1) return { success: false, messages: ['复盘记录不存在'] };

    const now = nowISO();
    if (confirmed) {
      reviews[idx] = {
        ...reviews[idx],
        status: 'completed',
        reviewComment: comment,
        updatedAt: now,
      };
    } else {
      reviews[idx] = {
        ...reviews[idx],
        status: 'in_progress',
        reviewComment: comment,
        updatedAt: now,
      };
    }

    const result = applyBoundaryRules(
      { review: reviews[idx], modifiedBy: get().currentUser },
      reviews[idx].status
    );

    if (!result.success) {
      return { success: false, messages: result.messages };
    }

    Object.assign(reviews[idx], result.updates);
    storage.setReviews(reviews);
    set({ reviews });

    const history: ChangeHistory = {
      id: generateId(),
      reviewId,
      fieldName: 'review_comment',
      oldValue: '',
      newValue: comment,
      modifiedBy: get().currentUser,
      modifiedAt: now,
      changeType: 'update',
    };
    const histories = [history, ...storage.getChangeHistories()];
    storage.setChangeHistories(histories);

    if (get().currentReview?.review.id === reviewId) {
      get().loadReviewDetail(reviewId);
    }

    return { success: true, messages: ['复核操作已完成'] };
  },

  advanceStep: (reviewId: string) => {
    const reviews = storage.getReviews();
    const idx = reviews.findIndex(r => r.id === reviewId);
    if (idx === -1) return { success: false, nextStep: null, messages: ['复盘记录不存在'] };

    const review = reviews[idx];
    const nextStep = getNextStep(review.currentStep);
    if (!nextStep) {
      return { success: false, nextStep: null, messages: ['已在最后一步'] };
    }

    const now = nowISO();
    reviews[idx] = { ...review, currentStep: nextStep, updatedAt: now };
    storage.setReviews(reviews);
    set({ reviews });

    const history: ChangeHistory = {
      id: generateId(),
      reviewId,
      fieldName: 'currentStep',
      oldValue: review.currentStep,
      newValue: nextStep,
      modifiedBy: get().currentUser,
      modifiedAt: now,
      changeType: 'update',
    };
    const histories = [history, ...storage.getChangeHistories()];
    storage.setChangeHistories(histories);

    if (get().currentReview?.review.id === reviewId) {
      get().loadReviewDetail(reviewId);
    }

    return { success: true, nextStep, messages: [`已进入下一步：${nextStep}`] };
  },

  setViewMode: (mode) => set({ viewMode: mode }),
  setCurrentUser: (user) => set({ currentUser: user }),
  clearCurrent: () => set({ currentReview: null }),
}));
