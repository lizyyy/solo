export interface Batch {
  id: string;
  name: string;
  importTime: string;
  modelVersion: string;
  totalSamples: number;
  anomalyCount: number;
}

export type SampleStatus = 'pending_review' | 'confirmed_normal' | 'needs_attention';

export interface SampleVersion {
  id: string;
  modelVersion: string;
  tags: Record<string, string>;
  timestamp: string;
}

export type CommentAuthor = '小孟' | '标注员' | '运营复核';

export interface Comment {
  id: string;
  author: CommentAuthor;
  content: string;
  timestamp: string;
}

export type NextOwner = '运营复核人' | '模型评测小孟';

export interface Review {
  explanation: string;
  missingMaterials: string[];
  nextOwner: NextOwner;
  updatedAt: string;
}

export interface Sample {
  id: string;
  batchId: string;
  sampleNo: string;
  currentModelVersion: string;
  status: SampleStatus;
  createdAt: string;
  versions: SampleVersion[];
  comments: Comment[];
  review?: Review;
  isAnomaly: boolean;
}
