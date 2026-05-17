import { QualityReview, ReviewStatus, HistoryRecord } from './types';

class ReviewStore {
  private reviews: Map<string, QualityReview> = new Map();

  add(review: QualityReview): void {
    this.reviews.set(review.id, review);
  }

  get(id: string): QualityReview | undefined {
    return this.reviews.get(id);
  }

  getAll(): QualityReview[] {
    return Array.from(this.reviews.values());
  }

  update(id: string, review: QualityReview): void {
    this.reviews.set(id, review);
  }

  delete(id: string): boolean {
    return this.reviews.delete(id);
  }

  clear(): void {
    this.reviews.clear();
  }
}

export const reviewStore = new ReviewStore();
