export type CollisionStatus = "confirmed" | "pending" | "rejected";

export interface Screenshot {
  id: string;
  url: string;
  viewpoint: string;
  coords: string;
  note: string;
}

export interface VisaLine {
  id: string;
  visaNo: string;
  lineNo: number;
  content: string;
  offsetMm: number;
  causesBias: boolean;
  collisionId?: string;
}

export interface Collision {
  id: string;
  preReviewId: string;
  building: string;
  floor: number;
  pointCode: string;
  description: string;
  status: CollisionStatus;
  isDuplicate: boolean;
  duplicateReason?: string;
  duplicateCount?: number;
  visaLineId: string;
  reviewDate: string;
  screenshot: Screenshot;
}

export interface PreReviewFilters {
  building: string;
  floor: string;
  dateFrom: string;
  dateTo: string;
  status: CollisionStatus | "all";
}

export interface ReviewStats {
  total: number;
  confirmed: number;
  pending: number;
  rejected: number;
  duplicates: number;
}
