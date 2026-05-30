export type EventStatus =
  | "pending_announcement"
  | "announcement_matched"
  | "voting_in_progress"
  | "voting_completed"
  | "payout_calculating"
  | "under_review"
  | "review_passed"
  | "review_failed";

export interface TriggerEvent {
  id: string;
  eventName: string;
  productType: string;
  referenceEntity: string;
  status: EventStatus;
  createdAt: string;
  updatedAt: string;
  needsManualSupplement: boolean;
}

export interface ContractTerms {
  id: string;
  eventId: string;
  source: string;
  version: number;
  content: string;
  parsedTerms: Record<string, string>;
  updatedAt: string;
}

export interface CreditEventAnnouncement {
  id: string;
  eventId: string;
  source: string;
  sourceInstitution: string;
  version: number;
  content: string;
  publishedAt: string;
  isCurrentVersion: boolean;
  previousVersionId: string | null;
}

export interface CommitteeVote {
  id: string;
  eventId: string;
  voterName: string;
  voterRole: string;
  voteResult: "approve" | "reject" | "abstain";
  voteBasis: string;
  votedAt: string;
}

export type EvidenceNodeType =
  | "contract"
  | "announcement"
  | "vote"
  | "payout"
  | "manual_supplement"
  | "status_change";

export interface EvidenceNode {
  id: string;
  eventId: string;
  nodeType: EvidenceNodeType;
  source: string;
  operator: string;
  timestamp: string;
  summary: string;
  relatedVersionId: string;
}

export interface CalculationStep {
  step: number;
  description: string;
  formula: string;
  result: number | null;
}

export interface PayoutCalculation {
  id: string;
  eventId: string;
  announcementVersionId: string;
  voteResultId: string;
  notionalAmount: number;
  recoveryRate: number;
  payoutPrice: number | null;
  calculationSteps: CalculationStep[];
  calculatedAt: string;
  isComplete: boolean;
}

export interface StatusTransition {
  id: string;
  eventId: string;
  fromStatus: EventStatus | null;
  toStatus: EventStatus;
  operator: string;
  timestamp: string;
  reason: string;
}

export interface ManualSupplement {
  id: string;
  eventId: string;
  supplementType: string;
  description: string;
  requestedBy: string;
  requestedAt: string;
  resolvedAt: string | null;
  status: "pending" | "resolved";
}

export const STATUS_LABELS: Record<EventStatus, string> = {
  pending_announcement: "待匹配公告",
  announcement_matched: "公告已匹配",
  voting_in_progress: "投票中",
  voting_completed: "投票完成",
  payout_calculating: "赔付试算中",
  under_review: "复核中",
  review_passed: "复核通过",
  review_failed: "复核未通过",
};

export const STATUS_COLORS: Record<EventStatus, string> = {
  pending_announcement: "#6b7280",
  announcement_matched: "#3b82f6",
  voting_in_progress: "#8b5cf6",
  voting_completed: "#06b6d4",
  payout_calculating: "#f59e0b",
  under_review: "#e8a838",
  review_passed: "#2dd4a8",
  review_failed: "#ef4444",
};

export const EVIDENCE_NODE_LABELS: Record<EvidenceNodeType, string> = {
  contract: "合约条款",
  announcement: "信用事件公告",
  vote: "委员会投票",
  payout: "赔付试算",
  manual_supplement: "人工补资料",
  status_change: "状态变更",
};

export const EVIDENCE_NODE_ICONS: Record<EvidenceNodeType, string> = {
  contract: "FileText",
  announcement: "Megaphone",
  vote: "Vote",
  payout: "Calculator",
  manual_supplement: "ClipboardPlus",
  status_change: "ArrowRightLeft",
};

export const PRODUCT_TYPES = ["CDS", "TRS", "CLN", "CRX"] as const;
