import {
  Review,
  TrainingLog,
  ChangeHistory,
  ThresholdNote,
  SummaryItem,
  ReviewFullData,
} from '@/types';

const STORAGE_KEYS = {
  reviews: 'review_app_reviews',
  trainingLogs: 'review_app_training_logs',
  changeHistories: 'review_app_change_histories',
  thresholdNotes: 'review_app_threshold_notes',
  summaryItems: 'review_app_summary_items',
};

function getStorageItem<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function setStorageItem<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

export const storage = {
  getReviews(): Review[] {
    return getStorageItem<Review[]>(STORAGE_KEYS.reviews, []);
  },
  setReviews(reviews: Review[]): void {
    setStorageItem(STORAGE_KEYS.reviews, reviews);
  },
  getTrainingLogs(): TrainingLog[] {
    return getStorageItem<TrainingLog[]>(STORAGE_KEYS.trainingLogs, []);
  },
  setTrainingLogs(logs: TrainingLog[]): void {
    setStorageItem(STORAGE_KEYS.trainingLogs, logs);
  },
  getChangeHistories(): ChangeHistory[] {
    return getStorageItem<ChangeHistory[]>(STORAGE_KEYS.changeHistories, []);
  },
  setChangeHistories(histories: ChangeHistory[]): void {
    setStorageItem(STORAGE_KEYS.changeHistories, histories);
  },
  getThresholdNotes(): ThresholdNote[] {
    return getStorageItem<ThresholdNote[]>(STORAGE_KEYS.thresholdNotes, []);
  },
  setThresholdNotes(notes: ThresholdNote[]): void {
    setStorageItem(STORAGE_KEYS.thresholdNotes, notes);
  },
  getSummaryItems(): SummaryItem[] {
    return getStorageItem<SummaryItem[]>(STORAGE_KEYS.summaryItems, []);
  },
  setSummaryItems(items: SummaryItem[]): void {
    setStorageItem(STORAGE_KEYS.summaryItems, items);
  },
  getReviewFullData(reviewId: string): ReviewFullData | null {
    const review = this.getReviews().find(r => r.id === reviewId);
    if (!review) return null;
    return {
      review,
      trainingLogs: this.getTrainingLogs().filter(l => l.reviewId === reviewId),
      changeHistories: this.getChangeHistories().filter(h => h.reviewId === reviewId),
      thresholdNotes: this.getThresholdNotes().filter(n => n.reviewId === reviewId),
      summaryItems: this.getSummaryItems().filter(s => s.reviewId === reviewId),
    };
  },
  clearAll(): void {
    Object.values(STORAGE_KEYS).forEach(k => localStorage.removeItem(k));
  },
};
