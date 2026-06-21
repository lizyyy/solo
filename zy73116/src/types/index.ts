export type CollisionStatus = "confirmed" | "pending" | "rejected";

export type MaterialKind = "visa" | "boundary" | "supplement";

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

export interface BoundarySample {
  id: string;
  code: string;
  title: string;
  description: string;
  imageUrl: string;
  thresholdMm: number;
  measuredMm: number;
  collisionId: string;
  visaLineNo: number;
  remark: string;
}

export interface SupplementNote {
  id: string;
  title: string;
  content: string;
  date: string;
  author: string;
  collisionId: string;
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
  relatedDuplicateIds?: string[];
  visaLineId: string;
  reviewDate: string;
  screenshot: Screenshot;
  supplement?: SupplementNote;
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
