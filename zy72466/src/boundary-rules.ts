export const BoundaryRules = {
  heatmap: {
    normalLevelMin: 3,
    normalLevelMax: 10,
    missingSamplingDisplayLevel: 1,
    isLowDueToMissingThreshold: 2,
  },

  status: {
    canTransition: {
      imported: ['complaint_linked', 'heatmap_pending_review', 'heatmap_normal', 'archived'],
      complaint_linked: ['heatmap_pending_review', 'heatmap_normal', 'archived'],
      heatmap_pending_review: ['reviewed_normal', 'reviewed_abnormal', 'archived'],
      heatmap_normal: ['reviewed_normal', 'archived'],
      reviewed_normal: ['archived'],
      reviewed_abnormal: ['archived'],
      archived: [],
    } as Record<string, string[]>,
  },

  review: {
    requiredRoles: ['street_planner'],
    autoPendingWhenMissing: true,
  },

  rollback: {
    allowedWindowHours: 24,
    allowedOperations: ['link_complaint', 'update_heatmap', 'review_heatmap'],
  },

  validation: {
    complaintIdPattern: /^TS-\d{6,}$/,
    pointIdPattern: /^P\d{4,}$/,
  },
} as const;

export function isMissingSamplingCausingLow(odorLevel: number, isMissing: boolean): boolean {
  return isMissing && odorLevel <= BoundaryRules.heatmap.isLowDueToMissingThreshold;
}

export function shouldPendingReview(isMissingSampling: boolean, odorLevel: number): boolean {
  if (!BoundaryRules.review.autoPendingWhenMissing) return false;
  return isMissingSamplingCausingLow(odorLevel, isMissingSampling);
}

export function canTransitionStatus(from: string, to: string): boolean {
  if (from === to) return true;
  const allowed = BoundaryRules.status.canTransition[from];
  return allowed ? allowed.includes(to) : false;
}
