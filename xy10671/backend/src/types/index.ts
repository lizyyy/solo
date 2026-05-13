export enum ProjectStatus {
  DRAFT = 'draft',
  VOTING = 'voting',
  VOTE_PASSED = 'vote_passed',
  VOTE_REJECTED = 'vote_rejected',
  BUDGETING = 'budgeting',
  BUDGET_APPROVED = 'budget_approved',
  CONSTRUCTION = 'construction',
  INSPECTION = 'inspection',
  PUBLIC_NOTICE = 'public_notice',
  OBJECTION = 'objection',
  REVIEW = 'review',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}

export enum VoteResult {
  AGREE = 'agree',
  DISAGREE = 'disagree',
  ABSTAIN = 'abstain'
}

export enum NodeType {
  MATERIAL_PREPARATION = 'material_preparation',
  FOUNDATION_CONSTRUCTION = 'foundation_construction',
  MAIN_CONSTRUCTION = 'main_construction',
  INSTALLATION = 'installation',
  TESTING = 'testing',
  CLEANUP = 'cleanup'
}

export interface IProjectStatusTransition {
  from: ProjectStatus;
  to: ProjectStatus;
  action: string;
  handler: string;
}
